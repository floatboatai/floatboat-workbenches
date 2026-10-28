import { ArrowUp, ArrowDown, Trash2, Check } from "lucide-react";
import type { Shot } from "../contracts/montage";
import { VideoPreview } from "./VideoPreview";
export function ShotCard({
  shot: s,
  index: i,
  count,
  mutable,
  edit,
  move,
  remove,
  approve,
  attach,
}: {
  shot: Shot;
  index: number;
  count: number;
  mutable: boolean;
  edit: (patch: Partial<Omit<Shot, "id" | "approved">>) => void;
  move: (delta: number) => void;
  remove: () => void;
  approve: () => void;
  attach: (file?: File) => void;
}) {
  return (
    <article className={"shot " + (s.approved ? "approved" : "")}>
      <div className="shot-media">
        <div className="shot-caption">
          <span className="shot-number">{String(i + 1).padStart(2, "0")}</span>
          <label className="upload">
            {s.source ? "更换原片" : "上传原片"}
            <input
              aria-label={"上传素材 " + (i + 1)}
              type="file"
              accept="video/mp4,.mp4"
              disabled={!mutable}
              onChange={(e) => {
                attach(e.target.files?.[0]);
                e.target.value = "";
              }}
            />
          </label>
        </div>
        <VideoPreview id={s.source?.id} label={"原片 " + (i + 1)} />
        <small title={s.source?.name}>{s.source?.name ?? "尚未选择素材"}</small>
      </div>
      <fieldset disabled={!mutable} className="script">
        <label>
          镜头名称
          <input
            aria-label={"镜头名称 " + (i + 1)}
            name={"title-" + i}
            autoComplete="off"
            value={s.title}
            onChange={(e) => edit({ title: e.target.value })}
          />
        </label>
        <label>
          脚本与剪辑说明
          <textarea
            aria-label={"镜头说明 " + (i + 1)}
            value={s.script}
            onChange={(e) => edit({ script: e.target.value })}
          />
        </label>
        <div className="order">
          <button
            aria-label={"上移镜头 " + (i + 1)}
            disabled={i === 0}
            onClick={() => move(-1)}
          >
            <ArrowUp aria-hidden="true" size={14} />
          </button>
          <button
            aria-label={"下移镜头 " + (i + 1)}
            disabled={i === count - 1}
            onClick={() => move(1)}
          >
            <ArrowDown aria-hidden="true" size={14} />
          </button>
          <button aria-label={"删除镜头 " + (i + 1)} onClick={remove}>
            <Trash2 aria-hidden="true" size={14} />
          </button>
        </div>
      </fieldset>
      <fieldset disabled={!mutable} className="review">
        <div className="time-fields">
          <label>
            入点 / 秒
            <input
              aria-label={"入点 " + (i + 1)}
              name={"in-" + i}
              inputMode="decimal"
              value={s.start}
              onChange={(e) => edit({ start: e.target.value })}
            />
          </label>
          <label>
            出点 / 秒
            <input
              aria-label={"出点 " + (i + 1)}
              name={"out-" + i}
              inputMode="decimal"
              value={s.end}
              onChange={(e) => edit({ end: e.target.value })}
            />
          </label>
        </div>
        <p>
          {Number.isFinite(+s.end - +s.start) && +s.end > +s.start
            ? (+s.end - +s.start).toFixed(2) + " 秒"
            : "时间待完善"}
        </p>
        <button
          aria-label={"确认镜头 " + (i + 1)}
          className={s.approved ? "approval done" : "approval"}
          onClick={approve}
        >
          <Check aria-hidden="true" size={17} />
          {s.approved ? "已确认 · 撤回" : "确认此镜头"}
        </button>
        <small>修改内容会重新进入待审</small>
      </fieldset>
    </article>
  );
}
