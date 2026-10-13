"""FastAPI backend: chat with the professors in the Evans Hall walk-through.

Run from this folder:  .venv/bin/uvicorn main:app --port 8000
The Vite dev server proxies /api to it.
"""

from __future__ import annotations

import logging
from collections import OrderedDict

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from pydantic_ai.messages import ModelMessage, ModelRequest, UserPromptPart

import db
import quiz
from agents import MODEL_NAME, ChatDeps, get_agent
from professors import PERSONAS

log = logging.getLogger("professors")

app = FastAPI(title="Evans Hall Professors")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# conversation history per (professor, browser session), kept in memory
MAX_SESSIONS = 500
MAX_MESSAGES = 60
sessions: OrderedDict[tuple[str, str], list[ModelMessage]] = OrderedDict()
quizzes: dict[tuple[str, str], quiz.QuizState] = {}  # power-up progress, same keys


def _trim(messages: list[ModelMessage]) -> list[ModelMessage]:
    """Drop the oldest turns, always starting the history at a user message so tool calls stay paired."""
    if len(messages) <= MAX_MESSAGES:
        return messages
    for i in range(len(messages) - MAX_MESSAGES, len(messages)):
        m = messages[i]
        if isinstance(m, ModelRequest) and any(isinstance(p, UserPromptPart) for p in m.parts):
            return messages[i:]
    return []


class ChatIn(BaseModel):
    professor_id: str
    session_id: str = Field(min_length=8, max_length=64)
    message: str = Field(min_length=1, max_length=4000)


class PowerUpOut(BaseModel):
    id: str
    name: str
    kind: str
    description: str


class ChatOut(BaseModel):
    reply: str
    power_ups: list[PowerUpOut] = []  # earned this turn


@app.get("/api/health")
def health():
    return {"ok": True, "model": MODEL_NAME}


@app.get("/api/professors")
def professors():
    return [
        {
            "id": p.id,
            "name": p.display_name,
            "room": p.room,
            "courses": [{"course_number": c["course_number"], "title": c["title"]} for c in db.courses_for_faculty(p.faculty_name)],
        }
        for p in PERSONAS.values()
    ]


@app.post("/api/chat", response_model=ChatOut)
async def chat(body: ChatIn):
    if body.professor_id not in PERSONAS:
        raise HTTPException(404, f"Unknown professor '{body.professor_id}'")
    key = (body.professor_id, body.session_id)
    history = sessions.get(key, [])
    state = quizzes.setdefault(key, quiz.QuizState())
    deps = ChatDeps(professor_id=body.professor_id, quiz=state)
    try:
        result = await get_agent(body.professor_id).run(body.message, message_history=history, deps=deps)
    except Exception as e:  # model/network errors: tell the UI without leaking details
        log.exception("chat failed")
        raise HTTPException(502, "The professor couldn't answer right now. Try again in a moment.") from e
    sessions[key] = _trim(result.all_messages())
    sessions.move_to_end(key)
    while len(sessions) > MAX_SESSIONS:
        old, _ = sessions.popitem(last=False)
        quizzes.pop(old, None)
    earned = [PowerUpOut(**vars(pu)) for pu in state.awarded]
    state.awarded.clear()
    return ChatOut(reply=result.output, power_ups=earned)
