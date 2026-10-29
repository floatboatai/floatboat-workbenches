"""Record the pinned DeepTutor practice modules' outputs for the TypeScript port.

Run with Python 3.12 (standard library only):

    python3 -I workbenches/65-deeptutor/reference/make_parity_fixtures.py

It writes app/tests/fixtures/python-parity.json. app/tests/parity.test.ts feeds
the same inputs to app/src/contracts/deeptutor/*.ts and requires identical results.
"""
from __future__ import annotations

import json
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE / "deeptutor-practice"))

from answers import check_answer  # noqa: E402
from importing import normalize_question, preview  # noqa: E402
from scheduler import day_bounds, schedule  # noqa: E402

ROW = {
    "question": "哪个类型可以去重？",
    "question_type": "single_choice",
    "options": {"A": "list", "B": "set"},
    "correct_answer": "B",
    "explanation": "集合元素唯一",
    "tags": ["集合"],
}

BANKS: list[tuple[str, str, str]] = [
    ("json-basic", "questions.json", json.dumps([ROW], ensure_ascii=False)),
    ("json-bom", "questions.json", "﻿" + json.dumps([ROW])),
    (
        "json-mixed-types",
        "questions.json",
        json.dumps(
            [
                {**ROW, "question_type": "多选题", "options": ["append", "sort", "sorted", "len"], "correct_answer": "ab"},
                {"题目": "set 会保留重复元素。", "题型": "判断", "答案": "错", "解析": "set 元素唯一", "标签": "集合;Python"},
                {"question": "len([1, 2, 3]) 的结果是 ___", "type": "fill_blank", "answer": " 3 ", "difficulty": 1},
                {"question": "解释 return 与 print 的区别", "answer": "return 交还结果", "tags": "函数，返回值，函数"},
                {"question": "哪个是不可变序列？", "options": "{\"a\": \"list\", \"b\": \"tuple\"}", "answer": "tuple"},
                {"question": "Pick", "A": "one", "B": "two", "选项c": "three", "answer": "c"},
                {"question": "Pick many", "type": "MULTI_CHOICE", "options": {"A": "x", "B": "y", "C": "z"}, "answer": "C; a"},
                {"question": "Float answer", "answer": 2.0, "difficulty": 1e20},
                {"question": "Bool answer", "answer": True, "tags": [1, None, "", "x", "x"]},
                {"question": "  spaced　", "answer": " ok ", "explanation": None},
            ],
            ensure_ascii=False,
        ),
    ),
    (
        "json-row-errors",
        "questions.json",
        json.dumps(
            [
                ROW,
                {"question": "missing answer"},
                {**ROW, "question_type": "unknown"},
                {**ROW, "options": {"A": "only"}},
                {**ROW, "correct_answer": "Z"},
                {**ROW, "question_type": "true_false", "correct_answer": "maybe"},
                {**ROW, "options": {k: k for k in "ABCDEFGHIJK"}},
                {**ROW, "tags": [str(i) for i in range(21)]},
                {**ROW, "question_type": "single_choice", "correct_answer": "A,B"},
                {**ROW, "question": "x" * 20001},
            ],
            ensure_ascii=False,
        ),
    ),
    ("json-not-array", "questions.json", json.dumps({"question": "x"})),
    ("json-empty", "questions.json", "[]"),
    ("csv-chinese", "questions.csv", "题目,题型,A,B,答案\n哪一个正确,单选,一,二,B\n"),
    (
        "csv-quoted",
        "questions.csv",
        'question,options,answer,explanation\r\n"Which, with comma?","[""yes"",""no""]",A,"line one\r\nline two"\r\n"Tuple ""immutable""?",,true,\r\n',
    ),
    ("csv-semicolon", "questions.csv", "question;type;a;b;c;answer\nWhich keeps order?;单选;set;list;dict;B\nWhich are mutable?;多选;list;tuple;dict;a,c\n"),
    ("tsv-basic", "questions.tsv", "question\ttype\tanswer\ttags\nExplain recursion\tshort_answer\tA function calling itself\trecursion, functions\n\n\nIs 0 falsy?\ttrue_false\tyes\t\n"),
    ("csv-dup-header", "questions.csv", "question,Question,answer\nx,y,z\n"),
    ("csv-single-column", "questions.csv", "question\nhello\n"),
    ("csv-ragged", "questions.csv", "question,answer,a,b\nshort row,A\nlong row,A,one,two,three,four\n"),
    ("csv-unclosed-quote", "questions.csv", 'question,answer\n"never closed,A\n'),
    ("csv-lone-cr", "questions.csv", "question,answer\rQ1,A1\rQ2,A2"),
    ("csv-space-after-comma", "questions.csv", 'question, answer, explanation\n"Q1", "A1", "E1"\n"Q2", "A2", "E2"\n'),
    ("csv-header-only", "questions.csv", "question,answer\n"),
    ("unsupported", "questions.txt", "question,answer\n"),
]


