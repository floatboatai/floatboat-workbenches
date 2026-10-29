import { Check, Crosshair, Search, Trash2, X } from "lucide-react";
import {
  finalAttributes,
  finalClass,
  finalText,
  locationKind,
  recordSpan,
  type EvidenceDocument,
  type Field,
  type LocationKind,
  type Review,
  type ReviewStatus,
} from "../contracts/evidence";
import type { Selection } from "./SourcePaper";

export const statusName: Record<ReviewStatus, string> = {
  pending: "待复核",
  accepted: "已接受",
  rejected: "已驳回",
  corrected: "已修订",
};
export const locationName: Record<LocationKind, string> = {
  exact: "精确定位",
  fuzzy: "模糊定位",
  anchored: "人工定位",
  unaligned: "未定位 · 需人工核对",
  stale: "原文已变更",
};

export function RecordList({
  doc,
  rows,
  selected,
  colorOf,
  onSelect,
}: {
  doc: EvidenceDocument;
  rows: number[];
  selected: number;
  colorOf: (cls: string) => string;
  onSelect: (i: number) => void;
}) {
  if (!rows.length)
    return (
      <p className="empty">
        {doc.extractions.length
          ? "没有符合筛选条件的记录。"
          : "还没有记录。在左侧原文中选中文字即可标注，或从“抽取”运行模型、从档案菜单导入 JSONL。"}
      </p>
    );
  return (
    <ol className={rows.length > 60 ? "record-list long-list" : "record-list"}>
      {rows.map((i) => {
        const r = doc.reviews[i],
          s = recordSpan(doc, i),
          kind = locationKind(doc, i);
        return (
          <li key={i}>
            <button
              className={"record" + (i === selected ? " selected" : "")}
              onClick={() => onSelect(i)}
              aria-pressed={i === selected}
              data-record={i}
            >
              <span className="record-number">{String(i + 1).padStart(2, "0")}</span>
              <span className="record-body">
                <span className="record-class">
                  <span className="swatch" style={{ background: colorOf(finalClass(doc, i)) }} aria-hidden="true" />
                  {finalClass(doc, i)}
                  {r.source === "manual" && <span className="manual-tag">人工</span>}
                </span>
                <strong>{finalText(doc, i) || "空值"}</strong>
                <span className={"record-location " + kind}>
                  {s ? `原文 ${s.start}–${s.end}` : ""}
                  {kind === "fuzzy" || kind === "anchored" || !s ? (s ? " · " : "") + locationName[kind] : ""}
                </span>
              </span>
              <span className={"status-tag " + r.status}>{statusName[r.status]}</span>
            </button>
          </li>
        );
      })}
    </ol>
  );
}

function attrText(v: string | string[] | undefined) {
  return Array.isArray(v) ? v.join("、") : (v ?? "");
}

