import {
  ArrowRight,
  Check,
  CirclePause,
  Download,
  RotateCcw,
  Square,
} from "lucide-react";
import type { useReviewDesk } from "./useReviewDesk";
import { RecordFields } from "./RecordFields";
import { formatTime, formatDate, statusLabels } from "./presentation";
type Props = Pick<
  ReturnType<typeof useReviewDesk>,
  | "mutable"
  | "selected"
  | "reviewed"
  | "note"
  | "actionBusy"
  | "pendingOperation"
  | "editReview"
  | "decide"
  | "exportResult"
  | "changeRun"
  | "loadRuns"
>;
export function ReviewPanel({
  mutable,
  selected,
  reviewed,
  note,
  actionBusy,
  pendingOperation,
  editReview,
  decide,
  exportResult,
  changeRun,
  loadRuns,
}: Props) {
  return (
    <section
      className={`review-sheet ${selected?.status ?? "empty"}`}
      aria-labelledby="review-heading"
    >
      <div className="section-heading">
        <div>
          <span className="eyebrow">复核区</span>
          <h2 id="review-heading">
            {selected?.status === "completed" ? "交付已确认" : "当前待办"}
          </h2>
        </div>
        {selected ? (
          <span className={`run-status ${selected.status}`} role="status">
            {statusLabels[selected.status]}
          </span>
        ) : (
          <span className="run-status">尚未开始</span>
        )}
      </div>
      {!selected ? (
        <div className="empty-review">
          <CirclePause size={44} strokeWidth={1.2} aria-hidden="true" />
          <h3>等待一份资料进入复核</h3>
          <p>
            填写左侧资料并启动流程。复核时可以修改摘要、负责人和检查事项，再通过或退回。
          </p>
          <div className="empty-note">
            <span>你决定最终版本</span>
            <ArrowRight size={18} aria-hidden="true" />
            <span>交付记录独立保存</span>
          </div>
        </div>
      ) : (
        <>
          <div className="run-caption">
            <span className="mono">
              {selected.id.slice(0, 8).toUpperCase()}
            </span>
            <span>{formatTime(selected.createdAt)}</span>
            <span>
              {selected.input.mode === "model"
                ? "模型整理"
                : "填写资料 · 无模型调用"}
            </span>
          </div>
          {selected.error ? (
            <p className="run-error" role="alert">
              {selected.error}
            </p>
          ) : null}
          {selected.status === "waiting" ? (
            <>
              <p className="review-hint">
                <CirclePause size={16} aria-hidden="true" />
                流程停在复核节点，等待你的决定。
              </p>
              <RecordFields
                prefix="review-"
                disabled={!mutable}
                value={reviewed}
                onChange={(record) => editReview(record)}
              />
              <label className="review-note" htmlFor="review-note">
                复核意见
                <textarea
                  id="review-note"
                  name="reviewNote"
                  disabled={!mutable}
                  rows={2}
                  maxLength={2000}
                  value={note}
                  onChange={(e) => editReview(reviewed, e.target.value)}
                />
              </label>
              <div className="decision-actions">
                <button
                  disabled={!mutable || actionBusy || !!pendingOperation}
                  onClick={() => {
                    void decide("reject");
                  }}
                >
                  退回资料
                </button>
                <button
                  className="primary"
                  disabled={!mutable || actionBusy || !!pendingOperation}
                  onClick={() => {
                    void decide("approve");
                  }}
                >
                  <Check size={17} aria-hidden="true" />
                  通过并交付
                </button>
              </div>
            </>
          ) : selected.status === "completed" && selected.output ? (
            <div className="delivery">
              <div className="delivery-seal">
                <Check size={28} aria-hidden="true" />
                <span>已通过复核</span>
              </div>
              <h3>{selected.output.subject}</h3>
              <dl>
                <div>
                  <dt>负责人</dt>
                  <dd>{selected.output.owner}</dd>
                </div>
                <div>
                  <dt>交付日期</dt>
                  <dd>
                    {selected.output.dueDate
                      ? formatDate(selected.output.dueDate)
                      : "待确认"}
                  </dd>
                </div>
              </dl>
              <p className="delivery-summary">{selected.output.summary}</p>
              <ul>
                {selected.output.checklist.map((item, index) => (
                  <li key={index}>
                    <Check size={14} aria-hidden="true" />
                    {item}
                  </li>
                ))}
              </ul>
              {selected.review?.note ? (
                <blockquote>{selected.review.note}</blockquote>
              ) : null}
              <div className="export-actions">
                <button className="primary" onClick={() => exportResult(false)}>
                  <Download size={16} aria-hidden="true" />
                  导出 JSON
                </button>
                <button onClick={() => exportResult(true)}>
                  导出 Markdown
                </button>
              </div>
            </div>
          ) : (
            <div className="run-message">
              <h3>
                {selected.status === "running"
                  ? "流程正在执行"
                  : statusLabels[selected.status]}
              </h3>
              <p>
                {selected.status === "running"
                  ? "可以继续编辑左侧资料。当前运行使用已保存的输入快照。"
                  : selected.status === "rejected"
                    ? selected.review?.note ||
                      "这次资料未通过。修改左侧输入后可以发起新一轮复核。"
                    : "输入、运行编号和已有检查点保留在本项目中。"}
              </p>
              {["interrupted", "failed"].includes(selected.status) ? (
                <button
                  disabled={actionBusy}
                  onClick={() => {
                    void changeRun("recover");
                  }}
                >
                  <RotateCcw size={16} aria-hidden="true" />
                  检查并恢复进度
                </button>
              ) : null}
            </div>
          )}
          <div className="run-tools">
            <button
              onClick={() => {
                void loadRuns();
              }}
            >
              刷新任务
            </button>
            {["running", "waiting", "failed", "interrupted"].includes(
              selected.status,
            ) ? (
              <button
                disabled={actionBusy}
                onClick={() => {
                  void changeRun("cancel");
                }}
              >
                <Square size={13} aria-hidden="true" />
                取消本次运行
              </button>
            ) : null}
          </div>
        </>
      )}
    </section>
  );
}
