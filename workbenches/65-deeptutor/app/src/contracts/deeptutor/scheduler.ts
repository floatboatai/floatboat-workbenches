// TypeScript port of DeepTutor `deeptutor/services/practice/scheduler.py`
// (HKUDS/DeepTutor @ a31d82624c27d75f4e771d4fcb78dce16470b383, Apache-2.0).
// Deterministic, daily spaced repetition with adaptive recall intervals. This is
// an SM-2-style cold-start policy, not a fitted FSRS model. Review events are
// retained so a future scheduler can replay them without losing evidence.
import { PyValueError, pyRound, truthy } from "./pycompat.ts";

export const DAY = 86400;
export type Rating = "again" | "hard" | "good" | "easy";
export interface ScheduleState {
  interval_days: number;
  ease: number;
  streak: number;
  lapses: number;
  due_at: number;
  last_review_at: number;
  review_count: number;
  version: number;
}

/** Local-midnight bounds (seconds) of the day containing `now` in an IANA zone. */
export function dayBounds(timezone: string, now: number): [number, number] {
  let format: Intl.DateTimeFormat;
  try {
    format = new Intl.DateTimeFormat("en-US", {
      timeZone: timezone,
      hourCycle: "h23",
      year: "numeric",
      month: "numeric",
      day: "numeric",
      hour: "numeric",
      minute: "numeric",
      second: "numeric",
    });
  } catch {
    throw new PyValueError("Unknown timezone");
  }
  const parts = (ms: number) =>
    Object.fromEntries(
      format.formatToParts(ms).map((p) => [p.type, Number(p.value)]),
    );
  // Construct both midnights: a local day is not necessarily 24 hours (DST).
  const midnight = (y: number, m: number, d: number) => {
    const target = Date.UTC(y, m - 1, d);
    let guess = target;
    for (let i = 0; i < 3; i++) {
      const p = parts(guess);
      guess -=
        Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second) -
        target;
    }
    return guess / 1000;
  };
  const today = parts(now * 1000);
  const next = new Date(Date.UTC(today.year, today.month - 1, today.day + 1));
  return [
    midnight(today.year, today.month, today.day),
    midnight(next.getUTCFullYear(), next.getUTCMonth() + 1, next.getUTCDate()),
  ];
}

const num = (state: Record<string, unknown>, key: string, fallback: number) =>
  Object.hasOwn(state, key) ? Number(state[key]) : fallback;

export function schedule(
  state: Record<string, unknown>,
  rating: string,
  now: number,
): ScheduleState {
  let interval = num(state, "interval_days", 1);
  let ease = num(state, "ease", 2.5);
  let streak = Math.trunc(num(state, "streak", 0));
  let lapses = Math.trunc(num(state, "lapses", 0));
  if (rating === "again") {
    interval = 10 / 1440;
    streak = 0;
    lapses += 1;
    ease = Math.max(1.3, ease - 0.2);
  } else if (rating === "hard") {
    interval = Math.max(1.0, interval * 1.2);
    ease = Math.max(1.3, ease - 0.15);
    streak = 0;
  } else if (rating === "good" || rating === "easy") {
    interval =
      interval <= 1 || !truthy(state.review_count) ? 3.0 : interval * ease;
    if (rating === "easy") {
      interval *= 1.3;
      ease = Math.min(3.0, ease + 0.15);
    }
    streak += 1;
  } else throw new PyValueError("Unknown review rating");
  interval = Math.min(365.0, pyRound(interval, 3));
  return {
    interval_days: interval,
    ease,
    streak,
    lapses,
    due_at: now + interval * DAY,
    last_review_at: now,
    review_count: Math.trunc(num(state, "review_count", 0)) + 1,
    version: Math.trunc(num(state, "version", 0)) + 1,
  };
}