def run_bank(name: str, filename: str, text: str) -> dict:
    try:
        return {"name": name, "filename": filename, "text": text, "result": preview(text.encode(), filename)}
    except (ValueError, TypeError) as exc:
        return {"name": name, "filename": filename, "text": text, "error": str(exc)}


CHECKS: list[tuple[dict, str]] = []
single = normalize_question(ROW)
multi = normalize_question({**ROW, "question_type": "multi_choice", "options": {"A": "append", "B": "sort", "C": "sorted"}, "correct_answer": "A,B"})
truth = normalize_question({**ROW, "question_type": "true_false", "correct_answer": "对"})
short = normalize_question({**ROW, "question_type": "short_answer", "options": {}, "correct_answer": "说明集合性质"})
blank = normalize_question({"question": "len([1,2]) = ___", "question_type": "fill_blank", "correct_answer": "2"})
for answer in ["B", "b", " set ", "B. set", "B) set", "A", "", "A,B", "SET"]:
    CHECKS.append((single, answer))
for answer in ["A,B", "B,A", "ab", "a b", "A", "A,B,C", "A；B", "append", "BA"]:
    CHECKS.append((multi, answer))
for answer in ["T", "t", "True", "F", "false"]:
    CHECKS.append((truth, answer))
CHECKS += [(short, "我的解释"), (blank, "2")]
CHECKS.append(({"question_type": "single_choice", "options_json": "{\"A\": \"x\", \"B\": \"y\"}", "correct_answer": "B"}, "y"))
CHECKS.append(({"question_type": "single_choice", "options": {"A": "x"}, "correct_answer": "Z"}, "Z"))

SCHEDULES: list[tuple[dict, str, float]] = []
state: dict = {}
now = 1793156400.0
for rating in ["good", "good", "hard", "again", "good", "easy", "easy", "easy", "easy", "easy"]:
    SCHEDULES.append((dict(state), rating, now))
    state = schedule(state, rating, now)
    now = state["due_at"]
SCHEDULES += [
    ({"interval_days": 1.0625, "ease": 2.5, "review_count": 3}, "hard", 1793156400),
    ({"interval_days": 7.05, "ease": 2.35, "review_count": 2, "version": 2}, "good", 1793156400),
    ({"interval_days": 300, "ease": 3.0, "review_count": 9}, "easy", 1793156400),
    ({}, "easy", 1793156400),
    ({"ease": 1.3}, "again", 1793156400),
]


def main() -> None:
    fixture = {
        "source": "HKUDS/DeepTutor a31d82624c27d75f4e771d4fcb78dce16470b383 deeptutor/services/practice",
        "python": sys.version.split()[0],
        "banks": [run_bank(*bank) for bank in BANKS],
        "checks": [{"entry": entry, "answer": answer, "result": check_answer(entry, answer)} for entry, answer in CHECKS],
        "schedules": [{"state": s, "rating": r, "now": n, "result": schedule(s, r, n)} for s, r, n in SCHEDULES],
        "dayBounds": [
            {"timezone": tz, "now": n, "result": list(day_bounds(tz, n))}
            for tz, n in [("America/New_York", 1793548800), ("Asia/Shanghai", 1793156400), ("Europe/Berlin", 1792886400)]
        ],
    }
    out = HERE.parent / "app" / "tests" / "fixtures" / "python-parity.json"
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(json.dumps(fixture, ensure_ascii=False, indent=1) + "\n", encoding="utf-8")
    print(f"wrote {out} ({len(fixture['banks'])} banks, {len(fixture['checks'])} checks, {len(fixture['schedules'])} schedules)")


if __name__ == "__main__":
    main()