export function ReviewCard({
  doc,
  index,
  fields,
  selection,
  colorOf,
  onReview,
  onStatus,
  onAnchor,
  onFind,
  onRemove,
}: {
  doc: EvidenceDocument;
  index: number;
  fields: Field[];
  selection: Selection | null;
  colorOf: (cls: string) => string;
  onReview: (patch: Partial<Review>) => void;
  onStatus: (s: ReviewStatus) => void;
  onAnchor: () => void;
  onFind: () => void;
  onRemove: () => void;
}) {
  const e = doc.extractions[index],
    r = doc.reviews[index],
    kind = locationKind(doc, index),
    s = recordSpan(doc, index),
    cls = finalClass(doc, index),
    attrs = finalAttributes(doc, index) ?? {},
    stale = kind === "stale";
  const keys = [
    ...new Set([...(fields.find((f) => f.name === cls)?.attributes ?? []), ...Object.keys(attrs)]),
  ];
  const classes = [...new Set([...fields.map((f) => f.name).filter(Boolean), cls, e.extraction_class])];
  const quote = s ? Array.from(doc.originalText).slice(s.start, s.end).join("") : "";
  return (
    <section className="review-card" aria-label="当前记录复核">
      <div className="review-card-title">
        <span>
          记录 {String(index + 1).padStart(2, "0")} · {r.source === "manual" ? "人工标注" : "模型记录"}
        </span>
        <span className={"loc " + kind}>{locationName[kind]}</span>
      </div>
      <div className="card-grid">
        <label>
          类别
          <select
            aria-label="复核类别"
            value={cls}
            onChange={(ev) =>
              onReview({ correctedClass: ev.target.value === e.extraction_class ? "" : ev.target.value })
            }
          >
            {classes.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </label>
        <span className="swatch big" style={{ background: colorOf(cls) }} aria-hidden="true" />
      </div>
      <p className="original-value">
        {r.source === "manual" ? "标注原文" : "模型原值"}：<q>{e.extraction_text}</q>
        {s && quote !== e.extraction_text && (
          <>
            <br />
            对齐片段：<q>{quote}</q>
          </>
        )}
      </p>
      <label>
        修订值
        <input
          aria-label="修订值"
          name="corrected-value"
          autoComplete="off"
          value={r.correctedText}
          onChange={(ev) => onReview({ correctedText: ev.target.value })}
          placeholder={finalText(doc, index) ? `保持“${finalText(doc, index).slice(0, 20)}”时留空…` : "填写修订值…"}
          maxLength={10000}
        />
      </label>
      {keys.length > 0 && (
        <fieldset className="attributes">
          <legend>属性</legend>
          {keys.map((k) => (
            <label key={k}>
              <span>{k}</span>
              <input
                aria-label={`属性 ${k}`}
                autoComplete="off"
                value={attrText(attrs[k])}
                maxLength={2000}
                onChange={(ev) => {
                  const next: Record<string, string | string[]> = { ...attrs, [k]: ev.target.value };
                  if (!ev.target.value) delete next[k];
                  onReview({ attributes: next });
                }}
              />
            </label>
          ))}
        </fieldset>
      )}
      <label>
        复核笔记
        <textarea
          aria-label="复核笔记"
          name="review-note"
          autoComplete="off"
          value={r.note}
          onChange={(ev) => onReview({ note: ev.target.value })}
          placeholder="记录核对依据或待确认事项…"
          maxLength={4000}
        />
      </label>
      {!stale && (
        <div className="anchor-row">
          <button type="button" disabled={!selection} onClick={onAnchor} title={selection ? `定位到「${selection.quote.slice(0, 30)}」` : "先在原文中选中文字"}>
            <Crosshair size={15} aria-hidden="true" />
            定位到选区
          </button>
          {!s && (
            <button type="button" onClick={onFind}>
              <Search size={15} aria-hidden="true" />
              在原文中查找
            </button>
          )}
          {r.span && (
            <button type="button" className="text-button" onClick={() => onReview({ span: null })}>
              恢复模型区间
            </button>
          )}
          {!selection && <span className="hint">在原文中选中文字后可重新定位</span>}
        </div>
      )}
      <div className="decision-buttons">
        <button className="accept" disabled={stale} onClick={() => onStatus("accepted")} aria-keyshortcuts="a">
          <Check size={16} aria-hidden="true" />
          接受
        </button>
        <button onClick={() => onStatus("rejected")} aria-keyshortcuts="x">
          <X size={16} aria-hidden="true" />
          驳回
        </button>
        <button disabled={stale || !r.correctedText.trim()} onClick={() => onStatus("corrected")}>
          采用修订
        </button>
        <button className="text-button" onClick={() => onStatus("pending")}>
          重置
        </button>
        {r.source === "manual" && (
          <button className="text-button danger" onClick={onRemove}>
            <Trash2 size={15} aria-hidden="true" />
            删除标注
          </button>
        )}
      </div>
      {stale && <p className="hint">原文已变更：恢复原文后才能接受或修订。</p>}
    </section>
  );
}
