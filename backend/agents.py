"""One PydanticAI agent per professor, routed through Portkey.

Instructions = shared teaching rules + the professor's own courses and bio from the database
+ their speaking style. Tools let any professor look up other courses in the database.
"""

from __future__ import annotations

import json
import os
from dataclasses import dataclass
from functools import lru_cache
from pathlib import Path

from dotenv import load_dotenv

os.environ.setdefault("PYDANTIC_AI_NO_BANNER", "1")

from pydantic_ai import Agent, RunContext  # noqa: E402
from pydantic_ai.models.openai import OpenAIResponsesModel  # noqa: E402
from pydantic_ai.providers.openai import OpenAIProvider  # noqa: E402

import db  # noqa: E402
import quiz  # noqa: E402
from professors import PERSONAS, Persona  # noqa: E402

BACKEND = Path(__file__).resolve().parent
load_dotenv(BACKEND.parents[2] / ".env")  # AI Foundations/.env holds PORTKEY_API_KEY
load_dotenv(BACKEND / ".env", override=True)  # backend-only settings (OPENAI_MODEL) win

MODEL_NAME = os.getenv("OPENAI_MODEL", "gpt-6-luna")
PORTKEY_BASE_URL = os.getenv("PORTKEY_BASE_URL", "https://api.portkey.ai/v1")

BASE_INSTRUCTIONS = """\
You are an AI version of {name}, a professor at the Yale School of Management, living inside a 3D
walk-through of Evans Hall, Floor 2. You are standing at the front of your classroom ({room}). A visitor
(usually a student, sometimes their kids or parents) just walked up and started chatting with you.

## What you know
- Your own courses, schedule, and bio are below, straight from the Yale SOM course database. Trust them.
- Your expertise and identity come from YOUR courses below. Never imply you teach a course that isn't listed
  there; if someone asks who teaches a subject (e.g. statistics), look it up with your tools.
- Like every SOM professor, you also have solid general knowledge of the core quant material: probability,
  the central limit theorem, standard errors, confidence intervals, hypothesis tests, t-statistics and
  p-values, regression (coefficients, R², omitted variable bias, overfitting), A/B tests, and machine learning
  and AI basics. If asked, explain these correctly with a small worked example or intuition, and when it's a
  question about a specific course's material, mention which course and professor cover it.
- For ANY question about courses at Yale SOM (yours or other professors'): when they meet, where, who teaches
  them, what they cover, what to take for a topic, use your tools to look it up. Never invent course numbers,
  times, rooms, or instructors. If the database doesn't have it, say so.

## How you talk
{style}

## Power-ups
{powerups}

## Rules
- This is a small chat window: keep replies to 2–6 sentences unless they ask you to explain or work
  something out. Plain text only: no markdown headings, no tables, no LaTeX. Write math inline, like
  t = (x̄ − μ) / (s / √n). Simple "-" bullet lines are fine.
- Stay in character. If someone sincerely asks, say you're an AI character inspired by the real professor,
  not the actual person. Don't make up personal facts beyond your bio.
- Be kind and age-appropriate: kids and parents may be playing. Help students learn rather than just
  handing over graded homework answers.

## Your courses (from the database)
{courses}

## Your bio (from the database)
{bio}
{background}"""


# ---------- tools: plain functions, shared by every professor


def search_courses(
    keywords: str | None = None,
    instructor: str | None = None,
    category: str | None = None,
    room: str | None = None,
    limit: int = 8,
) -> str:
    """Search Yale SOM courses this term. Every argument is optional; combine them to narrow down.

    Args:
        keywords: words that must all appear in the title, description, course number, or category (e.g. "regression", "negotiation", "MGT 802").
        instructor: part of the instructor's name (e.g. "Jensen").
        category: part of a category name (e.g. "Finance", "Artificial Intelligence", "Core", "EMBA").
        room: a room like "EVANS 4200" or "4200".
        limit: max courses to return (1-20).
    """
    rows = db.search_courses(keywords, instructor, category, room, limit)
    return json.dumps(rows, ensure_ascii=False) if rows else "No matching courses."


def get_course_details(course_number: str) -> str:
    """Full details for one course: description, instructor, every section's meeting time and room, syllabus link.

    Args:
        course_number: e.g. "MGT 409" (spacing and case don't matter).
    """
    rows = db.get_course(course_number)
    return json.dumps(rows, ensure_ascii=False) if rows else f"No course {course_number} in the database."


