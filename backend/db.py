"""Read-only lookups over data/yale_som.db (one table: courses, one row per section)."""

from __future__ import annotations

import re
import sqlite3
from pathlib import Path

DB_PATH = Path(__file__).resolve().parent.parent / "data" / "yale_som.db"

# columns worth showing an agent; faculty_1_email is empty and old_syllabus is noise
FIELDS = (
    "course_number, course_title, course_category, course_type, course_session, course_description, "
    "faculty_1, faculty_bio, daytimes, room, section, units, term_code, syllabus"
)


def _query(sql: str, params: tuple = ()) -> list[dict]:
    con = sqlite3.connect(f"file:{DB_PATH}?mode=ro", uri=True)
    con.row_factory = sqlite3.Row
    try:
        return [dict(r) for r in con.execute(sql, params)]
    finally:
        con.close()


def _norm_number(course_number: str) -> str:
    """'mgt409', 'MGT-409', 'MGT 409' -> 'MGT409' for matching."""
    return re.sub(r"[^A-Z0-9]", "", course_number.upper())


def _group(rows: list[dict], with_description: bool) -> list[dict]:
    """Collapse sections of the same course into one entry with a list of meetings."""
    out: dict[tuple, dict] = {}
    for r in rows:
        key = (r["course_number"], r["course_title"], r["faculty_1"])
        c = out.get(key)
        if c is None:
            c = out[key] = {
                "course_number": r["course_number"],
                "title": r["course_title"],
                "category": r["course_category"] or None,
                "type": r["course_type"] or None,
                "session": r["course_session"] or None,
                "instructor": r["faculty_1"] or None,
                "units": r["units"] or None,
                "syllabus": r["syllabus"] or None,
                "sections": [],
            }
            if with_description:
                c["description"] = r["course_description"] or None
            else:
                desc = r["course_description"] or ""
                c["summary"] = desc[:280] + ("…" if len(desc) > 280 else "")
        c["sections"].append(
            {"section": r["section"], "meets": r["daytimes"] or "not scheduled", "room": r["room"] or "TBA"}
        )
    return list(out.values())


def courses_for_faculty(faculty_name: str) -> list[dict]:
    """Every course a professor teaches, full descriptions included. faculty_name is 'Last, First'."""
    rows = _query(f"SELECT {FIELDS} FROM courses WHERE faculty_1 = ? ORDER BY course_number, section", (faculty_name,))
    return _group(rows, with_description=True)


def faculty_bio(faculty_name: str) -> str:
    rows = _query("SELECT faculty_bio FROM courses WHERE faculty_1 = ? AND faculty_bio <> '' LIMIT 1", (faculty_name,))
    return rows[0]["faculty_bio"] if rows else ""


def search_courses(
    keywords: str | None = None,
    instructor: str | None = None,
    category: str | None = None,
    room: str | None = None,
    limit: int = 8,
) -> list[dict]:
    where, params = [], []
    for word in (keywords or "").split():
        where.append("(course_title LIKE ? OR course_description LIKE ? OR course_number LIKE ? OR course_category LIKE ?)")
        params += [f"%{word}%"] * 4
    if instructor:
        where.append("faculty_1 LIKE ?")
        params.append(f"%{instructor}%")
    if category:
        where.append("course_category LIKE ?")
        params.append(f"%{category}%")
    if room:
        where.append("REPLACE(UPPER(room), ' ', '') LIKE ?")
        params.append(f"%{_norm_number(room)}%")
    sql = f"SELECT {FIELDS} FROM courses"
    if where:
        sql += " WHERE " + " AND ".join(where)
    sql += " ORDER BY course_number, section"
    return _group(_query(sql, tuple(params)), with_description=False)[: max(1, min(limit, 20))]


def get_course(course_number: str) -> list[dict]:
    rows = _query(
        f"SELECT {FIELDS} FROM courses WHERE REPLACE(REPLACE(UPPER(course_number), ' ', ''), '-', '') = ? ORDER BY section",
        (_norm_number(course_number),),
    )
    return _group(rows, with_description=True)


def categories() -> list[dict]:
    return _query(
        "SELECT course_category AS category, COUNT(DISTINCT course_number) AS courses FROM courses "
        "WHERE course_category <> '' GROUP BY course_category ORDER BY courses DESC"
    )
