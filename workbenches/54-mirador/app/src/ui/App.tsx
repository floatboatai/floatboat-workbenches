import { Reviews } from "./Reviews";
import { lazy, Suspense, useRef, useState } from "react";
import {
  BookOpen,
  Save,
  Plus,
  Upload,
  Download,
  Trash2,
  RotateCcw,
} from "lucide-react";
import { seed, type Collection, validateCollection, restoreCollectionDraft } from "../contracts/folio";
import {
  uploadScans,
  projectBundle,
  readBundle,
  storeBundleImages,
} from "./files";
import {
  download,
  Notice,
  ProjectPicker,
  RenderBoundary,
  useProjects,
} from "./workspace";
import type { CompareHandle } from "./Compare";
const Compare = lazy(() =>
  import("./Compare").then((m) => ({ default: m.Compare })),
);
export function App() {
  const p = useProjects(seed, validateCollection, "未命名对照项目", {
    storageKey: "mirador",
    restoreDraftData: restoreCollectionDraft,
  });
  const viewer = useRef<CompareHandle>(null);
  const [side, setSide] = useState<"left" | "right">("left");
  const [session, setSession] = useState(0),
    [importing, setImporting] = useState(false);
  const imageInput = useRef<HTMLInputElement>(null),
    projectInput = useRef<HTMLInputElement>(null);
  const busy = p.busy || importing;
  const left = p.data.pages.find((x) => x.id === p.data.left),
    right = p.data.pages.find((x) => x.id === p.data.right);
  const name = () => p.title.trim().replace(/[\\/:*?"<>|]/g, "_") || "馆藏对照";
  const capture = (): Collection => ({
    ...p.data,
    views: viewer.current?.views() ?? p.data.views,
  });
  return (
    <main className="archive-room">
      <a className="skip-link" href="#comparison-controls">
        跳到图像对照
      </a>
      <header className="masthead">
        <div className="brand">
          <BookOpen size={22} aria-hidden="true" />
          <div>
            <h1>馆藏对照室</h1>
            <span>COLLECTION REVIEW</span>
          </div>
        </div>
        <div className="project-tools">
          <ProjectPicker
            items={p.items}
            id={p.current?.id}
            disabled={busy}
            onOpen={(id) => {
              void p.open(id);
            }}
          />
          <button
            disabled={busy}
            onClick={() => {
              void p.fresh();
            }}
          >
            <Plus size={16} aria-hidden="true" />
            新建
          </button>
          <button
            className="primary"
            disabled={busy}
            onClick={() => void p.save(capture())}
          >
            <Save size={16} aria-hidden="true" />
            {p.busy ? "保存中…" : "立即保存"}
          </button>
        </div>
      </header>
      <section className="document-title">
        <div>
          <label className="eyebrow" htmlFor="title">
            对照项目
          </label>
          <input
            id="title"
            name="title"
            autoComplete="off"
            maxLength={120}
            value={p.title}
            onChange={(e) => p.setTitle(e.target.value)}
            disabled={busy}
          />
          <p
            className="auto-save"
            role="status"
            data-save-phase={p.autoState.phase}
          >
            {p.loading ? "正在恢复项目…" : p.autoState.message}
          </p>
          {p.autoState.phase === "conflict" ||
          p.autoState.phase === "offline" ? (
            <div className="recovery-actions">
              <button onClick={p.exportDraft}>导出恢复文件</button>
              {p.current && (
                <button onClick={() => void p.open(p.current!.id)}>
                  打开服务器版本
                </button>
              )}
            </div>
          ) : null}
        </div>
        <div className="file-tools">
          <button disabled={busy} onClick={() => imageInput.current?.click()}>
            <Upload size={16} aria-hidden="true" />
            添加扫描页
          </button>
          <button disabled={busy} onClick={() => projectInput.current?.click()}>
            导入为新项目
          </button>
          <button disabled={busy} onClick={() => void exportProject()}>
            <Download size={16} aria-hidden="true" />
            导出项目
          </button>
        </div>
      </section>
      <Notice error={p.error} notice={p.notice} />
      {importing ? (
        <p className="progress" role="status">
          正在处理文件，请稍候…
        </p>
      ) : null}
      <section
        id="comparison-controls"
        className="selectors"
        aria-label="选择对照页"
      >
        {(["left", "right"] as const).map((key) => (
          <label key={key}>
            <span>{key === "left" ? "01 / 左侧资料" : "02 / 右侧资料"}</span>
            <select
              name={key}
              aria-label={key === "left" ? "左侧资料页" : "右侧资料页"}
              value={p.data[key]}
              disabled={busy || !p.data.pages.length}
              onChange={(e) => {
                const views = viewer.current?.views() ?? p.data.views;
                p.setData((current) => ({
                  ...current,
                  [key]: e.target.value,
                  views: { ...views, [key]: null },
                }));
              }}
            >
              {p.data.pages.length ? (
                p.data.pages.map((page) => (
                  <option key={page.id} value={page.id}>
                    {page.label}
                  </option>
                ))
              ) : (
                <option value="">先添加资料页</option>
              )}
            </select>
          </label>
        ))}
      </section>
      <div className="mobile-switch" role="group" aria-label="窄屏对照侧">
        <button
          aria-pressed={side === "left"}
          onClick={() => {
            p.setData(capture());
            setSide("left");
          }}
        >
          查看左侧
        </button>
        <button
          aria-pressed={side === "right"}
          onClick={() => {
            p.setData(capture());
            setSide("right");
          }}
        >
          查看右侧
        </button>
      </div>
      {left && right ? (
        <RenderBoundary>
          <Suspense
            fallback={
              <div className="comparison loading" role="status">
                正在打开图像查看器…
              </div>
            }
          >
            <Compare
              ref={viewer}
              left={left.assetId}
              right={right.assetId}
              initial={p.data.views}
              session={String(session) + p.documentKey}
              side={side}
              onError={p.setError}
              onViewsChange={(views) =>
                p.setData((data) =>
                  JSON.stringify(data.views) === JSON.stringify(views)
                    ? data
                    : { ...data, views },
                )
              }
            />
          </Suspense>
        </RenderBoundary>
      ) : (
        <section className="empty">
          <BookOpen size={34} aria-hidden="true" />
          <h2>把需要核对的资料放在一起</h2>
          <p>添加本地 PNG 或 JPEG，再选择左右对照页。</p>
          <button onClick={() => imageInput.current?.click()} disabled={busy}>
            添加扫描页
          </button>
        </section>
      )}
      <div className="viewer-caption">
        <span>拖动与缩放查看细节；保存项目时同时记录当前视图。</span>
        <div className="viewer-actions">
          {(["left", "right"] as const).map((key) => (
            <button
              key={key}
              className={"rotation " + (side === key ? "active" : "")}
              disabled={busy || !left}
              onClick={() => {
                if (!viewer.current?.rotate(key))
                  p.setError("图像仍在加载，请稍后旋转。");
                else p.setData(capture());
              }}
            >
              <RotateCcw size={14} aria-hidden="true" />
              {key === "left" ? "旋转左页" : "旋转右页"}
            </button>
          ))}
          <button
            disabled={busy || !left}
            onClick={() => {
              p.setData((data) => ({
                ...data,
                views: { left: null, right: null },
              }));
              setSession((x) => x + 1);
            }}
          >
            <RotateCcw size={14} aria-hidden="true" />
            重置视图
          </button>
        </div>
      </div>
      <section className="pages-section">
        <div className="section-heading">
          <h2>资料页</h2>
          <span>最多 20 页，每张 PNG/JPEG 不超过 1 MiB</span>
        </div>
        <div className="page-strip">
          {p.data.pages.map((page, index) => (
            <article className="page-card" key={page.id}>
              <img
                src={"/api/images/" + page.assetId}
                alt={page.label + "缩略图"}
                width={70}
                height={86}
                loading="lazy"
              />
              <div>
                <label htmlFor={"label-" + page.id}>页 {index + 1}</label>
                <input
                  id={"label-" + page.id}
                  name="page-label"
                  autoComplete="off"
                  aria-label={"页 " + (index + 1) + " 名称"}
                  value={page.label}
                  maxLength={120}
                  disabled={busy}
                  onChange={(e) =>
                    p.setData((data) => ({
                      ...data,
                      pages: data.pages.map((x) =>
                        x.id === page.id ? { ...x, label: e.target.value } : x,
                      ),
                    }))
                  }
                />
              </div>
              <button
                className="icon-button"
                disabled={busy}
                aria-label={"移除 " + page.label}
                onClick={() => removePage(page.id)}
              >
                <Trash2 size={15} aria-hidden="true" />
              </button>
            </article>
          ))}
        </div>
      </section>
      <Reviews
        data={p.data}
        setData={p.setData}
        busy={busy}
        filename={name()}
        onError={p.report}
      />
      <footer>
        <span>原始扫描页与复核记录保存在当前工作空间。</span>
        <button
          className="danger"
          disabled={busy || !p.current}
          onClick={() => void p.remove()}
        >
          删除项目
        </button>
      </footer>
      <input
        className="sr-only"
        ref={imageInput}
        type="file"
        accept="image/png,image/jpeg"
        multiple
        aria-label="选择扫描图像"
        onChange={(e) => {
          const files = Array.from(e.target.files ?? []);
          e.target.value = "";
          if (files.length) void addImages(files);
        }}
      />
      <input
        className="sr-only"
        ref={projectInput}
        type="file"
        accept=".json"
        aria-label="选择对照项目"
        onChange={(e) => {
          const file = e.target.files?.[0];
          e.target.value = "";
          if (file) void importProject(file);
        }}
      />
    </main>
  );
  function removePage(id: string) {
    if (!confirm("移除此资料页及其复核记录？原图文件仍保留在当前工作空间。"))
      return;
    p.setData((data) => {
      const pages = data.pages.filter((x) => x.id !== id);
      return {
        ...data,
        pages,
        left: data.left === id ? (pages[0]?.id ?? "") : data.left,
        right: data.right === id ? (pages.at(-1)?.id ?? "") : data.right,
        reviews: data.reviews.filter((x) => x.pageId !== id),
        draft: {
          ...data.draft,
          pageId: data.draft.pageId === id ? "" : data.draft.pageId,
        },
        views: { left: null, right: null },
      };
    });
  }
  async function addImages(files: File[]) {
    setImporting(true);
    p.setError("");
    try {
      const pages = await uploadScans(files, p.data.pages.length);
      p.setData((data) => ({
        ...data,
        pages: [...data.pages, ...pages],
        left: data.left || pages[0].id,
        right: pages.at(-1)?.id ?? data.right,
        views: { ...data.views, right: null },
      }));
    } catch (error) {
      p.report(error);
    } finally {
      setImporting(false);
    }
  }
  async function exportProject() {
    setImporting(true);
    p.setError("");
    try {
      const bundle = await projectBundle(capture(), p.title);
      download(
        new Blob([JSON.stringify(bundle, null, 2)], {
          type: "application/json",
        }),
        name() + ".json",
      );
    } catch (error) {
      p.report(error);
    } finally {
      setImporting(false);
    }
  }
  async function importProject(file: File) {
    setImporting(true);
    p.setError("");
    try {
      const bundle = await readBundle(file);
      await storeBundleImages(bundle.images);
      await p.replace(bundle.data, bundle.title);
    } catch (error) {
      p.report(error);
    } finally {
      setImporting(false);
    }
  }
}