def list_course_categories() -> str:
    """List all course categories (Core, Finance, Marketing, ...) and how many courses each has."""
    return json.dumps(db.categories(), ensure_ascii=False)


@dataclass
class ChatDeps:
    professor_id: str
    quiz: quiz.QuizState


def get_power_up_question(ctx: RunContext[ChatDeps]) -> str:
    """Fetch the next question the student must answer to earn one of your power-ups.
    Returns the question, the power-up it unlocks, and a hint about where in Evans Hall the answer is hidden.
    It never includes the answer."""
    d = ctx.deps
    q = quiz.next_question(d.professor_id, d.quiz)
    if q is None:
        return "They've already earned every power-up you have. Congratulate them; there are none left."
    d.quiz.current = q.id
    d.quiz.tries = 0
    return json.dumps(
        {
            "question_id": q.id,
            "question": q.question,
            "power_up": {"name": q.power_up.name, "effect": q.power_up.description},
            "hint_location": q.hint,
        }
    )


def submit_answer(ctx: RunContext[ChatDeps], question_id: str, answer: str) -> str:
    """Grade the student's answer to a power-up question. Call this with their answer in their own
    words whenever they reply to a power-up question. If correct, the power-up is granted automatically.

    Args:
        question_id: the id from get_power_up_question.
        answer: the student's answer, verbatim.
    """
    d = ctx.deps
    q = quiz.find(d.professor_id, question_id)
    if q is None:
        return "No active power-up question."
    if q.id in d.quiz.solved:
        return "They already earned this one."
    if quiz.is_correct(q, answer):
        d.quiz.solved.add(q.id)
        d.quiz.current = None
        d.quiz.awarded.append(q.power_up)
        return json.dumps({"correct": True, "granted": q.power_up.name, "effect": q.power_up.description})
    d.quiz.tries += 1
    return json.dumps({"correct": False, "tries": d.quiz.tries, "hint_location": q.hint})


TOOLS = [search_courses, get_course_details, list_course_categories, get_power_up_question, submit_answer]

POWERUP_RULES = """\
Harvard zombies are invading Evans Hall and the student is fighting them off. You hold power-ups (weapons, spells,
shields, potions) and award them for correct answers to questions about your course material.
- When they ask for a power-up (or seem to want one), call get_power_up_question and ask that exact question in
  your own voice, saying which power-up is on the line. Never reveal or hint at the answer itself.
- If they ask for a hint, or get it wrong, tell them where in Evans Hall the answer is written down (hint_location).
  Be a little playful about it ("go check ...").
- Whenever they answer, call submit_answer with their words. Only submit_answer decides; never say they're
  right before it confirms. If it's correct, celebrate and tell them what the power-up does.
- Keep it short: they're in the middle of a zombie fight."""


# ---------- agents


@lru_cache(maxsize=1)
def _model() -> OpenAIResponsesModel:
    api_key = os.getenv("PORTKEY_API_KEY")
    if not api_key:
        raise RuntimeError("PORTKEY_API_KEY is missing; add it to the .env in the AI Foundations folder.")
    # Responses API: gpt-6-luna only allows tools + reasoning there, not on chat completions
    return OpenAIResponsesModel(MODEL_NAME, provider=OpenAIProvider(base_url=PORTKEY_BASE_URL, api_key=api_key))


def instructions_for(p: Persona) -> str:
    return BASE_INSTRUCTIONS.format(
        powerups=POWERUP_RULES,
        name=p.display_name,
        room=p.room,
        style=p.style,
        courses=json.dumps(db.courses_for_faculty(p.faculty_name), ensure_ascii=False, indent=1),
        bio=db.faculty_bio(p.faculty_name) or "(no bio on file)",
        background=f"\n## More about you (public web sources; share naturally, don't overclaim)\n{p.background}\n" if p.background else "",
    )


@lru_cache(maxsize=None)
def get_agent(professor_id: str) -> Agent[ChatDeps, str]:
    p = PERSONAS[professor_id]
    return Agent(_model(), deps_type=ChatDeps, output_type=str, instructions=instructions_for(p), tools=TOOLS, name=p.id)
