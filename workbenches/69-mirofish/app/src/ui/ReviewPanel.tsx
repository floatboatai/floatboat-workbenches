import { Check } from "lucide-react";
import { content } from "../contracts/simulation";
import type { useReviewDesk } from "./useReviewDesk";
export function ReviewPanel({
  p,
  chosen,
  note,
  mutable,
  annotate,
}: ReturnType<typeof useReviewDesk>) {
  return (
    <aside className="reviewer">
      <span className="eyebrow">REVIEW NOTE</span>
      <h2>动作复核</h2>
      {chosen ? (
        <>
          <div className="selected-meta">
            <b>{chosen.a.agent_name || "角色 " + chosen.a.agent_id}</b>
            <span>
              轮次 {chosen.a.round_num} · {chosen.a.action_type}
            </span>
          </div>
          <p className="selected-content">{content(chosen.a)}</p>
          <label>
            判断与依据
            <textarea
              aria-label="动作批注"
              disabled={!mutable}
              maxLength={5000}
              value={note?.note ?? ""}
              placeholder="记录依据、不确定性或需补充的条件…"
              onChange={(e) => annotate({ note: e.target.value })}
            />
          </label>
          <button
            className={"mark " + (note?.reviewed ? "done" : "")}
            disabled={!mutable}
            onClick={() => annotate({ reviewed: !note?.reviewed })}
          >
            <Check aria-hidden="true" size={16} />
            {note?.reviewed ? "已复核 · 撤回" : "标记已复核"}
          </button>
          <details>
            <summary>查看完整原始动作</summary>
            <pre>{JSON.stringify(chosen.a, null, 2)}</pre>
          </details>
        </>
      ) : (
        <p>选择一个动作开始复核。</p>
      )}
    </aside>
  );
}
