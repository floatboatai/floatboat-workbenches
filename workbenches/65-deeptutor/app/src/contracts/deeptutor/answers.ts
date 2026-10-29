// TypeScript port of DeepTutor `deeptutor/services/practice/answers.py`
// (HKUDS/DeepTutor @ a31d82624c27d75f4e771d4fcb78dce16470b383, Apache-2.0).
// Conservative objective grading; prose and qualitative work uses self-assessment.
import {
  PY_SPACE,
  codePoints,
  loadsJson,
  pyStr,
  splitWhitespace,
  strip,
  truthy,
} from "./pycompat.ts";

const SEPARATORS = new RegExp(`[,;，；${PY_SPACE}]+`, "u");
const SUBJECTIVE = ["qualitative", "short_answer", "essay", "free_response"];

export function checkAnswer(
  entry: Record<string, unknown>,
  answer: string,
): boolean | null {
  const kind = Object.hasOwn(entry, "question_type") ? entry.question_type : "";
  const options = (
    truthy(entry.options)
      ? entry.options
      : loadsJson(truthy(entry.options_json) ? String(entry.options_json) : "{}")
  ) as Record<string, unknown>;
  const expected = strip(
    truthy(entry.correct_answer) ? pyStr(entry.correct_answer) : "",
  );
  if (!truthy(options) || !expected || SUBJECTIVE.includes(kind as string))
    return null;

  const folded = (text: string) =>
    splitWhitespace(strip(text).toUpperCase()).join(" ");
  const optionKeys = Object.keys(options);
  const keys = (value: string): Set<string> => {
    for (const [key, raw] of Object.entries(options)) {
      const text = pyStr(raw);
      if (
        [
          folded(key),
          folded(text),
          folded(`${key}. ${text}`),
          folded(`${key}) ${text}`),
        ].includes(folded(value))
      )
        return new Set([key]);
    }
    let parts = new Set(
      value
        .split(SEPARATORS)
        .filter((part) => strip(part))
        .map((part) => strip(part).toUpperCase()),
    );
    if (
      (kind === "multi_choice" || kind === "multiple_select") &&
      parts.size === 1 &&
      ![...parts].every((p) => optionKeys.includes(p))
    )
      parts = new Set(codePoints(strip(value).toUpperCase()));
    return parts;
  };
  const expectedKeys = keys(expected),
    actualKeys = keys(answer);
  if (
    !expectedKeys.size ||
    ![...expectedKeys].every((k) => optionKeys.includes(k))
  )
    return null; // A malformed legacy answer key must never invent a grade.
  return (
    actualKeys.size > 0 &&
    actualKeys.size === expectedKeys.size &&
    [...actualKeys].every((k) => expectedKeys.has(k))
  );
}
