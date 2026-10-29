// ABOUTME: 种子资料阶段：推演问题、资料目录与正文编辑、议题要点，以及规则抽取实体关系。
import { useRef, useState } from "react";
import { FilePlus, Plus, Trash2, Wand2, Upload } from "lucide-react";
import { LIMITS, newId } from "../contracts/scenario";
import type { Studio } from "./useStudio";

export function SeedStage({ st }: { st: Studio }) {
  const { p, s, mutable } = st;
  const input = useRef<HTMLInputElement>(null);
  const [confirm, setConfirm] = useState(false);
  const docId = typeof p.draft.docId === "string" ? p.draft.docId : "";
  const doc = s.seeds.find((d) => d.id === docId) ?? s.seeds[0];
  const total = s.seeds.reduce((n, d) => n + d.text.length, 0);
  const patchDoc = (patch: Partial<{ name: string; text: string }>) =>
    doc && p.setData((d) => ({ ...d, seeds: d.seeds.map((x) => (x.id === doc.id ? { ...x, ...patch } : x)) }));
  return (
    <div className="seed-layout">
      <section className="panel question">
        <label>
          推演问题
          <textarea rows={3} value={s.question} maxLength={500} disabled={!mutable} placeholder="例如：某项政策公布后，各方舆论会如何演变？" onChange={(e) => p.setData((d) => ({ ...d, question: e.target.value }))} />
        </label>
        <label>
          话题短名
          <input value={s.topic} maxLength={40} disabled={!mutable} placeholder="帖子里用到的简称，如“低排放区”" onChange={(e) => p.setData((d) => ({ ...d, topic: e.target.value }))} />
        </label>
        <div className="doc-list">
          <div className="list-head">
            <h2>种子资料</h2>
            <span className="muted">
              {total.toLocaleString()} / {LIMITS.seedChars.toLocaleString()} 字
            </span>
          </div>
          <ul>
            {s.seeds.map((d) => (
              <li key={d.id}>
                <button className={d.id === doc?.id ? "current" : ""} onClick={() => st.setPick("docId", d.id)}>
                  <span>{d.name || "未命名资料"}</span>
                  <small>{d.text.length.toLocaleString()} 字</small>
                </button>
              </li>
            ))}
          </ul>
          {!s.seeds.length ? <p className="muted">把政策文件、新闻报道、调研摘要或讨论摘录放进来。支持 TXT、MD、HTML、CSV、JSON、PDF（含中文 GB18030 文本）。</p> : null}
          <div className="row">
            <button disabled={!mutable} onClick={() => input.current?.click()}>
              <Upload size={15} aria-hidden="true" />
              添加文件
            </button>
            <button
              disabled={!mutable || s.seeds.length >= LIMITS.seedDocs}
              onClick={() => {
                const id = newId("doc");
                p.setData((d) => ({ ...d, seeds: [...d.seeds, { id, name: "粘贴的资料.md", text: "" }] }));
                st.setPick("docId", id);
              }}
            >
              <FilePlus size={15} aria-hidden="true" />
              粘贴正文
            </button>
          </div>
          <input
            ref={input}
            type="file"
            hidden
            multiple
            aria-label="添加种子资料文件"
            accept=".txt,.md,.markdown,.csv,.tsv,.json,.html,.htm,.xml,.log,.pdf"
            onChange={(e) => {
              const files = [...(e.target.files ?? [])];
              e.target.value = "";
              void st.addSeedFiles(files);
            }}
          />
        </div>
      </section>
      <section className="panel doc-editor">
        {doc ? (
          <>
            <div className="row">
              <input aria-label="资料名称" className="doc-name" value={doc.name} maxLength={200} disabled={!mutable} onChange={(e) => patchDoc({ name: e.target.value })} />
              <button className="ghost" aria-label={`删除资料 ${doc.name}`} disabled={!mutable} onClick={() => p.setData((d) => ({ ...d, seeds: d.seeds.filter((x) => x.id !== doc.id) }))}>
                <Trash2 size={15} aria-hidden="true" />
              </button>
            </div>
            <textarea aria-label="资料正文" className="doc-text" value={doc.text} disabled={!mutable} spellCheck={false} onChange={(e) => patchDoc({ text: e.target.value })} />
            <p className="muted">提示：可用【名称】或 [[名称|类型]] 标注规则抽取漏掉的相关方。</p>
          </>
        ) : (
          <div className="empty-state">
            <h2>从资料开始</h2>
            <p>MiroFish 的推演从“种子材料”出发：资料里出现的机构、群体和人物会成为图谱实体，再变成发言的智能体。</p>
            <button className="primary" disabled={!mutable} onClick={() => input.current?.click()}>
              <Upload size={16} aria-hidden="true" />
              添加资料文件
            </button>
          </div>
        )}
      </section>
      <section className="panel aspects">
        <h2>议题要点</h2>
        <p className="muted">帖子围绕这些要点展开：利好项被支持者引用，关切项被反对者引用。</p>
        <ul className="aspect-list">
          {s.aspects.map((a) => (
            <li key={a.id}>
              <input aria-label="要点名称" value={a.label} maxLength={30} disabled={!mutable} onChange={(e) => p.setData((d) => ({ ...d, aspects: d.aspects.map((x) => (x.id === a.id ? { ...x, label: e.target.value } : x)) }))} />
              <select aria-label={`${a.label} 的倾向`} value={a.lean} disabled={!mutable} onChange={(e) => p.setData((d) => ({ ...d, aspects: d.aspects.map((x) => (x.id === a.id ? { ...x, lean: e.target.value === "1" ? 1 : -1 } : x)) }))}>
                <option value="1">利好</option>
                <option value="-1">关切</option>
              </select>
              <button className="ghost" aria-label={`删除要点 ${a.label}`} disabled={!mutable} onClick={() => p.setData((d) => ({ ...d, aspects: d.aspects.filter((x) => x.id !== a.id) }))}>
                <Trash2 size={14} aria-hidden="true" />
              </button>
            </li>
          ))}
        </ul>
        <button disabled={!mutable || s.aspects.length >= LIMITS.aspects} onClick={() => p.setData((d) => ({ ...d, aspects: [...d.aspects, { id: newId("a"), label: "新要点", lean: -1 }] }))}>
          <Plus size={15} aria-hidden="true" />
          添加要点
        </button>
        <div className="extract">
          <h2>实体与关系</h2>
          <p className="muted">规则抽取在工作台内完成：识别机构后缀、群体称谓与人物称呼，按同句共现与动词判断关系，用立场词典估计初始立场。结果需人工核对。</p>
          {confirm ? (
            <div className="confirm" role="group" aria-label="确认替换图谱">
              <p>将替换现有 {s.entities.length} 个实体、{s.relations.length} 条关系，并清空 {s.agents.length} 个智能体。</p>
              <div className="row">
                <button className="primary" onClick={() => (setConfirm(false), st.extract())}>
                  确认替换
                </button>
                <button onClick={() => setConfirm(false)}>取消</button>
              </div>
            </div>
          ) : (
            <button className="primary" disabled={!mutable || !s.seeds.some((d) => d.text.trim())} onClick={() => (s.entities.length ? setConfirm(true) : st.extract())}>
              <Wand2 size={16} aria-hidden="true" />
              从资料抽取图谱
            </button>
          )}
          {s.entities.length ? (
            <button className="link" onClick={() => st.setStage("graph")}>
              查看当前图谱：{s.entities.length} 实体 →
            </button>
          ) : null}
        </div>
      </section>
    </div>
  );
}
