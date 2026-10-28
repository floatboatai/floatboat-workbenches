import { useEffect, useRef, useState } from "react";
import { useProjects, request, download } from "./workspace.tsx";
import { isRecord, boundedText } from "../contracts/project.ts";
import {
  seed,
  empty,
  observationValue,
  restoreObservation,
  candidateValue,
  analyze,
  csv,
  hostname,
  type Candidate,
} from "../contracts/observation.ts";
export function useObservation() {
  const p = useProjects(seed, observationValue, "港湾文档站 · 示例", {
    storageKey: "geoinflow-observation-v1",
    restoreDraftData: restoreObservation,
  });
  const [kind, setKind] = useState<"logs" | "pages">("logs"),
    [drawer, setDrawer] = useState(false),
    [busy, setBusy] = useState(false),
    [transitioning, setTransitioning] = useState(false),
    [view, setView] = useState("coverage"),
    [selected, setSelected] = useState("/docs/api"),
    [jsonOpen, setJsonOpen] = useState(false);
  const file = useRef<HTMLInputElement>(null),
    sourceFile = useRef<HTMLInputElement>(null),
    epoch = useRef(p.documentKey);
  epoch.current = p.documentKey;
  const format =
    typeof p.draft[kind + "Format"] === "string"
      ? String(p.draft[kind + "Format"])
      : "json";
  const text =
    typeof p.draft[kind + "Input"] === "string"
      ? String(p.draft[kind + "Input"])
      : JSON.stringify(kind === "logs" ? p.data.logs : p.data.pages, null, 2);
  let candidate: Candidate | null = null,
    candidateError = "";
  try {
    if (p.draft.candidate) candidate = candidateValue(p.draft.candidate);
  } catch {
    candidateError = "候选解析记录无法恢复，请重新解析；原始输入仍在。";
  }
  const transitionLock = useRef(false);
  function beginTransition() {
    if (transitionLock.current || p.loading || p.busy) return false;
    transitionLock.current = true;
    setTransitioning(true);
    return true;
  }
  const mutable = !p.loading && !p.busy && !transitioning;
  async function transition(action: () => Promise<boolean>) {
    if (!beginTransition()) return false;
    try {
      return await action();
    } finally {
      transitionLock.current = false;
      setTransitioning(false);
    }
  }
  useEffect(() => {
    setSelected("");
    setBusy(false);
  }, [p.documentKey]);
  const currentInput = useRef({ kind, domain: p.data.domain, format, text });
  currentInput.current = { kind, domain: p.data.domain, format, text };
  const input = () => currentInput.current;
  const fingerprint = async (value: unknown) =>
    Array.from(
      new Uint8Array(
        await crypto.subtle.digest(
          "SHA-256",
          new TextEncoder().encode(JSON.stringify(value)),
        ),
      ),
    )
      .map((x) => x.toString(16).padStart(2, "0"))
      .join("");
  async function parse() {
    const key = epoch.current;
    setBusy(true);
    p.setError("");
    try {
      const result = candidateValue(
        await request("/api/parse", {
          method: "POST",
          body: JSON.stringify(input()),
        }),
      );
      if (key === epoch.current)
        p.setDraft((d) => ({ ...d, candidate: result }));
    } catch (e) {
      if (key === epoch.current) p.report(e);
    } finally {
      if (key === epoch.current) setBusy(false);
    }
  }
  async function apply() {
    if (!candidate) return;
    const key = epoch.current;
    try {
      const snapshot = JSON.stringify(input());
      if (
        candidate.kind !== kind ||
        candidate.inputHash !== (await fingerprint(input())) ||
        JSON.stringify(input()) !== snapshot
      )
        throw new Error("输入或站点已改变，请重新解析后采用。");
      if (!candidate.accepted) throw new Error("没有有效记录可采用。");
      if (
        (kind === "logs" ? p.data.logs.length : p.data.pages.length) &&
        !confirm(
          `采用${candidate.accepted}条有效记录将替换当前${kind === "logs" ? "日志" : "内容清单"}，继续吗？`,
        )
      )
        return;
      if (epoch.current !== key) return;
      const records = candidate.records;
      p.setData((current) =>
        observationValue({
          ...current,
          [kind === "logs" ? "logs" : "pages"]: records,
        }),
      );
      p.setDraft((d) => {
        const out = { ...d };
        delete out.candidate;
        return out;
      });
      p.setError("");
      p.setNotice(
        `已采用${candidate.accepted}条记录${candidate.rejected ? `；${candidate.rejected}条无效输入仍保留在来源草稿中` : ""}。`,
      );
      setView(kind === "logs" ? "requests" : "coverage");
    } catch (e) {
      p.report(e);
    }
  }
  async function loadSource(f: File) {
    if (!beginTransition()) return;
    try {
      if (f.size > 550000) throw new Error("来源文件不能超过550KB。");
      const value = await f.text();
      if (value.length > 200000) throw new Error("来源输入不能超过20万字符。");
      p.setDraft((d) => ({ ...d, [kind + "Input"]: value }));
      p.setError("");
    } catch (e) {
      p.report(e);
    } finally {
      transitionLock.current = false;
      setTransitioning(false);
    }
  }
  function setText(value: string) {
    p.setDraft((d) => ({ ...d, [kind + "Input"]: value }));
  }
  function exportProject() {
    download(
      new Blob(
        [
          JSON.stringify(
            {
              format: "floatboat-geoinflow",
              version: 1,
              title: p.title,
              data: p.data,
              draft: p.draft,
            },
            null,
            2,
          ),
        ],
        { type: "application/json" },
      ),
      "geoinflow-project.json",
    );
  }
  async function importProject(f: File) {
    if (!beginTransition()) return;
    const key = epoch.current;
    try {
      if (f.size > 1900000) throw new Error("项目文件超过1.9MB。");
      const input: unknown = JSON.parse(await f.text());
      if (!isRecord(input)) throw new Error("不是观测项目或恢复草稿。");
      const recovery =
        isRecord(input.snapshot) && isRecord(input.snapshot.data);
      const raw = recovery
        ? {
            ...(input.snapshot as Record<string, unknown>),
            draft: (input.snapshot as Record<string, unknown>).extra,
          }
        : input;
      if (
        !recovery &&
        (raw.format !== "floatboat-geoinflow" || raw.version !== 1)
      )
        throw new Error("不是GEOInflow工作台项目。");
      const data = restoreObservation(raw.data),
        title = boundedText(raw.title, 120);
      if (epoch.current === key)
        await p.replace(data, title, isRecord(raw.draft) ? raw.draft : {});
    } catch (e) {
      p.report(e);
    } finally {
      transitionLock.current = false;
      setTransitioning(false);
    }
  }
  function exportCsv() {
    try {
      const a = analyze(p.data);
      let value: string;
      if (view === "coverage")
        value = csv(
          [
            "path",
            "title",
            "priority",
            "ai_ua_requests",
            "http_errors",
            "last_observed",
            "review_state",
            "owner",
            "note",
          ],
          a.pages.map((r) => [
            r.path,
            r.title,
            r.priority,
            r.hits,
            r.errors,
            r.last,
            r.note?.state,
            r.note?.owner,
            r.note?.text,
          ]),
        );
      else
        value = csv(
          [
            "time",
            "path",
            "method",
            "http_status",
            "bytes",
            "declared_bot",
            "declared_vendor",
            "purpose",
            "identity_verification",
            "ai_referral",
            "user_agent",
          ],
          a.logs
            .filter((r) => view !== "referrals" || r.referral)
            .map((r) => [
              r.time,
              r.path,
              r.method,
              r.status,
              r.bytes,
              r.bot.name,
              r.bot.vendor,
              r.bot.type,
              "not-performed",
              r.referral,
              r.userAgent,
            ]),
        );
      download(
        new Blob([value], { type: "text/csv;charset=utf-8" }),
        `geoinflow-${view}.csv`,
      );
    } catch (e) {
      p.report(e);
    }
  }
  function exportReport() {
    try {
      const a = analyze(p.data),
        host = hostname(p.data.domain);
      const text = [
        `# ${p.title}`,
        `站点：${host}；时区：${p.data.timezone}；范围：${p.data.filters.from || "全部开始"} 至 ${p.data.filters.to || "全部结束"}`,
        `导入观测请求 ${a.logs.length}，其中AI UA声明 ${a.ai.length}，HTTP错误 ${a.errors}，AI引荐声明请求 ${a.referrals.length}。`,
        a.pages.length
          ? `内容清单 ${a.pages.length} 页，其中 ${a.visited} 页观察到AI UA访问。`
          : "尚无内容清单，不能计算覆盖。",
        "UA与Referer来自导入日志，未独立进行IP/DNS身份验证。访问不等同收录、训练或模型答案引用。",
        ...a.pages.map(
          (r) =>
            `## ${r.title || r.path}\n${r.path} · 观测 ${r.hits} 次 · 错误 ${r.errors} 次\n${r.note ? `${r.note.owner} / ${r.note.state}\n${r.note.text}` : ""}`,
        ),
      ].join("\n\n");
      download(
        new Blob([text], { type: "text/markdown" }),
        "geoinflow-review.md",
      );
    } catch (e) {
      p.report(e);
    }
  }
  function patchNote(
    path: string,
    patch: { owner?: string; text?: string; state?: "todo" | "doing" | "done" },
  ) {
    p.setData((d) => {
      const old = d.notes.find((n) => n.path === path);
      if (!old && d.notes.length >= 100) {
        p.setError("最多100条处理记录。");
        return d;
      }
      return {
        ...d,
        notes: old
          ? d.notes.map((n) => (n.path === path ? { ...n, ...patch } : n))
          : [
              ...d.notes,
              { path, owner: "", text: "", state: "todo", ...patch },
            ],
      };
    });
  }
  return {
    p,
    kind,
    setKind,
    drawer,
    setDrawer,
    busy,
    view,
    setView,
    selected,
    setSelected,
    jsonOpen,
    setJsonOpen,
    file,
    sourceFile,
    format,
    text,
    candidate,
    candidateError,
    mutable,
    parse,
    apply,
    loadSource,
    setText,
    exportProject,
    importProject,
    exportCsv,
    exportReport,
    patchNote,
    newSite: () => transition(() => p.replace(empty, "新站点")),
    openSample: () => transition(() => p.replace(seed, "港湾文档站 · 示例")),
    openProject: (id: string) => transition(() => p.open(id)),
  };
}
