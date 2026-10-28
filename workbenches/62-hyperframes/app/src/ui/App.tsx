import {
  Plus,
  Play,
  Pause,
  Film,
  Download,
  Upload,
  Clapperboard,
} from "lucide-react";
import { ProjectPicker, Notice, request, download } from "./workspace";
import { movieValue, sceneSvg } from "../contracts/movie";
import { useMovieDesk } from "./useMovieDesk";
import { MovieInspector } from "./MovieInspector";
export function App() {
  const desk = useMovieDesk();
  const {
    p,
    scene,
    timeline,
    duration,
    active,
    mutable,
    raw,
    time,
    setTime,
    playing,
    setPlaying,
    jobs,
    busy,
    status,
    jsonOpen,
    setJsonOpen,
    file,
    check,
    loadJobs,
    edit,
    focus,
    move,
    add,
    render,
    exportVideo,
    importFile,
    labels,
  } = desk;
  return (
    <>
      <a className="skip" href="#studio">
        跳到剪辑台
      </a>
      <header className="topbar">
        <div className="brand">
          <Clapperboard size={22} aria-hidden="true" />
          <strong>HYPERFRAMES</strong>
          <span>动效剪辑</span>
        </div>
        <input
          aria-label="项目名称"
          name="project"
          autoComplete="off"
          value={p.title}
          disabled={!mutable}
          onChange={(e) => p.setTitle(e.target.value)}
        />
        <ProjectPicker
          items={p.items}
          id={p.current?.id}
          disabled={!mutable || busy}
          onOpen={(id) => void p.open(id)}
        />
        <div className="file-actions">
          <button disabled={!mutable || busy} onClick={() => void p.fresh()}>
            <Plus size={15} />
            新建
          </button>
          <button
            disabled={!mutable || busy}
            onClick={() => file.current?.click()}
          >
            <Upload size={15} />
            导入
          </button>
          <button
            onClick={() =>
              download(
                new Blob(
                  [
                    JSON.stringify(
                      {
                        format: "floatboat-hyperframes-v1",
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
                p.title + ".json",
              )
            }
          >
            <Download size={15} />
            工程
          </button>
        </div>
        <input
          ref={file}
          type="file"
          accept=".json"
          aria-label="导入工程文件"
          hidden
          onChange={(e) => {
            void importFile(e.target.files?.[0]);
            e.target.value = "";
          }}
        />
      </header>
      <div className="statusbar">
        <span role="status" className={"save-state " + p.autoState.phase}>
          {p.autoState.message}
        </span>
        <span>1280 × 720 · 24 fps</span>
        <button
          onClick={() => {
            p.exportDraft();
          }}
        >
          恢复草稿
        </button>
        {["offline", "conflict"].includes(p.autoState.phase) ? (
          <>
            <button onClick={() => void p.save()}>重试保存</button>
            {p.current ? (
              <button onClick={() => void p.open(p.current!.id)}>
                打开服务器版本
              </button>
            ) : null}
          </>
        ) : null}
      </div>
      <Notice error={p.error} notice={p.notice} />
      <main id="studio" className="studio">
        <aside className="filmstrip">
          <div className="panel-heading">
            <h1>镜头</h1>
            <button
              aria-label="添加镜头"
              disabled={!mutable}
              onClick={() => add()}
            >
              <Plus size={16} />
            </button>
          </div>
          {timeline.map(({ scene: s, start, duration: d }, i) => (
            <button
              key={s.id}
              className={"scene-card " + (scene.id === s.id ? "selected" : "")}
              onClick={() => focus(s.id)}
            >
              <div
                className="miniature"
                aria-hidden="true"
                dangerouslySetInnerHTML={{ __html: sceneSvg(p.data, s) }}
              />
              <span>
                <b>{String(i + 1).padStart(2, "0")}</b>
                {s.title.split("\n")[0] || "未命名镜头"}
                <small>{d.toFixed(1)}s</small>
              </span>
            </button>
          ))}
        </aside>
        <section className="viewer">
          <div className="viewer-heading">
            <span>PROGRAM / 画面预览</span>
            <strong>{active.scene.eyebrow}</strong>
          </div>
          <div
            className="stage"
            role="img"
            aria-label={"当前画面：" + active.scene.title}
            dangerouslySetInnerHTML={{
              __html: sceneSvg(
                p.data,
                active.scene,
                Math.min(1, (time - active.start) / 0.65),
              ),
            }}
          />
          <div className="transport">
            <button
              aria-label={playing ? "暂停预览" : "播放预览"}
              onClick={() => {
                if (time >= duration - 0.1) setTime(0);
                setPlaying(!playing);
              }}
            >
              {playing ? <Pause size={18} /> : <Play size={18} />}
            </button>
            <output>
              {time.toFixed(2)} <span>/ {duration.toFixed(2)} 秒</span>
            </output>
            <input
              aria-label="播放位置"
              type="range"
              min="0"
              max={Math.max(0.1, duration - 0.01)}
              step=".01"
              value={Math.min(time, duration - 0.01)}
              onChange={(e) => {
                setPlaying(false);
                setTime(+e.target.value);
              }}
            />
            <button onClick={() => setJsonOpen(!jsonOpen)}>工程 JSON</button>
          </div>
          <section className="timeline" aria-label="视频时间轴">
            <div className="ruler">
              {[0, 0.25, 0.5, 0.75, 1].map((v) => (
                <span key={v}>{(duration * v).toFixed(1)}s</span>
              ))}
            </div>
            <div className="track">
              <span
                className="playhead"
                style={{ left: `${Math.min(100, (time / duration) * 100)}%` }}
              />
              {timeline.map(({ scene: s, start, duration: d }) => (
                <button
                  key={s.id}
                  style={{ flex: d }}
                  className={s.id === scene.id ? "selected" : ""}
                  onClick={() => focus(s.id)}
                >
                  <Film size={14} />
                  <span>{s.title.split("\n")[0]}</span>
                </button>
              ))}
            </div>
            <p>镜头按顺序衔接 · 选择片段后可调整文案与时长</p>
          </section>
          {jsonOpen ? (
            <section className="json-editor">
              <label htmlFor="json-draft">工程 JSON 草稿</label>
              <textarea
                id="json-draft"
                spellCheck={false}
                value={raw}
                onChange={(e) =>
                  p.setDraft((d) => ({ ...d, json: e.target.value }))
                }
              />
              <button
                onClick={() => {
                  try {
                    p.setData(movieValue(JSON.parse(raw)));
                    p.setNotice("已应用工程内容。");
                  } catch (e) {
                    p.report(e);
                  }
                }}
              >
                应用 JSON
              </button>
            </section>
          ) : null}
        </section>
        <MovieInspector {...desk} />
      </main>
      <section className="deliveries">
        <div className="delivery-heading">
          <div>
            <h2>输出</h2>
            <p>
              {status.message}{" "}
              <button onClick={() => void check()}>重新检查</button>
            </p>
          </div>
          <button
            className="primary"
            disabled={!mutable || busy || !status.available}
            onClick={() => void render()}
          >
            <Download size={17} />
            {busy ? "正在提交…" : "渲染 MP4"}
          </button>
        </div>
        {jobs.length === 0 ? (
          <p className="empty">准备好画面后，创建第一份视频输出。</p>
        ) : (
          jobs.map((j) => (
            <article className="job" key={j.id}>
              <span className={"job-dot " + j.state} />
              <div>
                <strong>{labels[j.state] ?? j.state}</strong>
                <small>
                  {new Date(j.createdAt).toLocaleString()} · {j.id.slice(0, 8)}
                </small>
                {j.error ? <p role="alert">{j.error}</p> : null}
              </div>
              <div className="job-actions">
                {j.state === "completed" ? (
                  <button onClick={() => void exportVideo(j.id)}>
                    下载 MP4
                  </button>
                ) : ["running", "queued", "interrupted"].includes(j.state) ? (
                  <button
                    onClick={async () => {
                      try {
                        await request("/api/renders/" + j.id + "/cancel", {
                          method: "POST",
                        });
                        await loadJobs();
                      } catch (e) {
                        p.report(e);
                      }
                    }}
                  >
                    取消渲染
                  </button>
                ) : null}
                {["unknown", "submitting"].includes(j.state) ? (
                  <button
                    onClick={async () => {
                      try {
                        await request("/api/renders/" + j.id + "/retry", {
                          method: "POST",
                        });
                        await loadJobs();
                      } catch (e) {
                        p.report(e);
                      }
                    }}
                  >
                    重试同一任务
                  </button>
                ) : null}
                <button onClick={() => void loadJobs()}>刷新状态</button>
              </div>
            </article>
          ))
        )}
      </section>
    </>
  );
}
