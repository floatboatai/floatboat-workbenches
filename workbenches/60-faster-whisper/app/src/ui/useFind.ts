// ABOUTME: 字幕表查找替换：匹配列表（大小写/正则）、逐个定位到对白框、替换当前与全部替换。
import { useMemo, useState } from "react";
import { findMatches, replaceInCue, type Match } from "../contracts/edit";
import { transcriptDraft, type Cue } from "../contracts/transcript";
import type { ChangeData, Desk } from "./desk";

export function useFind(p: Desk, open: boolean, changeData: ChangeData, patchCue: (id: string, change: (cue: Cue) => Cue) => void, select: (id: string) => void) {
  const d = transcriptDraft(p.draft),
    data = p.data;
  const [matchIndex, setMatchIndex] = useState(0);
  const findOpen = open;
  const findOpts = { matchCase: d.matchCase, regex: d.regex };
  const { matches, findError } = useMemo(() => {
    try {
      return { matches: findOpen ? findMatches(data.cues, d.find, findOpts) : ([] as Match[]), findError: "" };
    } catch (e) {
      return { matches: [] as Match[], findError: e instanceof Error ? e.message : "查找无效。" };
    }
  }, [findOpen, data.cues, d.find, d.matchCase, d.regex]);
  const matchCounts = useMemo(() => {
    const m = new Map<string, number>();
    for (const x of matches) m.set(x.cue, (m.get(x.cue) ?? 0) + 1);
    return m;
  }, [matches]);
  const current = matches.length ? Math.min(matchIndex, matches.length - 1) : 0;
  function step(delta: number, focus = false) {
    if (!matches.length) return;
    const next = (current + delta + matches.length) % matches.length;
    setMatchIndex(next);
    const m = matches[next];
    select(m.cue);
    const row = document.getElementById(`cue-${m.cue}`);
    row?.scrollIntoView({ block: "center" });
    const area = row?.querySelector("textarea");
    if (area && focus) {
      area.focus();
      area.setSelectionRange(m.index, m.index + m.length);
    }
  }
  function replaceOne() {
    const m = matches[current];
    if (!m) return;
    try {
      patchCue(m.cue, (c) => replaceInCue(c, d.find, d.replace, findOpts, m));
    } catch (err) {
      p.report(err);
    }
  }
  function replaceAll() {
    try {
      const touched = new Set(matches.map((m) => m.cue));
      changeData((t) => ({ ...t, cues: t.cues.map((c) => (touched.has(c.id) ? replaceInCue(c, d.find, d.replace, findOpts) : c)) }));
      p.setNotice(`已在 ${touched.size} 句中替换 ${matches.length} 处，逐词时间已重对齐。`);
    } catch (err) {
      p.report(err);
    }
  }
  return { matches, findError, matchCounts, current, setMatchIndex, step, replaceOne, replaceAll };
}
