import type { Dispatch, SetStateAction } from "react";
import { Check, Download, Trash2 } from "lucide-react";
import {
  reviewCsv,
  validateCollection,
  type Collection,
} from "../contracts/folio";
import { download } from "./workspace";
export function Reviews({
  data,
  setData,
  busy,
  filename,
  onError,
}: {
  data: Collection;
  setData: Dispatch<SetStateAction<Collection>>;
  busy: boolean;
  filename: string;
  onError: (error: unknown) => void;
}) {
  const setDraft = (patch: Partial<Collection["draft"]>) =>
    setData((current) => ({
      ...current,
      draft: { ...current.draft, ...patch },
    }));
  function addReview() {
    const text = data.draft.text.trim(),
      pageId = data.draft.pageId || data.left;
    if (!text) return;
    if (!data.pages.some((p) => p.id === pageId)) {
      onError(new Error("请重新选择关联资料页。"));
      return;
    }
    setData((current) => ({
      ...current,
      reviews: [
        ...current.reviews,
        { id: crypto.randomUUID(), pageId, text, status: "open" },
      ],
      draft: { ...current.draft, text: "" },
    }));
  }
  function exportCsv() {
    try {
      const csv = reviewCsv(validateCollection(data));
      download(
        new Blob([csv], { type: "text/csv;charset=utf-8" }),
        filename + "-复核记录.csv",
      );
    } catch (error) {
      onError(error);
    }
  }
  return (
    <section className="review-section">
      <div className="section-heading">
        <div>
          <p className="eyebrow">REVIEW NOTES</p>
          <h2>复核记录</h2>
        </div>
        <button disabled={busy || !data.reviews.length} onClick={exportCsv}>
          <Download size={15} aria-hidden="true" />
          导出复核清单
        </button>
      </div>
      <form
        className="review-form"
        onSubmit={(event) => {
          event.preventDefault();
          addReview();
        }}
      >
        <label>
          关联资料页
          <select
            aria-label="关联资料页"
            name="review-page"
            value={data.draft.pageId || data.left}
            disabled={busy || !data.pages.length}
            onChange={(event) => setDraft({ pageId: event.target.value })}
          >
            {data.pages.map((page) => (
              <option key={page.id} value={page.id}>
                {page.label}
              </option>
            ))}
          </select>
        </label>
        <label className="review-text">
          复核意见
          <textarea
            aria-label="复核意见"
            name="review-text"
            autoComplete="off"
            value={data.draft.text}
            maxLength={2000}
            required
            disabled={busy}
            placeholder="例如：日期字样与另一页不同，需要核对原件…"
            onChange={(event) => setDraft({ text: event.target.value })}
          />
        </label>
        <button
          className="primary"
          disabled={busy || !data.pages.length || data.reviews.length >= 100}
        >
          添加记录
        </button>
      </form>
      <div className="reviews">
        {data.reviews.length ? (
          data.reviews.map((review) => (
            <article className={"review " + review.status} key={review.id}>
              <div>
                <span className="review-page">
                  {data.pages.find((page) => page.id === review.pageId)?.label}
                </span>
                <p>{review.text}</p>
              </div>
              <button
                disabled={busy}
                aria-pressed={review.status === "resolved"}
                onClick={() =>
                  setData((current) => ({
                    ...current,
                    reviews: current.reviews.map((r) =>
                      r.id === review.id
                        ? {
                            ...r,
                            status: r.status === "open" ? "resolved" : "open",
                          }
                        : r,
                    ),
                  }))
                }
              >
                <Check size={15} aria-hidden="true" />
                {review.status === "resolved" ? "已复核" : "标为已复核"}
              </button>
              <button
                className="icon-button"
                disabled={busy}
                aria-label="删除复核记录"
                onClick={() => {
                  if (confirm("删除这条复核记录？"))
                    setData((current) => ({
                      ...current,
                      reviews: current.reviews.filter(
                        (r) => r.id !== review.id,
                      ),
                    }));
                }}
              >
                <Trash2 size={15} aria-hidden="true" />
              </button>
            </article>
          ))
        ) : (
          <p className="empty-note">
            还没有复核意见。可以记录文字差异、扫描缺页或需要回查的细节。
          </p>
        )}
      </div>
    </section>
  );
}
