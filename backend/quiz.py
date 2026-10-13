"""Power-up quizzes.

Each professor holds power-ups. A student earns one by answering a course question. The answer is
graded here on the server (keyword match), never by the model, so a chatty student can't talk an
agent into handing out power-ups. Every question has a hint: the spot in Evans Hall where a study
note with the answer is hidden (the frontend places those notes; ids must match src/notes.js).
"""

from __future__ import annotations

import re
from dataclasses import dataclass, field


@dataclass(frozen=True)
class PowerUp:
    id: str  # the frontend applies it by id (src/Rivals.jsx POWER_UPS)
    name: str
    kind: str  # 'weapon' | 'spell' | 'shield' | 'heal' | 'slow' | 'summon'
    description: str


@dataclass(frozen=True)
class Question:
    id: str
    question: str
    answers: tuple[str, ...]  # any of these phrases (normalized) counts as correct
    hint: str  # where in Evans Hall the answer is written down
    power_up: PowerUp


QUIZZES: dict[str, list[Question]] = {
    "zaman": [
        Question(
            "z1",
            "When a large language model confidently states something that's false or made up, what do we call that?",
            ("hallucination", "hallucinate", "hallucinating"),
            "a study note pinned to the tall bookshelves along the west wall of Ross Library",
            PowerUp("labubu_chainsaw", "Labubu Chainsaw", "weapon", "Your bonks do 4x damage with extra reach for 40 seconds."),
        ),
        Question(
            "z2",
            "What's the name of the small chunk of text, roughly three-quarters of a word, that an LLM actually reads and writes?",
            ("token",),
            "a note on the table in the west-most glass meeting room along the south wall",
            PowerUp("token_storm", "Token Storm", "spell", "2 spell charges: press F to blast every zombie near you."),
        ),
        Question(
            "z3",
            "What do we call the instructions given to an LLM before the user's message, which set its role and rules?",
            ("system prompt", "system message", "system instructions", "instructions"),
            "a note on one of the round tables in the Beinecke Terrace Room (east end), the north one by the windows",
            PowerUp("overfit_shield", "Overfit Shield", "shield", "A shield that soaks up 60 damage."),
        ),
        Question(
            "z4",
            "When a model memorizes its training data and then does badly on new data, what's that called?",
            ("overfitting", "overfit", "over fitting", "over-fitting"),
            "a note on the lectern at the front of classroom 2430 (Baker Classroom)",
            PowerUp("agent_army", "Agent Army", "summon", "Four more Yale students join your squad."),
        ),
        Question(
            "z5",
            "When an AI agent needs to search a database or take an action, what does it call?",
            ("tool", "tools", "tool call", "function call", "function", "api"),
            "a note on the table in the east-most glass meeting room along the north wall",
            PowerUp("hallucination_hex", "Hallucination Hex", "spell", "3 spell charges: press F to blast every zombie near you."),
        ),
    ],
    "schott": [
        Question(
            "s1",
            "By the central limit theorem, as the sample size grows, the distribution of the sample mean looks more and more like what?",
            ("normal", "bell curve", "bell shaped", "bell-shaped", "gaussian"),
            "a note on the lectern at the front of classroom 2420 (Betts Classroom)",
            PowerUp("bell_curve_blast", "Bell Curve Blast", "spell", "2 spell charges: press F to blast every zombie near you."),
        ),
        Question(
            "s2",
            "The standard error of a sample mean is the standard deviation divided by the square root of what?",
            ("n", "sample size", "number of observations", "the sample size", "number of data points"),
            "a study note on top of the low bookshelf at the north end of Ross Library",
            PowerUp("confidence_interval_shield", "Confidence Interval Shield", "shield", "A shield that soaks up 80 damage."),
        ),
        Question(
            "s3",
            "A correlation coefficient can go as low as -1. What's the highest it can go?",
            ("1", "one", "+1", "positive one", "1.0"),
            "a note on the table in the middle glass meeting room along the south wall",
            PowerUp("plain_english_potion", "Plain-English Potion", "heal", "Restores 60 health."),
        ),
        Question(
            "s4",
            "Ordinary linear regression picks the line that minimizes the sum of what?",
            ("squared errors", "squared residuals", "squares", "squared", "least squares", "sum of squares", "residuals squared", "errors squared"),
            "a note on one of the round tables in the Beinecke Terrace Room (east end), the south one by the windows",
            PowerUp("regression_ray", "Regression Ray", "weapon", "Your bonks do 3x damage from up to 5 meters away for 45 seconds."),
        ),
        Question(
            "s5",
            "In plain English, p < 0.05 means the result would be pretty unlikely if the true effect were what?",
            ("zero", "0", "nothing", "no effect", "none", "null"),
            "a note on the lectern at the front of classroom 2410 (Bewkes Classroom)",
            PowerUp("long_problem_set", "The Long Problem Set", "slow", "Every zombie slows to a crawl for 25 seconds (they stop to read it)."),
        ),
    ],
}


def _norm(text: str) -> str:
    text = text.lower().replace("√", " ").replace("-", " ")
    return " " + re.sub(r"[^a-z0-9+.]+", " ", text).strip() + " "


def is_correct(q: Question, answer: str) -> bool:
    a = _norm(answer)
    for ok in q.answers:
        n = _norm(ok)
        # short answers ("n", "1") must be whole words; longer ones may carry an ending ("hallucinations")
        if (n in a) if len(n.strip()) <= 2 else (n.rstrip() in a):
            return True
    return False


@dataclass
class QuizState:
    """Per browser session, per professor."""

    solved: set[str] = field(default_factory=set)
    current: str | None = None
    tries: int = 0
    awarded: list[PowerUp] = field(default_factory=list)  # handed to the frontend with the next reply


def next_question(professor_id: str, state: QuizState) -> Question | None:
    for q in QUIZZES.get(professor_id, []):
        if q.id not in state.solved:
            return q
    return None


def find(professor_id: str, question_id: str) -> Question | None:
    return next((q for q in QUIZZES.get(professor_id, []) if q.id == question_id), None)
