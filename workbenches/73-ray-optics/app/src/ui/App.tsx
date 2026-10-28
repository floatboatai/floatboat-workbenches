import { useRef, useState } from "react";
import {
  Play,
  Square,
  Plus,
  Minus,
  Focus,
  FileDown,
  FolderOpen,
  ArrowUp,
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  Trash2,
  FlaskConical,
} from "lucide-react";
import { NativeBench, type BenchHandle, type Reading } from "./NativeBench";
import { useProjects, ProjectPicker, Notice, download } from "./workspace";
import {
  seed,
  validateOptics,
  restoreOptics,
  sceneValue,
  importOptics,
  objectNames,
  type OpticalObject,
} from "../contracts/optics";
import { objectDefaults } from "../contracts/native-schema";
import { isRecord } from "../contracts/project";
interface ParametersDraft {
  index: number;
  base: string;
  object: OpticalObject;
  values: Record<string, string>;
}
function parameters(value: unknown): ParametersDraft | null {
  if (
    !isRecord(value) ||
    !Number.isInteger(value.index) ||
    typeof value.base !== "string" ||
    !isRecord(value.object) ||
    typeof value.object.type !== "string" ||
    !isRecord(value.values) ||
    Object.values(value.values).some((v) => typeof v !== "string")
  )
    return null;
  return value as unknown as ParametersDraft;
}
const numericLabels: Record<string, string> = {
  "p1.x": "端点一 X",
  "p1.y": "端点一 Y",
  "p2.x": "端点二 X",
  "p2.y": "端点二 Y",
  x: "文字 X",
  y: "文字 Y",
  focalLength: "焦距",
  brightness: "亮度",
  refIndex: "折射率",
  scaleInterval: "标尺间距",
  fontSize: "文字大小",
};
function readProperty(o: OpticalObject, k: string): string {
  const [first, second] = k.split(".");
  if (second) return isRecord(o[first]) ? String(o[first][second] ?? "") : "";
  return String(
    o[first] ??
      (
        objectDefaults[o.type as keyof typeof objectDefaults] as Record<
          string,
          unknown
        >
      )?.[first] ??
      "",
  );
}
export function App() {
  const p = useProjects(seed, validateOptics, "凸透镜 · 平行光会聚", {
    storageKey: "ray-optics-v07",
    restoreDraftData: restoreOptics,
  });
  const bench = useRef<BenchHandle>(null),
    transitionRef = useRef(false);
  const [transitioning, setTransitioning] = useState(false),
    [files, setFiles] = useState(false),
    [readings, setReadings] = useState<Reading[]>([]),
    [rays, setRays] = useState<number | null>(null),
    [truncated, setTruncated] = useState(false);
  const locked = p.loading || p.busy || transitioning,
    selected = typeof p.draft.selected === "number" ? p.draft.selected : -1,
    draft = parameters(p.draft.parameters),
    raw = typeof p.draft.raw === "string" ? p.draft.raw : p.data.scene;
  let objects: OpticalObject[] = [],
    parseError = "";
  try {
    objects = sceneValue(p.data.scene).objs;
  } catch (e) {
    parseError = e instanceof Error ? e.message : "场景无效";
  }
  const index = draft?.index ?? selected,
    object = draft?.object ?? objects[index],
    fields = object
      ? [
          "name",
          ...(object.type === "TextLabel"
            ? ["text", "x", "y", "fontSize"]
            : ["p1.x", "p1.y", "p2.x", "p2.y"]),
          ...(object.type === "IdealLens" ? ["focalLength"] : []),
          ...(["Beam", "SingleRay"].includes(object.type)
            ? ["brightness"]
            : []),
          ...(["CircleGlass", "PlaneGlass"].includes(object.type)
            ? ["refIndex"]
            : []),
          ...(object.type === "Ruler" ? ["scaleInterval"] : []),
        ]
      : [];
  function act(action: () => void) {
    try {
      if (transitionRef.current) return;
      action();
    } catch (e) {
      p.report(e);
    }
  }
  async function transition(action: () => Promise<boolean>) {
    if (transitionRef.current) return;
    transitionRef.current = true;
    setTransitioning(true);
    const resume = bench.current?.suspend();
    let moved = false;
    try {
      moved = await action();
      if (moved) {
        setReadings([]);
        setRays(null);
      }
    } finally {
      if (!moved) resume?.();
      transitionRef.current = false;
      setTransitioning(false);
    }
  }
  function field(key: string, value: string) {
    const baseline = draft?.object ?? bench.current?.inspect(index) ?? object;
    if (!baseline) return;
    const pending: ParametersDraft = draft ?? {
      index,
      base: JSON.stringify(baseline),
      object: baseline,
      values: {},
    };
    p.setDraft((extra) => ({
      ...extra,
      parameters: { ...pending, values: { ...pending.values, [key]: value } },
    }));
  }
  function apply() {
    if (!draft) return;
    act(() => {
      const next: OpticalObject = structuredClone(draft.object);
      for (const [key, value] of Object.entries(draft.values)) {
        if (["name", "text"].includes(key)) {
          next[key] = value;
          continue;
        }
        if (!value.trim() || !Number.isFinite(Number(value)))
          throw Error((numericLabels[key] ?? key) + " 尚未填写完整。");
        const [a, b] = key.split(".");
        if (b)
          next[a] = {
            ...(isRecord(next[a]) ? next[a] : {}),
            [b]: Number(value),
          };
        else next[a] = Number(value);
      }
      if (!bench.current) throw Error("画布尚未就绪。");
      bench.current.update(draft.index, draft.base, next);
      p.setDraft((extra) => {
        const n = { ...extra };
        delete n.parameters;
        return n;
      });
      p.setNotice("参数已应用，点击计算查看新光路。");
    });
  }
  async function importFile(file: File) {
    try {
      await transition(async () => {
        if (file.size > 12 * 1024 * 1024)
          throw Error("文件超过 12 MiB，请先拆分场景。");
        const content = await file.text();
        try {
          const value = importOptics(JSON.parse(content), file.name);
          return p.replace(value.data, value.title, value.extra);
        } catch (error) {
          if (new TextEncoder().encode(content).length <= 850000)
            p.setDraft((extra) => ({ ...extra, raw: content }));
          else p.setNotice("原文件未导入，请保留本地文件；当前实验未被替换。");
          throw error;
        }
      });
    } catch (e) {
      p.report(e);
    }
  }
  function exportProject() {
    act(() => {
      const result = JSON.stringify(
        {
          format: "ray-optics-workbench",
          title: p.title,
          data: p.data,
          extra: p.draft,
        },
        null,
        2,
      );
      if (
        new TextEncoder().encode(
          JSON.stringify({ title: p.title, data: p.data, extra: p.draft }),
        ).length > 1950000
      )
        throw Error("实验工作稿超过 1.95 MB，请先导出恢复稿并拆分。");
      download(
        new Blob([result], { type: "application/json" }),
        "光路实验.json",
      );
    });
  }
  return (
    <main>
      <a className="skip" href="#optical-workspace">
        跳到光路实验
      </a>
      <header className="topbar">
        <div className="identity">
          <FlaskConical size={28} aria-hidden="true" />
          <div>
            <h1>光路实验台</h1>
            <small>RAY OPTICS · GEOMETRIC OPTICS</small>
          </div>
        </div>
        <input
          aria-label="实验名称"
          className="experiment-title"
          name="experimentTitle"
          autoComplete="off"
          maxLength={120}
          value={p.title}
          disabled={locked}
          onChange={(e) => p.setTitle(e.target.value)}
        />
        <span className={"save " + p.autoState.phase} role="status">
          {p.autoState.message}
        </span>
        <button aria-expanded={files} onClick={() => setFiles(!files)}>
          <FolderOpen size={16} aria-hidden="true" />
          实验文件
        </button>
      </header>
      {files ? (
        <section className="filebar" aria-label="实验文件">
          <ProjectPicker
            items={p.items}
            id={p.current?.id}
            disabled={locked}
            onOpen={(id) => void transition(() => p.open(id))}
          />
          <button
            disabled={locked}
            onClick={() => void transition(() => p.fresh())}
          >
            新建实验
          </button>
          <label className={"file-button " + (locked ? "disabled" : "")}>
            导入场景 / 工程
            <input
              aria-label="导入场景或工程"
              type="file"
              accept=".json,application/json"
              disabled={locked}
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) void importFile(f);
                e.target.value = "";
              }}
            />
          </label>
          <button onClick={exportProject} disabled={locked}>
            完整工程
          </button>
          <button onClick={() => p.exportDraft()}>恢复稿</button>
          <button onClick={() => void p.save()} disabled={locked}>
            重试保存
          </button>
          {p.current ? (
            <button
              disabled={locked}
              onClick={() => {
                if (confirm("删除这个实验及其保存记录？"))
                  void transition(() => p.remove());
              }}
            >
              删除实验
            </button>
          ) : null}
        </section>
      ) : null}
      <Notice error={p.error} notice={p.notice} />
      {p.autoState.phase === "conflict" && p.current ? (
        <div className="conflict">
          <button onClick={() => p.exportDraft()}>导出当前恢复稿</button>
          <button onClick={() => void transition(() => p.open(p.current!.id))}>
            打开服务器版本
          </button>
        </div>
      ) : null}
      <div className="instrument-rack" aria-label="光学器材">
        {Object.entries(objectNames).map(([type, name]) => (
          <button
            key={type}
            disabled={locked}
            onClick={() => act(() => bench.current?.add(type))}
          >
            <span aria-hidden="true">
              {
                (
                  {
                    SingleRay: "↗",
                    Beam: "≋",
                    Mirror: "╱",
                    IdealLens: "↕",
                    CircleGlass: "◯",
                    PlaneGlass: "◩",
                    Blocker: "┃",
                    Detector: "▤",
                    Ruler: "┄",
                    TextLabel: "T",
                  } as Record<string, string>
                )[type]
              }
            </span>
            {name}
          </button>
        ))}
      </div>
      <div className="workspace" id="optical-workspace">
        <section className="stage" aria-label="光路实验">
          <div className="stagebar">
            <div>
              <button
                className="run"
                disabled={locked || Boolean(parseError)}
                onClick={() => act(() => bench.current?.run())}
              >
                <Play size={16} aria-hidden="true" />
                计算光路
              </button>
              <button
                disabled={locked}
                onClick={() => act(() => bench.current?.stop())}
              >
                <Square size={13} aria-hidden="true" />
                停止
              </button>
            </div>
            <div>
              <button
                title="缩小"
                aria-label="缩小画布"
                disabled={locked}
                onClick={() => act(() => bench.current?.zoom(0.8))}
              >
                <Minus size={16} />
              </button>
              <button
                title="放大"
                aria-label="放大画布"
                disabled={locked}
                onClick={() => act(() => bench.current?.zoom(1.25))}
              >
                <Plus size={16} />
              </button>
              <button
                disabled={locked}
                onClick={() => act(() => bench.current?.fit())}
              >
                <Focus size={16} aria-hidden="true" />
                适配
              </button>
            </div>
          </div>
          {p.loading ? (
            <div className="loading" role="status">
              正在打开实验…
            </div>
          ) : (
            <NativeBench
              ref={bench}
              documentKey={p.documentKey}
              source={p.data.scene}
              disabled={locked}
              selected={selected}
              onScene={(source) => {
                p.setData((v) => ({ ...v, scene: source }));
                setRays(null);
                setReadings([]);
              }}
              onSelection={(n) =>
                p.setDraft((extra) => ({ ...extra, selected: n }))
              }
              onError={p.report}
              onInvalidate={() => {
                setReadings([]);
                setRays(null);
              }}
              onResult={(value, n, limit) => {
                setReadings(value);
                setRays(n);
                setTruncated(limit);
              }}
            />
          )}
          <div className="stage-footer">
            <span>
              {objects.length} 个元件 ·{" "}
              {rays === null
                ? "等待计算"
                : `${rays} 段光线${truncated ? " · 已达到计算上限" : ""}`}
            </span>
            <div>
              <button
                disabled={locked || Boolean(parseError)}
                onClick={() =>
                  download(
                    new Blob([p.data.scene], { type: "application/json" }),
                    "光路场景.json",
                  )
                }
              >
                场景 JSON
              </button>
              <button
                disabled={locked}
                onClick={() => {
                  void bench.current
                    ?.png()
                    .then((blob) => download(blob, "光路实验.png"))
                    .catch(p.report);
                }}
              >
                <FileDown size={15} aria-hidden="true" />
                PNG 图像
              </button>
            </div>
          </div>
          {parseError ? (
            <p className="notice error" role="alert">
              {parseError} 请在原生场景编辑器中修复，或导出恢复稿。
            </p>
          ) : null}
          <section className="readings" aria-label="探测器读数">
            <h2>
              探测器 <span>当前计算结果</span>
            </h2>
            {readings.length ? (
              <table>
                <thead>
                  <tr>
                    <th>探测器</th>
                    <th>相对功率</th>
                    <th>法向分量</th>
                    <th>切向分量</th>
                  </tr>
                </thead>
                <tbody>
                  {readings.map((r) => (
                    <tr key={r.index}>
                      <td>{r.name}</td>
                      <td>{r.power.toFixed(4)}</td>
                      <td>{r.normal.toFixed(4)}</td>
                      <td>{r.shear.toFixed(4)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <p>计算光路后，显示探测器的相对光功率和动量分量。</p>
            )}
          </section>
          <label className="notes">
            实验记录
            <textarea
              aria-label="实验记录"
              name="notes"
              maxLength={40000}
              value={p.data.notes}
              disabled={locked}
              onChange={(e) =>
                p.setData((v) => ({ ...v, notes: e.target.value }))
              }
            />
          </label>
        </section>
        <aside className="inspector" aria-label="元件参数">
          <div className="inspector-heading">
            <h2>器材与参数</h2>
            <span>{draft ? "参数稿" : "选中元件"}</span>
          </div>
          <label>
            器材列表
            <select
              aria-label="选择元件"
              value={selected}
              disabled={locked}
              onChange={(e) =>
                act(() => bench.current?.select(Number(e.target.value)))
              }
            >
              <option value={-1}>选择一个元件…</option>
              {objects.map((o, i) => (
                <option key={i} value={i}>
                  {i + 1}. {o.name || objectNames[o.type]}
                </option>
              ))}
            </select>
          </label>
          {object ? (
            <>
              <p className="object-kind">
                {objectNames[object.type]}
                <span>#{index + 1}</span>
              </p>
              <fieldset disabled={locked}>
                <div className="field-grid">
                  {fields.map((key) => (
                    <label
                      className={["name", "text"].includes(key) ? "full" : ""}
                      key={key}
                    >
                      {key === "name"
                        ? "元件名称"
                        : key === "text"
                          ? "标注文字"
                          : numericLabels[key]}
                      {key === "text" ? (
                        <textarea
                          aria-label="标注文字"
                          name="elementText"
                          maxLength={3000}
                          value={
                            draft?.values[key] ?? readProperty(object, key)
                          }
                          onChange={(e) => field(key, e.target.value)}
                        />
                      ) : (
                        <input
                          aria-label={
                            key === "name" ? "元件名称" : numericLabels[key]
                          }
                          name={key}
                          autoComplete="off"
                          inputMode={
                            ["name", "text"].includes(key) ? "text" : "decimal"
                          }
                          maxLength={key === "name" ? 120 : 40}
                          value={
                            draft?.values[key] ?? readProperty(object, key)
                          }
                          onChange={(e) => field(key, e.target.value)}
                        />
                      )}
                    </label>
                  ))}
                </div>
                {draft ? (
                  <div className="draft-note">
                    <p>参数输入自动保存为草稿，应用后才改变光路。</p>
                    <button className="apply" onClick={apply}>
                      应用参数
                    </button>
                    <button
                      onClick={() => {
                        if (confirm("放弃尚未应用的参数，重新读取画布元件？"))
                          p.setDraft((extra) => {
                            const n = { ...extra };
                            delete n.parameters;
                            return n;
                          });
                      }}
                    >
                      重新读取元件
                    </button>
                  </div>
                ) : null}
              </fieldset>
              <div className="nudge">
                <span>微调位置</span>
                {[
                  [ArrowLeft, -1, 0, "向左"],
                  [ArrowRight, 1, 0, "向右"],
                  [ArrowUp, 0, -1, "向上"],
                  [ArrowDown, 0, 1, "向下"],
                ].map(([Icon, x, y, label]) => {
                  const I = Icon as typeof ArrowLeft;
                  return (
                    <button
                      key={String(label)}
                      aria-label={String(label)}
                      disabled={locked || Boolean(draft)}
                      onClick={() =>
                        act(() =>
                          bench.current?.nudge(index, Number(x), Number(y)),
                        )
                      }
                    >
                      <I size={16} />
                    </button>
                  );
                })}
                <button
                  disabled={locked || Boolean(draft)}
                  aria-label="删除选中元件"
                  onClick={() => {
                    if (confirm("删除这个光学元件？"))
                      act(() => bench.current?.remove(index));
                  }}
                >
                  <Trash2 size={16} />
                </button>
              </div>
            </>
          ) : (
            <p className="empty">点击光路中的元件，或从上方器材架添加。</p>
          )}
          <details className="raw">
            <summary>原生场景 JSON</summary>
            <label>
              场景输入
              <textarea
                aria-label="原生场景编辑器"
                name="nativeScene"
                spellCheck={false}
                value={raw}
                disabled={locked}
                onChange={(e) =>
                  p.setDraft((extra) => ({ ...extra, raw: e.target.value }))
                }
              />
            </label>
            <button
              disabled={locked}
              onClick={() =>
                act(() => {
                  sceneValue(raw);
                  validateOptics({ ...p.data, scene: raw });
                  p.setData((v) => ({ ...v, scene: raw }));
                  p.setDraft((extra) => {
                    const next = { ...extra };
                    delete next.raw;
                    return next;
                  });
                  p.setNotice("原生场景已应用，点击计算光路。");
                })
              }
            >
              应用场景
            </button>
            <button
              onClick={() =>
                download(
                  new Blob([raw], { type: "application/json" }),
                  "原始输入.json",
                )
              }
            >
              下载输入
            </button>
          </details>
          {p.data.original ? (
            <button
              onClick={() =>
                download(
                  new Blob([p.data.original], { type: "application/json" }),
                  p.data.originalName || "导入原件.json",
                )
              }
            >
              下载导入原件
            </button>
          ) : null}
          <p className="scope">
            二维几何光学 · CPU 光线追踪
            <br />
            场景与未完成输入会分别保存。
          </p>
        </aside>
      </div>
    </main>
  );
}
