import { lazy, Suspense, useCallback, useRef, useState } from "react";
import { Dna, Download, FileUp, Plus, Save, Trash2 } from "lucide-react";
import {
  extractSequence,
  fasta,
  fromViewerSelection,
  importProject,
  parseSequence,
  rangeLength,
  seed,
  validateDocument,
  validateRange,
  type Feature,
  type Range,
  type SequenceDocument,
  type Topology,
} from "../contracts/sequence";
import {
  download,
  Notice,
  ProjectPicker,
  RenderBoundary,
  useProjects,
} from "./workspace";
const SequenceCanvas = lazy(() =>
  import("./SequenceCanvas").then((module) => ({
    default: module.SequenceCanvas,
  })),
);
const colors = [
  { value: "#4d9e9b", name: "青绿" },
  { value: "#d7964d", name: "赭黄" },
  { value: "#6f7bb9", name: "蓝紫" },
  { value: "#c76b84", name: "莓红" },
];
export function Studio() {
  const [draft, setDraft] = useState(""),
    [featureName, setFeatureName] = useState(""),
    [note, setNote] = useState("");
  const [appliedSequence, setAppliedSequence] = useState("");
  const sequenceDirty = draft !== appliedSequence,
    pending = sequenceDirty || !!featureName || !!note;
  const p = useProjects(seed, validateDocument, "未命名序列", pending);
  const [editingSequence, setEditingSequence] = useState(true),
    [importing, setImporting] = useState(false),
    [view, setView] = useState<"circular" | "linear">("circular"),
    [range, setRange] = useState<Range>({ start: 1, end: 1, strand: 1 }),
    [color, setColor] = useState(colors[0].value),
    [editingFeature, setEditingFeature] = useState<string | null>(null),
    [format, setFormat] = useState("fasta");
  const file = useRef<HTMLInputElement>(null),
    locked = p.busy || importing,
    recordsLocked = locked || sequenceDirty;
  let rangeError = "";
  try {
    validateRange(range, p.data.sequence.length, p.data.topology);
  } catch (error) {
    rangeError = error instanceof Error ? error.message : "选区无效。";
  }
  const selectedSequence =
    p.data.sequence && !rangeError
      ? extractSequence(p.data.sequence, range, p.data.topology)
      : "";
  function resetDrafts(data: SequenceDocument) {
    setDraft(data.sequence);
    setAppliedSequence(data.sequence);
    setFeatureName("");
    setNote("");
    setEditingFeature(null);
    setRange({
      start: 1,
      end: Math.min(20, data.sequence.length) || 1,
      strand: 1,
    });
    setEditingSequence(!data.sequence);
    setView(data.topology === "linear" ? "linear" : "circular");
  }
  function applySequence() {
    try {
      const parsed = parseSequence(draft);
      if (
        parsed.sequence !== p.data.sequence &&
        (p.data.features.length || p.data.reviews.length) &&
        !confirm("替换序列将清除旧序列的所有特征与审阅记录，继续吗？")
      )
        return;
      const data: SequenceDocument =
        parsed.sequence === p.data.sequence
          ? p.data
          : {
              sequence: parsed.sequence,
              topology: p.data.topology,
              features: [],
              reviews: [],
            };
      p.setData(data);
      if (parsed.name) p.setTitle(parsed.name);
      resetDrafts(data);
      p.setError("");
    } catch (error) {
      p.report(error);
    }
  }
  function toggleSequence() {
    if (
      editingSequence &&
      sequenceDirty &&
      !confirm("序列草稿尚未应用，确定放弃这份草稿吗？")
    )
      return;
    if (editingSequence) {
      setDraft(p.data.sequence);
      setAppliedSequence(p.data.sequence);
    }
    setEditingSequence((value) => !value);
  }
  async function importFile(event: React.ChangeEvent<HTMLInputElement>) {
    const input = event.currentTarget,
      chosen = input.files?.[0];
    input.value = "";
    if (!chosen) return;
    setImporting(true);
    try {
      if (chosen.size > 500000) throw new Error("文件不能超过 500 KB。");
      const text = await chosen.text();
      if (chosen.name.toLowerCase().endsWith(".json")) {
        const decoded = importProject(JSON.parse(text));
        if (p.dirty && !confirm("当前有未保存的修改，确定替换为导入项目吗？"))
          return;
        p.setData(decoded.data);
        p.setTitle(decoded.title);
        resetDrafts(decoded.data);
      } else {
        parseSequence(text);
        if (sequenceDirty && !confirm("确定替换尚未应用的序列草稿吗？")) return;
        setDraft(text);
        setEditingSequence(true);
      }
      p.setError("");
    } catch (error) {
      p.report(error);
    } finally {
      setImporting(false);
    }
  }
  function setTopology(topology: Topology) {
    try {
      validateDocument({ ...p.data, topology });
      p.setData({ ...p.data, topology });
      if (topology === "linear") {
        setView("linear");
        setRange({
          start: 1,
          end: Math.min(20, p.data.sequence.length),
          strand: 1,
        });
      }
      p.setError("");
    } catch (error) {
      p.report(error);
    }
  }
  const onSelection = useCallback(
    (value: unknown) => {
      if (sequenceDirty || featureName || note) return;
      const next = fromViewerSelection(
        value,
        p.data.sequence.length,
        p.data.topology,
      );
      if (next) setRange(next);
    },
    [sequenceDirty, featureName, note, p.data.sequence.length, p.data.topology],
  );
  function addFeature(event: React.FormEvent) {
    event.preventDefault();
    try {
      const feature: Feature = {
        ...validateRange(range, p.data.sequence.length, p.data.topology),
        id: editingFeature ?? crypto.randomUUID(),
        name: featureName,
        color,
      };
      const features = editingFeature
        ? p.data.features.map((item) =>
            item.id === editingFeature ? feature : item,
          )
        : [...p.data.features, feature];
      p.setData(validateDocument({ ...p.data, features }));
      setFeatureName("");
      setEditingFeature(null);
      p.setError("");
    } catch (error) {
      p.report(error);
    }
  }
  function addReview(event: React.FormEvent) {
    event.preventDefault();
    try {
      p.setData(
        validateDocument({
          ...p.data,
          reviews: [
            ...p.data.reviews,
            {
              ...validateRange(range, p.data.sequence.length, p.data.topology),
              id: crypto.randomUUID(),
              note,
              done: false,
              createdAt: new Date().toISOString(),
            },
          ],
        }),
      );
      setNote("");
      p.setError("");
    } catch (error) {
      p.report(error);
    }
  }
  function selectFeature(feature: Feature, edit = false) {
    if (
      (featureName || note) &&
      !confirm("存在未提交的标注或意见，确定放弃并切换区间吗？")
    )
      return;
    setNote("");
    setFeatureName(edit ? feature.name : "");
    setEditingFeature(edit ? feature.id : null);
    setColor(feature.color);
    setRange({
      start: feature.start,
      end: feature.end,
      strand: feature.strand,
    });
  }
  const safeName = p.title.replace(/[\\/:*?"<>|]/g, "_") || "sequence";
  function exportFile() {
    if (pending || !p.data.sequence) return;
    if (format === "fasta")
      download(
        new Blob([fasta(p.title, p.data.sequence)], { type: "text/plain" }),
        safeName + ".fasta",
      );
    else if (format === "selection") {
      if (rangeError) return;
      download(
        new Blob(
          [
            fasta(
              `${p.title}|${range.start}-${range.end}|strand=${range.strand}`,
              selectedSequence,
            ),
          ],
          { type: "text/plain" },
        ),
        safeName + "-选区.fasta",
      );
    } else {
      const value =
        format === "project"
          ? {
              schemaVersion: 1,
              coordinates: "1-based-inclusive",
              title: p.title,
              data: p.data,
            }
          : {
              coordinates: "1-based-inclusive",
              sequenceLength: p.data.sequence.length,
              topology: p.data.topology,
              features: p.data.features,
              reviews: p.data.reviews,
            };
      download(
        new Blob([JSON.stringify(value, null, 2)], {
          type: "application/json",
        }),
        safeName + (format === "project" ? "-项目" : "-标注") + ".json",
      );
    }
  }
  const gc = p.data.sequence.length
    ? (
        ((p.data.sequence.match(/[GC]/g)?.length ?? 0) /
          p.data.sequence.length) *
        100
      ).toFixed(1)
    : "—";
  return (
    <main className="sequence-studio">
      <a className="skip-link" href="#sequence-input">
        跳到序列输入
      </a>
      <header className="lab-header">
        <div className="lab-brand">
          <Dna aria-hidden="true" size={29} />
          <div>
            <strong>序列审阅台</strong>
            <span>SEQUENCE NOTEBOOK</span>
          </div>
        </div>
        <div className="project-actions">
          <ProjectPicker
            items={p.items}
            id={p.current?.id}
            disabled={locked}
            onOpen={(id) => {
              void p.open(id).then((result) => {
                if (result) resetDrafts(result.data);
              });
            }}
          />
          <button
            disabled={locked}
            onClick={() => {
              if (p.fresh()) resetDrafts(seed);
            }}
          >
            <Plus aria-hidden="true" size={15} />
            新建
          </button>
          <button
            className="primary"
            disabled={locked || pending || !p.data.sequence}
            onClick={() => void p.save()}
          >
            <Save aria-hidden="true" size={15} />
            {p.busy ? "保存中…" : "保存项目"}
          </button>
        </div>
      </header>
      <section className="sequence-heading">
        <div>
          <label className="sr-only" htmlFor="project-title">
            序列项目名称
          </label>
          <input
            id="project-title"
            name="title"
            autoComplete="off"
            maxLength={120}
            value={p.title}
            disabled={locked}
            onChange={(event) => p.setTitle(event.target.value)}
          />
          <p role="status">
            {pending
              ? "有尚未应用或提交的草稿"
              : p.dirty
                ? "有未保存的修改"
                : p.current
                  ? "已保存"
                  : "导入自己的序列，开始审阅。"}
          </p>
        </div>
        <div className="document-actions">
          <button
            onClick={toggleSequence}
            aria-expanded={editingSequence}
            disabled={locked}
          >
            录入序列
          </button>
          <button onClick={() => file.current?.click()} disabled={locked}>
            <FileUp aria-hidden="true" size={15} />
            导入文件
          </button>
          <input
            ref={file}
            className="sr-only"
            aria-label="导入 FASTA 或项目 JSON"
            type="file"
            accept=".fasta,.fa,.fna,.txt,.json"
            onChange={(event) => void importFile(event)}
          />
          <label className="sr-only" htmlFor="export-format">
            导出内容
          </label>
          <select
            id="export-format"
            value={format}
            onChange={(event) => setFormat(event.target.value)}
          >
            <option value="fasta">整条 FASTA</option>
            <option value="selection">选区 FASTA</option>
            <option value="project">项目 JSON</option>
            <option value="annotations">标注 JSON</option>
          </select>
          <button
            disabled={
              locked ||
              pending ||
              !p.data.sequence ||
              (format === "selection" && !!rangeError)
            }
            onClick={exportFile}
          >
            <Download aria-hidden="true" size={15} />
            导出
          </button>
          <button
            className="danger"
            aria-label="删除序列项目"
            disabled={locked || !p.current}
            onClick={() => {
              void p.remove().then((removed) => {
                if (removed) resetDrafts(seed);
              });
            }}
          >
            <Trash2 aria-hidden="true" size={15} />
          </button>
        </div>
      </section>
      <Notice error={p.error} notice={p.notice} />
      {editingSequence ? (
        <section id="sequence-input" className="sequence-input">
          <div>
            <h1>输入 DNA 序列</h1>
            <p>
              粘贴 IUPAC DNA 或单条 FASTA，最多 10,000 bp。序列不会自动生成。
            </p>
          </div>
          <label className="sr-only" htmlFor="raw-sequence">
            序列原文
          </label>
          <textarea
            id="raw-sequence"
            name="sequence"
            autoComplete="off"
            spellCheck={false}
            maxLength={100000}
            disabled={locked}
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            placeholder=">你的序列名称…"
          />
          <div>
            <button
              className="primary"
              disabled={locked}
              onClick={applySequence}
            >
              应用序列
            </button>
            <button
              disabled={locked}
              onClick={() => {
                setDraft(p.data.sequence);
                setAppliedSequence(p.data.sequence);
                p.setError("");
              }}
            >
              放弃草稿
            </button>
            <span>
              {sequenceDirty
                ? "应用后才会更新查看器与导出。"
                : "原文与当前序列一致。"}
            </span>
          </div>
        </section>
      ) : null}
      {p.data.sequence ? (
        <>
          <section className="sequence-facts">
            <span className="dna-tag">DNA</span>
            <strong>
              {p.data.sequence.length.toLocaleString()} <small>bp</small>
            </strong>
            <span>GC（全长）{gc}%</span>
            <span>{p.data.features.length} 个特征</span>
            <label>
              拓扑
              <select
                name="topology"
                aria-label="序列拓扑"
                disabled={recordsLocked || !!featureName || !!note}
                value={p.data.topology}
                onChange={(event) =>
                  setTopology(event.target.value as Topology)
                }
              >
                <option value="circular">环形</option>
                <option value="linear">线性</option>
              </select>
            </label>
          </section>
          <section className="viewer-section">
            <div className="viewer-toolbar">
              <h1>序列视图</h1>
              <div role="group" aria-label="查看方式">
                <button
                  aria-pressed={view === "circular"}
                  disabled={p.data.topology === "linear"}
                  onClick={() => setView("circular")}
                >
                  环形图
                </button>
                <button
                  aria-pressed={view === "linear"}
                  onClick={() => setView("linear")}
                >
                  线性图
                </button>
              </div>
              <span>坐标从 1 开始，含起止碱基</span>
            </div>
            <RenderBoundary key={p.current?.id ?? "new"}>
              <Suspense
                fallback={
                  <div className="viewer-loading" role="status">
                    正在加载序列查看器…
                  </div>
                }
              >
                <SequenceCanvas
                  sequence={p.data.sequence}
                  features={p.data.features}
                  range={rangeError ? null : range}
                  view={view}
                  onSelection={onSelection}
                />
              </Suspense>
            </RenderBoundary>
          </section>
          <section className="selection-panel" aria-label="当前选区">
            <div className="range-controls">
              <strong>当前区间</strong>
              <label>
                起点
                <input
                  name="start"
                  type="number"
                  min={1}
                  max={p.data.sequence.length}
                  value={range.start}
                  onChange={(event) =>
                    setRange({ ...range, start: Number(event.target.value) })
                  }
                />
              </label>
              <span>—</span>
              <label>
                终点
                <input
                  name="end"
                  type="number"
                  min={1}
                  max={p.data.sequence.length}
                  value={range.end}
                  onChange={(event) =>
                    setRange({ ...range, end: Number(event.target.value) })
                  }
                />
              </label>
              <label>
                方向
                <select
                  name="strand"
                  aria-label="方向"
                  value={range.strand}
                  onChange={(event) =>
                    setRange({
                      ...range,
                      strand: Number(event.target.value) as 1 | -1,
                    })
                  }
                >
                  <option value={1}>正向 +</option>
                  <option value={-1}>反向 −</option>
                </select>
              </label>
              <span className="range-length">
                {rangeError
                  ? "区间无效"
                  : `${rangeLength(range, p.data.sequence.length)} bp${range.start > range.end ? " · 跨原点" : ""}${range.strand === -1 ? " · 反向互补" : ""}`}
              </span>
            </div>
            {rangeError ? (
              <p role="alert" className="range-error">
                {rangeError}
              </p>
            ) : (
              <>
                <label className="sr-only" htmlFor="selected-sequence">
                  选区序列
                </label>
                <textarea
                  id="selected-sequence"
                  name="selectedSequence"
                  readOnly
                  spellCheck={false}
                  value={selectedSequence}
                />
              </>
            )}
          </section>
          <div className="records-grid">
            <section className="feature-section">
              <header>
                <h2>特征注释</h2>
                <span>{p.data.features.length} / 100</span>
              </header>
              <form onSubmit={addFeature}>
                <fieldset disabled={recordsLocked}>
                  <label>
                    特征名称
                    <input
                      name="featureName"
                      autoComplete="off"
                      required
                      maxLength={100}
                      value={featureName}
                      onChange={(event) => setFeatureName(event.target.value)}
                      placeholder="例如：待核对区域…"
                    />
                  </label>
                  <label>
                    颜色
                    <select
                      name="color"
                      value={color}
                      onChange={(event) => setColor(event.target.value)}
                    >
                      {colors.map((item) => (
                        <option key={item.value} value={item.value}>
                          {item.name}
                        </option>
                      ))}
                    </select>
                  </label>
                  <button
                    className="primary"
                    disabled={
                      !!rangeError ||
                      (!editingFeature && p.data.features.length >= 100)
                    }
                  >
                    {editingFeature ? "更新特征" : "将选区添加为特征"}
                  </button>
                  {featureName ? (
                    <button
                      type="button"
                      onClick={() => {
                        setFeatureName("");
                        setEditingFeature(null);
                      }}
                    >
                      取消编辑
                    </button>
                  ) : null}
                </fieldset>
                <p>
                  使用上方当前区间：{range.start}–{range.end}（
                  {range.strand === 1 ? "+" : "−"}）
                </p>
              </form>
              <ul className="feature-list">
                {p.data.features.map((feature) => (
                  <li key={feature.id}>
                    <span
                      className="feature-color"
                      style={{ background: feature.color }}
                      aria-hidden="true"
                    />
                    <div>
                      <strong>{feature.name}</strong>
                      <span>
                        {feature.start}–{feature.end} ·{" "}
                        {feature.strand === 1 ? "正向" : "反向"}
                        {feature.start > feature.end ? " · 跨原点" : ""}
                      </span>
                    </div>
                    <button
                      onClick={() => selectFeature(feature)}
                      disabled={recordsLocked}
                    >
                      定位
                    </button>
                    <button
                      onClick={() => selectFeature(feature, true)}
                      disabled={recordsLocked}
                    >
                      编辑
                    </button>
                    <button
                      className="danger"
                      aria-label={"删除特征 " + feature.name}
                      disabled={recordsLocked}
                      onClick={() => {
                        if (confirm(`删除特征「${feature.name}」？`)) {
                          p.setData({
                            ...p.data,
                            features: p.data.features.filter(
                              (item) => item.id !== feature.id,
                            ),
                          });
                          if (editingFeature === feature.id) {
                            setEditingFeature(null);
                            setFeatureName("");
                          }
                        }
                      }}
                    >
                      ×
                    </button>
                  </li>
                ))}
              </ul>
              {!p.data.features.length ? (
                <p className="empty-note">选择区间并命名，即可添加特征。</p>
              ) : null}
            </section>
            <section className="review-section">
              <header>
                <h2>审阅记录</h2>
                <span>
                  {p.data.reviews.filter((item) => item.done).length} /{" "}
                  {p.data.reviews.length} 已核对
                </span>
              </header>
              <form onSubmit={addReview}>
                <fieldset disabled={recordsLocked}>
                  <label htmlFor="review-note">为当前区间写下意见</label>
                  <textarea
                    id="review-note"
                    name="note"
                    autoComplete="off"
                    required
                    maxLength={2000}
                    value={note}
                    onChange={(event) => setNote(event.target.value)}
                    placeholder="记录你在这段序列中需要核对的内容…"
                  />
                  <div>
                    <button
                      className="primary"
                      disabled={!!rangeError || p.data.reviews.length >= 100}
                    >
                      记录意见
                    </button>
                    {note ? (
                      <button type="button" onClick={() => setNote("")}>
                        放弃意见
                      </button>
                    ) : null}
                  </div>
                </fieldset>
              </form>
              <div className="review-list">
                {p.data.reviews.map((review, index) => (
                  <article key={review.id}>
                    <div className="review-heading">
                      <span>
                        #{index + 1}　{review.start}–{review.end}（
                        {review.strand === 1 ? "+" : "−"}）
                      </span>
                      <button
                        className="danger"
                        aria-label={"删除审阅记录 " + (index + 1)}
                        disabled={recordsLocked}
                        onClick={() => {
                          if (confirm("删除这条审阅记录？"))
                            p.setData({
                              ...p.data,
                              reviews: p.data.reviews.filter(
                                (item) => item.id !== review.id,
                              ),
                            });
                        }}
                      >
                        ×
                      </button>
                    </div>
                    <p>{review.note}</p>
                    <footer>
                      <label>
                        <input
                          type="checkbox"
                          disabled={recordsLocked}
                          checked={review.done}
                          onChange={(event) =>
                            p.setData({
                              ...p.data,
                              reviews: p.data.reviews.map((item) =>
                                item.id === review.id
                                  ? { ...item, done: event.target.checked }
                                  : item,
                              ),
                            })
                          }
                        />
                        已核对
                      </label>
                      <time>{new Date(review.createdAt).toLocaleString()}</time>
                    </footer>
                  </article>
                ))}
              </div>
              {!p.data.reviews.length ? (
                <p className="empty-note">
                  意见与区间一起保存，之后可以继续核对。
                </p>
              ) : null}
            </section>
          </div>
        </>
      ) : (
        <section className="empty-sequence">
          <Dna aria-hidden="true" size={60} />
          <h2>从你的序列开始</h2>
          <p>输入或导入 DNA 后，环形、线性视图与标注记录会出现在这里。</p>
        </section>
      )}
    </main>
  );
}
