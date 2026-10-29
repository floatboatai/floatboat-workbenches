// ABOUTME: 可选 Floatboat 模型通道（界面侧）：可用性检查、人设改写与报告深化建议，确认后才写入推演。
import { useState, type MutableRefObject } from "react";
import { request } from "./requests";
import { isRecord } from "../contracts/project";
import { SILENT_TYPES, clamp, type RunRecord, type Scenario } from "../contracts/scenario";
import type { SimResult } from "../contracts/engine";
import type { useWorkbenchState } from "./autosave-client";

export type PersonaSuggestion = {
  model: string;
  personas: Array<{ entityId: string; bio: string; persona: string; profession: string; stance: number; activity: number; topics: string[] }>;
};
const str = (v: unknown, d = "") => (typeof v === "string" ? v : d);
type Deps = {
  p: ReturnType<typeof useWorkbenchState<Scenario>>;
  epoch: MutableRefObject<string>;
  setIo: (v: string) => void;
  activeRun: RunRecord | undefined;
  result: SimResult | undefined;
  discard: (key: string) => void;
};
export function useHostModel({ p, epoch, setIo, activeRun, result, discard }: Deps) {
  const s = p.data;
  const [model, setModel] = useState({ available: false, model: "", checked: false });
  async function checkModel() {
    try {
      const v = await request("/api/model-status");
      setModel({ available: isRecord(v) && v.available === true, model: isRecord(v) ? str(v.model) : "", checked: true });
    } catch {
      setModel({ available: false, model: "", checked: true });
    }
  }
  const personaSuggestion: PersonaSuggestion | null = isRecord(p.draft.personaSuggestion) && Array.isArray(p.draft.personaSuggestion.personas) ? (p.draft.personaSuggestion as unknown as PersonaSuggestion) : null;
  const reportSuggestion = isRecord(p.draft.reportSuggestion) && typeof p.draft.reportSuggestion.markdown === "string" ? { markdown: p.draft.reportSuggestion.markdown, model: str(p.draft.reportSuggestion.model) } : null;
  async function hostPersonas() {
    const doc = epoch.current;
    setIo("Floatboat 模型正在写人设…");
    try {
      const entities = s.entities.filter((e) => !SILENT_TYPES.includes(e.type)).slice(0, 60);
      const v = await request("/api/host/personas", {
        method: "POST",
        body: JSON.stringify({ id: crypto.randomUUID(), question: s.question, topic: s.topic, aspects: s.aspects.map((a) => a.label), excerpt: s.seeds.map((d) => d.text).join("\n\n").slice(0, 6000), entities: entities.map(({ id, name, type, summary, stance }) => ({ id, name, type, summary, stance })) }),
      });
      if (doc !== epoch.current) return;
      if (!isRecord(v) || !Array.isArray(v.personas)) throw new Error("模型返回格式无效");
      p.setDraft((d) => ({ ...d, personaSuggestion: { model: str(v.model), personas: v.personas } }));
    } catch (e) {
      if (doc === epoch.current) p.report(e);
    } finally {
      setIo("");
    }
  }
  function applyPersonas() {
    if (!personaSuggestion) return;
    const by = new Map(personaSuggestion.personas.map((x) => [x.entityId, x]));
    p.setData((d) => ({
      ...d,
      agents: d.agents.map((a) => {
        const x = by.get(a.entityId);
        if (!x) return a;
        const entity = d.entities.find((e) => e.id === a.entityId);
        const shift = x.stance - (entity?.stance ?? 0);
        return { ...a, bio: x.bio || a.bio, persona: x.persona || a.persona, profession: x.profession || a.profession, stance: Math.round(clamp(a.stance + shift) * 1000) / 1000, activity: x.activity, topics: x.topics.length ? x.topics : a.topics, source: "host" as const };
      }),
    }));
    discard("personaSuggestion");
    p.setNotice("已采用模型人设；数值参数可继续手动调整。");
  }
  async function hostReport() {
    if (!activeRun || !result) return p.setError("先完成一次推演并等待结果载入。");
    if (s.report.runId !== activeRun.id) return p.setError("报告与当前运行不一致，请先按当前运行重新生成报告。");
    if (!s.report.markdown.trim()) return p.setError("先生成规则报告，模型在其基础上深化。");
    const doc = epoch.current;
    setIo("Floatboat 模型正在深化报告…");
    try {
      const metrics = JSON.stringify(result.rounds.map((r) => ({ round: r.round, mean: r.mean, support: r.support, oppose: r.oppose, polarization: r.polarization, posts: r.posts })));
      const v = await request("/api/host/report", { method: "POST", body: JSON.stringify({ id: crypto.randomUUID(), question: s.question, draft: s.report.markdown, metrics }) });
      if (doc !== epoch.current) return;
      if (!isRecord(v) || typeof v.markdown !== "string") throw new Error("模型返回格式无效");
      p.setDraft((d) => ({ ...d, reportSuggestion: { markdown: v.markdown, model: str(v.model) } }));
    } catch (e) {
      if (doc === epoch.current) p.report(e);
    } finally {
      setIo("");
    }
  }
  function applyReport() {
    if (!reportSuggestion || !activeRun) return;
    p.setData((d) => ({ ...d, report: { runId: activeRun.id, markdown: reportSuggestion.markdown, source: "host", updatedAt: new Date().toISOString() } }));
    discard("reportSuggestion");
  }
  return { model, checkModel, personaSuggestion, hostPersonas, applyPersonas, reportSuggestion, hostReport, applyReport };
}
