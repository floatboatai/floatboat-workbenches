import { useRef, useState } from "react";
import { Clapperboard, Plus, Upload, Download, Film } from "lucide-react";
import { useProjects, ProjectPicker, Notice, download } from "./workspace";
import {
  seed,
  montageValue,
  restoreMontage,
  shotEdit,
  report,
  type Shot,
} from "../contracts/montage";
import { useProduction } from "./useProduction";
import { sourceFor, upload } from "./media";
import { pack, unpack } from "./portable";
import { ShotCard } from "./ShotCard";
export function App() {
  const p = useProjects(seed, montageValue, "城市漫游 · 制作单", {
      storageKey: "openmontage-production-v1",
      restoreDraftData: restoreMontage,
    }),
    flow = useProduction(p);
  const [io, setIo] = useState(""),
    [jsonOpen, setJsonOpen] = useState(false);
  const input = useRef<HTMLInputElement>(null),
    epoch = useRef(p.documentKey);
  epoch.current = p.documentKey;
  const mutable = !p.loading && !p.busy && !io && !flow.transitioning;
  const raw =
      typeof p.draft.json === "string"
        ? p.draft.json
        : JSON.stringify(p.data, null, 2),
    approved = p.data.shots.filter((s) => s.approved).length;
  function edit(id: string, value: Partial<Omit<Shot, "id" | "approved">>) {
    p.setData((d) => ({
      ...d,
      shots: d.shots.map((s) => (s.id === id ? shotEdit(s, value) : s)),
    }));
  }
  function move(i: number, delta: number) {
    const j = i + delta;
    if (j < 0 || j >= p.data.shots.length) return;
    p.setData((d) => {
      const shots = [...d.shots];
      [shots[i], shots[j]] = [shots[j], shots[i]];
      return { ...d, shots };
    });
  }
  async function attach(id: string, file?: File) {
    if (!file) return;
    const key = epoch.current;
    setIo("正在上传素材…");
    try {
      if (file.size > 20 * 1024 * 1024) throw new Error("每段视频不能超过20MB");
      const bytes = new Uint8Array(await file.arrayBuffer()),
        source = await sourceFor(file, bytes);
      await upload(bytes, source, (n) => setIo(`正在上传 ${n}%`));
      if (key === epoch.current) edit(id, { source });
    } catch (e) {
      if (key === epoch.current) p.report(e);
    } finally {
      setIo("");
    }
  }
  async function exportProject() {
    setIo("正在整理原片…");
    const title = p.title,
      data = structuredClone(p.data),
      draft = structuredClone(p.draft);
    try {
      download(await pack(title, data, draft), title + ".json");
    } catch (e) {
      p.report(e);
    } finally {
      setIo("");
    }
  }
  async function importProject(file?: File) {
    if (!file || !flow.canLeave()) return;
    setIo("正在导入工程…");
    try {
      const v = await unpack(file);
      if (v.draft.pendingRender !== undefined) {
        if (
          !confirm(
            "导入会创建编辑副本，不继续其中的制作任务；原任务保留在原工程。继续吗？",
          )
        )
          return;
        v.draft.importedPendingRender = v.draft.pendingRender;
        delete v.draft.pendingRender;
      }
      await p.replace(v.data, v.title, v.draft);
    } catch (e) {
      p.report(e);
    } finally {
      setIo("");
    }
  }
  const labels: Record<string, string> = {
    submitting: "正在提交",
    queued: "制作排队中",
    running: "正在裁切与组接",
    completed: "成片已就绪",
    failed: "制作失败",
    unknown: "提交待核对",
    interrupted: "制作中断",
    cancelled: "已取消",
  };
  return (
    <>
      <a className="skip" href="#production">
        跳到分镜
      </a>
      <header className="masthead">
        <div className="wordmark">
          <Clapperboard aria-hidden="true" />
          <div>
            <strong>OPENMONTAGE</strong>
            <span>镜头制作 / PRODUCTION DESK</span>
          </div>
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
          disabled={!mutable || flow.busy}
          onOpen={(id) => void flow.open(id)}
        />
        <nav>
          <button
            disabled={!mutable || flow.busy}
            onClick={() => void flow.fresh()}
          >
            <Plus aria-hidden="true" size={15} />
            新建
          </button>
          <button
            disabled={!mutable || flow.busy}
            onClick={() => input.current?.click()}
          >
            <Upload aria-hidden="true" size={15} />
            导入工程
          </button>
          <button disabled={!mutable} onClick={() => void exportProject()}>
            <Download aria-hidden="true" size={15} />
            完整工程
          </button>
        </nav>
        <input
          hidden
          ref={input}
          aria-label="导入工程文件"
          type="file"
          accept=".json"
          onChange={(e) => {
            void importProject(e.target.files?.[0]);
            e.target.value = "";
          }}
        />
      </header>
      <div className="savebar">
        <span className={"save-state " + p.autoState.phase} role="status">
          {p.autoState.message}
        </span>
        <span role="status">{io}</span>
        <button onClick={() => p.exportDraft()}>导出恢复稿</button>
        {["offline", "conflict"].includes(p.autoState.phase) ? (
          <>
            <button onClick={() => void p.save()}>重试保存</button>
            {p.current ? (
              <button onClick={() => void flow.open(p.current!.id)}>
                打开服务器版本
              </button>
            ) : null}
          </>
        ) : null}
      </div>
      <Notice error={p.error} notice={p.notice} />
      <main id="production">
        <section className="production">
          <div className="section-top">
            <div>
              <span className="eyebrow">SHOOT / REVIEW / ASSEMBLE</span>
              <h1>把每个镜头，放在合适的位置。</h1>
            </div>
            <span className="stamp">
              {approved} / {p.data.shots.length}
              <small>镜头已确认</small>
            </span>
          </div>
          <label className="brief">
            影片简报
            <textarea
              name="brief"
              disabled={!mutable}
              value={p.data.brief}
              onChange={(e) =>
                p.setData((d) => ({ ...d, brief: e.target.value }))
              }
            />
          </label>
          <div className="sheet-labels">
            <span>分镜 / 原片</span>
            <span>脚本与剪辑说明</span>
            <span>入出点 / 审阅</span>
          </div>
          {p.data.shots.map((s, i) => (
            <ShotCard
              key={s.id}
              shot={s}
              index={i}
              count={p.data.shots.length}
              mutable={mutable}
              edit={(patch) => edit(s.id, patch)}
              move={(delta) => move(i, delta)}
              attach={(file) => void attach(s.id, file)}
              remove={() => {
                if (confirm("删除这个镜头？原文件仍保留。"))
                  p.setData((d) => ({
                    ...d,
                    shots: d.shots.filter((x) => x.id !== s.id),
                  }));
              }}
              approve={() => {
                try {
                  if (!s.source) throw new Error("请先上传原片。");
                  montageValue({ ...p.data, shots: [s] });
                  p.setData((d) => ({
                    ...d,
                    shots: d.shots.map((x) =>
                      x.id === s.id ? { ...x, approved: !x.approved } : x,
                    ),
                  }));
                } catch (e) {
                  p.report(e);
                }
              }}
            />
          ))}
          {p.data.shots.length === 0 ? (
            <p className="empty">还没有分镜。添加镜头后上传第一段原片。</p>
          ) : null}
          <div className="sheet-actions">
            <button
              disabled={!mutable || p.data.shots.length >= 12}
              onClick={() =>
                p.setData((d) => ({
                  ...d,
                  shots: [
                    ...d.shots,
                    {
                      id: crypto.randomUUID(),
                      title: "新镜头",
                      script: "",
                      source: null,
                      start: "0",
                      end: "2",
                      approved: false,
                    },
                  ],
                }))
              }
            >
              <Plus aria-hidden="true" size={16} />
              添加镜头
            </button>
            <button
              onClick={() =>
                download(
                  new Blob([report(p.data)], { type: "text/markdown" }),
                  p.title + ".md",
                )
              }
            >
              导出制作单
            </button>
            <button onClick={() => setJsonOpen(!jsonOpen)}>工程 JSON</button>
          </div>
          {jsonOpen ? (
            <section className="json">
              <label htmlFor="json-draft">工程 JSON 草稿</label>
              <textarea
                id="json-draft"
                spellCheck={false}
                disabled={!mutable}
                value={raw}
                onChange={(e) =>
                  p.setDraft((d) => ({ ...d, json: e.target.value }))
                }
              />
              <button
                disabled={!mutable}
                onClick={() => {
                  try {
                    p.setData(montageValue(JSON.parse(raw)));
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
        <aside className="delivery">
          <div className="delivery-head">
            <Film aria-hidden="true" size={26} />
            <h2>成片架</h2>
          </div>
          <p>确认分镜后，按当前顺序裁切与组接。</p>
          <div className="format">
            <b>HD / 720p</b>
            <span>24 fps · H.264 · MP4</span>
          </div>
          <p className="service">
            {flow.status.message}
            <button onClick={() => void flow.check()}>重新检查</button>
          </p>
          <button
            className="primary"
            disabled={!mutable || flow.busy || !flow.status.available}
            onClick={() => void flow.run()}
          >
            {flow.busy
              ? "正在提交…"
              : flow.pending
                ? "核对同一任务"
                : "制作成片"}
          </button>
          {flow.pending ? (
            <p role="status">任务编号和输入快照已保留，核对不会重复制作。</p>
          ) : null}
          <div className="deliveries">
            {flow.jobs.length === 0 ? (
              <p className="empty">成片版本将保留在这里。</p>
            ) : (
              flow.jobs.map((j) => (
                <article key={j.id}>
                  <strong>{labels[j.state] ?? j.state}</strong>
                  <time>{new Date(j.createdAt).toLocaleString()}</time>
                  <small>{j.id.slice(0, 8)}</small>
                  {j.error ? <p role="alert">{j.error}</p> : null}
                  {j.state === "completed" ? (
                    <button onClick={() => void flow.video(j.id)}>
                      下载 MP4
                    </button>
                  ) : ["queued", "running"].includes(j.state) ? (
                    <button onClick={() => void flow.cancel(j.id)}>
                      取消制作
                    </button>
                  ) : null}
                  <button onClick={() => void flow.load()}>刷新状态</button>
                </article>
              ))
            )}
          </div>
        </aside>
      </main>
    </>
  );
}
