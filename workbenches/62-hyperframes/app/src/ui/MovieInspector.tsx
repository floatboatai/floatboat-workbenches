import { ArrowUp, ArrowDown, Copy, Trash2 } from "lucide-react";
import { download } from "./workspace";
import { composition, type Scene } from "../contracts/movie";
import type { useMovieDesk } from "./useMovieDesk";
export function MovieInspector({
  p,
  scene,
  mutable,
  edit,
  move,
  add,
}: ReturnType<typeof useMovieDesk>) {
  return (
    <aside className="inspector">
      <fieldset disabled={!mutable}>
        <div className="panel-heading">
          <h2>镜头属性</h2>
          <span>
            {String(p.data.scenes.indexOf(scene) + 1).padStart(2, "0")}
          </span>
        </div>
        <label>
          构图
          <select
            value={scene.kind}
            onChange={(e) => edit({ kind: e.target.value as Scene["kind"] })}
          >
            <option value="title">暗色片头</option>
            <option value="feature">浅色内容</option>
            <option value="closing">暗色片尾</option>
          </select>
        </label>
        <label>
          眉题
          <input
            name="eyebrow"
            autoComplete="off"
            value={scene.eyebrow}
            onChange={(e) => edit({ eyebrow: e.target.value })}
          />
        </label>
        <label>
          标题
          <textarea
            id="scene-title"
            value={scene.title}
            onChange={(e) => edit({ title: e.target.value })}
          />
        </label>
        <label>
          说明
          <textarea
            value={scene.body}
            onChange={(e) => edit({ body: e.target.value })}
          />
        </label>
        <label>
          镜头时长（秒）
          <input
            name="duration"
            inputMode="decimal"
            autoComplete="off"
            value={scene.duration}
            onChange={(e) => edit({ duration: e.target.value })}
          />
        </label>
        <div className="scene-actions">
          <button onClick={() => move(-1)} aria-label="镜头上移">
            <ArrowUp size={16} />
          </button>
          <button onClick={() => move(1)} aria-label="镜头下移">
            <ArrowDown size={16} />
          </button>
          <button onClick={() => add(true)} aria-label="复制镜头">
            <Copy size={16} />
          </button>
          <button
            disabled={p.data.scenes.length <= 1}
            onClick={() => {
              if (confirm("删除选中镜头？"))
                p.setData((d) => ({
                  ...d,
                  scenes: d.scenes.filter((s) => s.id !== scene.id),
                }));
            }}
            aria-label="删除镜头"
          >
            <Trash2 size={16} />
          </button>
        </div>
        <hr />
        <h2>品牌</h2>
        <label>
          品牌名称
          <input
            name="brand"
            autoComplete="off"
            value={p.data.brand}
            onChange={(e) =>
              p.setData((d) => ({ ...d, brand: e.target.value }))
            }
          />
        </label>
        <label>
          强调色
          <input
            name="accent"
            autoComplete="off"
            value={p.data.accent}
            onChange={(e) =>
              p.setData((d) => ({ ...d, accent: e.target.value }))
            }
          />
        </label>
        <button
          className="full"
          onClick={() => {
            try {
              download(
                new Blob([composition(p.data)], { type: "text/html" }),
                p.title + ".html",
              );
            } catch (e) {
              p.report(e);
            }
          }}
        >
          导出 HyperFrames HTML
        </button>
      </fieldset>
    </aside>
  );
}
