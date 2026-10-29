// ABOUTME: 第 1 步「资料」：资料正文（可导入文件）、听众/目标/页数/密度设定、实时识别摘要；本地生成大纲为主操作，Floatboat 模型起草为可选通道。
import { useDeferredValue, useMemo, useRef, useState } from "react";
import { ArrowRight, FileUp, RefreshCw, Sparkles } from "lucide-react";
import { BRIEF_ACCEPT, briefFromFile } from "../contracts/brief-import";
import { parseBrief } from "../contracts/brief";
import { outlineFromBrief } from "../contracts/generate";
import { SAMPLE_AUDIENCE, SAMPLE_BRIEF, SAMPLE_OBJECTIVE } from "../contracts/sample-brief";
import { isRecord } from "../contracts/project";
import type { Brief } from "../contracts/model";
import { parseModelOutline } from "../contracts/model-outline";
import type { Doc, Step } from "./App";
import { useModelStatus } from "./channels";
import { request } from "./requests";
import { ConfirmBar } from "./ConfirmBar";

export function BriefStep({ doc, go }: { doc: Doc; go: (s: Step) => void }) {
  const brief = doc.data.brief;
  const set = <K extends keyof Brief>(key: K, value: Brief[K]) => doc.setData((d) => ({ ...d, brief: { ...d.brief, [key]: value } }));
  const deferred = useDeferredValue(brief);
  const preview = useMemo(() => {
    const parsed = parseBrief(deferred.source);
    const outline = deferred.source.trim() ? outlineFromBrief(deferred).items : [];
    const tables = parsed.sections.reduce((n, s) => n + [...s.blocks, ...s.parts.flatMap((p) => p.blocks)].filter((b) => b.kind === "table").length, 0);
    return { sections: parsed.sections.length, tables, pages: outline.length, layouts: [...new Set(outline.map((o) => o.layout))].length };
  }, [deferred]);
  const file = useRef<HTMLInputElement>(null);
  const [confirm, setConfirm] = useState<"" | "local" | "model">("");
  const [drafting, setDrafting] = useState(false);
  const model = useModelStatus();
  const hasOutline = doc.data.outline.length > 0;

  function generate() {
    if (!brief.source.trim()) return doc.setError("先写入或导入资料，再生成大纲。");
    const r = outlineFromBrief(brief);
    doc.setData((d) => ({ ...d, outline: r.items }));
    doc.setDraft((d) => ({ ...d, step: "outline", activeItem: r.items[0]?.id ?? "", generationLog: r.log }));
    doc.setNotice(`已按资料生成 ${r.items.length} 页大纲（本地确定性生成，未发送任何内容）。`);
    setConfirm("");
    go("outline");
  }
  async function draftWithModel() {
    setConfirm("");
    setDrafting(true);
    const key = doc.documentKey;
    try {
      const v = await request("/api/outline/draft", { method: "POST", body: JSON.stringify({ brief }) });
      if (!isRecord(v) || !Array.isArray(v.items)) throw new Error("模型返回格式无效。");
      const items = parseModelOutline(JSON.stringify({ slides: v.items }));
      if (key !== doc.documentKey) return;
      doc.setDraft((d) => ({ ...d, modelCandidate: { items, model: typeof v.model === "string" ? v.model : "" }, step: "outline" }));
      doc.setNotice(`Floatboat 模型起草了 ${items.length} 页大纲，可在大纲页对照后采用。`);
      go("outline");
    } catch (e) {
      doc.report(e);
    } finally {
      setDrafting(false);
    }
  }
  async function importFile(f: File) {
    try {
      const text = await briefFromFile(f.name, new Uint8Array(await f.arrayBuffer()));
      set("source", brief.source.trim() ? `${brief.source.trimEnd()}\n\n${text}` : text);
      doc.setNotice(`已读入「${f.name}」${brief.source.trim() ? "并追加到资料末尾" : ""}。`);
    } catch (e) {
      doc.report(e);
    }
  }

  return (
    <div className="brief-step">
      <section className="brief-paper" aria-labelledby="brief-heading">
        <div className="paper-head">
          <h1 id="brief-heading">资料简报</h1>
          <span className="count">{brief.source.length.toLocaleString()} 字</span>
          <button type="button" className="ghost" onClick={() => file.current?.click()}>
            <FileUp size={15} aria-hidden="true" />
            读入文件
          </button>
          <input ref={file} type="file" hidden accept={BRIEF_ACCEPT} onChange={(e) => {
            const f = e.target.files?.[0];
            e.target.value = "";
            if (f) void importFile(f);
          }} />
        </div>
        <label className="sr-only" htmlFor="brief-source">
          资料正文
        </label>
        <textarea
          id="brief-source"
          className="source"
          spellCheck={false}
          value={brief.source}
          maxLength={280_000}
          placeholder={"粘贴报告、会议纪要、方案或数据说明。\n\n用 # 标题分章节，- 写要点，| 表格 | 会变成图表，“时间：事项”会变成时间线。\n也可以读入 .md .txt .docx .html .csv 文件。"}
          onChange={(e) => set("source", e.target.value)}
        />
        {!brief.source.trim() && (
          <div className="empty-actions">
            <button type="button" onClick={() => file.current?.click()}>
              <FileUp size={15} aria-hidden="true" />
              读入资料文件
            </button>
            <button
              type="button"
              className="ghost"
              onClick={() => doc.setData((d) => ({ ...d, brief: { ...d.brief, source: SAMPLE_BRIEF, audience: d.brief.audience || SAMPLE_AUDIENCE, objective: d.brief.objective || SAMPLE_OBJECTIVE } }))}
            >
              填入示例资料
            </button>
          </div>
        )}
        <p className="recognized" aria-live="polite">
          {brief.source.trim()
            ? `识别到 ${preview.sections} 个章节${preview.tables ? `、${preview.tables} 张表格` : ""}；本地生成约 ${preview.pages} 页，用到 ${preview.layouts} 种版式。`
            : "资料留在本机工作副本中；本地生成不会发送到任何服务。"}
        </p>
      </section>
      <aside className="brief-side" aria-label="演示设定与生成">
        <section className="card">
          <h2>这次讲给谁</h2>
          <label>
            听众
            <input value={brief.audience} maxLength={1000} onChange={(e) => set("audience", e.target.value)} placeholder="例如：项目评审会、客户管理层" />
          </label>
          <label>
            希望听众带走什么
            <textarea rows={3} value={brief.objective} maxLength={2000} onChange={(e) => set("objective", e.target.value)} placeholder="一句话目标，会写在封面与结尾" />
          </label>
          <div className="row">
            <label>
              语言
              <select value={brief.language} onChange={(e) => set("language", e.target.value as Brief["language"])}>
                <option value="auto">跟随资料</option>
                <option value="zh">中文</option>
                <option value="en">English</option>
              </select>
            </label>
            <label>
              目标页数
              <input
                type="number"
                inputMode="numeric"
                min={0}
                max={80}
                value={brief.length || ""}
                placeholder="自动"
                onChange={(e) => set("length", Math.max(0, Math.min(80, Math.round(Number(e.target.value) || 0))))}
              />
            </label>
          </div>
          <fieldset className="segmented">
            <legend>每页内容</legend>
            {(
              [
                ["concise", "精简"],
                ["standard", "标准"],
                ["detailed", "详尽"],
              ] as const
            ).map(([v, label]) => (
              <label key={v} className={brief.density === v ? "on" : ""}>
                <input type="radio" name="density" value={v} checked={brief.density === v} onChange={() => set("density", v)} />
                {label}
              </label>
            ))}
          </fieldset>
        </section>
        <section className="card generate">
          <h2>生成大纲</h2>
          <p className="hint">按章节、表格、数字和时间自动选择版式；同样的资料总得到同样的大纲。</p>
          {confirm === "local" ? (
            <ConfirmBar message={`替换当前 ${doc.data.outline.length} 页大纲？已生成的幻灯片不受影响。`} confirmLabel="替换大纲" onConfirm={generate} onCancel={() => setConfirm("")} />
          ) : (
            <button type="button" className="primary wide" onClick={() => (hasOutline ? setConfirm("local") : generate())}>
              生成大纲
              <ArrowRight size={16} aria-hidden="true" />
            </button>
          )}
          <div className="channel" data-phase={model.state.phase}>
            <div className="channel-head">
              <Sparkles size={15} aria-hidden="true" />
              <strong>Floatboat 模型起草</strong>
              <span className="chip">可选</span>
            </div>
            <p role="status">{model.state.message}</p>
            {model.state.phase === "ready" &&
              (confirm === "model" ? (
                <ConfirmBar message="资料正文（最多 6 万字）会发送给 Floatboat 模型，可能产生费用。结果先作为候选，不会覆盖当前大纲。" confirmLabel="发送并起草" onConfirm={() => void draftWithModel()} onCancel={() => setConfirm("")} />
              ) : (
                <button type="button" disabled={drafting || !brief.source.trim()} onClick={() => setConfirm("model")}>
                  {drafting ? "正在起草…" : "用模型起草大纲"}
                </button>
              ))}
            <button type="button" className="ghost small" onClick={() => void model.check()} disabled={model.state.phase === "checking"}>
              <RefreshCw size={13} aria-hidden="true" />
              重新检查
            </button>
          </div>
        </section>
      </aside>
    </div>
  );
}
