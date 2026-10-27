import { useRef, useState } from "react";
import {
  seed,
  validateDeck,
  moveSlide,
  type Deck,
  type Slide,
} from "../contracts/domain";
import { download, Notice, ProjectPicker, useProjects } from "./workspace";
import { colors } from "./export-deck";
export function DeckApp() {
  const p = useProjects<Deck>(seed, validateDeck, "季度行动计划");
  const [selected, setSelected] = useState(0),
    [exporting, setExporting] = useState(false),
    [assistant, setAssistant] = useState(false),
    [prompt, setPrompt] = useState("");
  const file = useRef<HTMLInputElement>(null);
  const index = Math.min(selected, p.data.slides.length - 1),
    slide = p.data.slides[index],
    palette = colors[p.data.theme];
  const update = (key: keyof Omit<Slide, "id">, value: string) =>
    p.setData((deck) => ({
      ...deck,
      slides: deck.slides.map((item, i) =>
        i === index ? { ...item, [key]: value } : item,
      ),
    }));
  function add() {
    if (p.data.slides.length >= 30) {
      p.setError("最多支持 30 页。");
      return;
    }
    p.setData((deck) => ({
      ...deck,
      slides: [
        ...deck.slides,
        {
          id: crypto.randomUUID(),
          title: "新的一页",
          kicker: "NEXT IDEA",
          body: "写下这一页的核心观点",
          notes: "",
        },
      ],
    }));
    setSelected(p.data.slides.length);
  }
  function remove() {
    if (p.data.slides.length === 1) {
      p.setError("演示文稿至少保留一页。");
      return;
    }
    if (!confirm(`删除第 ${index + 1} 页「${slide.title}」吗？`)) return;
    p.setData((deck) => ({
      ...deck,
      slides: deck.slides.filter((_, i) => i !== index),
    }));
    setSelected(Math.max(0, index - 1));
  }
  function reorder(direction: -1 | 1) {
    const next = moveSlide(p.data, index, direction);
    if (next !== p.data) {
      p.setData(next);
      setSelected(index + direction);
    }
  }
  async function exportFile() {
    setExporting(true);
    p.setError("");
    try {
      const { buildPptx } = await import("./export-deck");
      download(
        await buildPptx(p.data, p.title),
        `${p.title || "演示文稿"}.pptx`,
      );
    } catch (error) {
      p.report(error);
    } finally {
      setExporting(false);
    }
  }
  async function importFile(input: File) {
    try {
      if (input.size > 900000) throw new Error("文件超过 900 KB。");
      const next = validateDeck(JSON.parse(await input.text()));
      if (p.dirty && !confirm("使用导入的文稿替换未保存内容吗？")) return;
      p.setData(next);
      setSelected(0);
    } catch (error) {
      p.report(error);
    }
  }
  return (
    <main className="deck-app">
      <a className="skip" href="#deck-stage">
        跳到演示舞台
      </a>
      <header className="deck-header">
        <div className="deck-brand">
          <span aria-hidden="true">▱</span>
          <div>
            <p>PRESENTATION STUDIO</p>
            <h1>演示编排室</h1>
          </div>
        </div>
        <div className="deck-projects">
          <ProjectPicker
            items={p.items}
            id={p.current?.id}
            disabled={p.busy || exporting}
            onOpen={(id) => {
              setSelected(0);
              void p.open(id);
            }}
          />
          <button
            disabled={p.busy}
            onClick={() => {
              if (p.fresh()) setSelected(0);
            }}
          >
            新建
          </button>
          <button
            disabled={!p.current || p.busy}
            onClick={() => void p.remove()}
          >
            删除文稿
          </button>
        </div>
        <button
          className="publish"
          disabled={exporting}
          onClick={() => void exportFile()}
        >
          {exporting ? "正在导出…" : "导出 PPTX ↗"}
        </button>
      </header>
      <div className="deck-document">
        <input
          aria-label="文稿名称"
          name="deckTitle"
          autoComplete="off"
          value={p.title}
          maxLength={120}
          onChange={(event) => p.setTitle(event.target.value)}
        />
        <span role="status">
          {p.dirty ? "未保存" : "就绪"} · {p.data.slides.length} 页
        </span>
        <div>
          <button onClick={() => void p.save()} disabled={p.busy}>
            {p.busy ? "保存中…" : "保存文稿"}
          </button>
          <button onClick={() => file.current?.click()}>导入 JSON</button>
          <button
            onClick={() =>
              download(
                new Blob([JSON.stringify(p.data, null, 2)], {
                  type: "application/json",
                }),
                `${p.title}.json`,
              )
            }
          >
            导出 JSON
          </button>
          <button
            aria-expanded={assistant}
            onClick={() => setAssistant((value) => !value)}
          >
            生成大纲
          </button>
        </div>
      </div>
      <Notice error={p.error} notice={p.notice} />
      {assistant ? (
        <section className="deck-ai">
          <form
            onSubmit={(event) => {
              event.preventDefault();
              void p.generate(prompt);
            }}
          >
            <label htmlFor="deck-prompt">这次演示要传递什么？</label>
            <textarea
              id="deck-prompt"
              name="deckPrompt"
              autoComplete="off"
              required
              value={prompt}
              maxLength={12000}
              onChange={(event) => setPrompt(event.target.value)}
              placeholder="例如：为新产品发布做一份 5 页演示，受众是销售团队…"
            />
            <button className="publish" disabled={p.aiBusy}>
              {p.aiBusy ? "正在构思…" : "生成待确认大纲"}
            </button>
          </form>
          {p.suggestion ? (
            <div className="deck-outline">
              <h2>生成的大纲 · 尚未采用</h2>
              <ol>
                {p.suggestion.slides.map((item) => (
                  <li key={item.id}>
                    <strong>{item.title}</strong>
                    <p>{item.body}</p>
                  </li>
                ))}
              </ol>
              <button
                onClick={() => {
                  if (confirm("采用这个大纲并替换当前页面吗？")) {
                    p.applySuggestion();
                    setSelected(0);
                  }
                }}
              >
                采用大纲
              </button>
              <button onClick={p.discardSuggestion}>放弃生成稿</button>
            </div>
          ) : null}
        </section>
      ) : null}
      <nav className="filmstrip" aria-label="页面缩略图">
        {p.data.slides.map((item, i) => (
          <button
            key={item.id}
            className={i === index ? "active" : ""}
            aria-current={i === index ? "page" : undefined}
            onClick={() => setSelected(i)}
          >
            <span>{String(i + 1).padStart(2, "0")}</span>
            <strong>{item.title}</strong>
          </button>
        ))}
        <button className="add-slide" onClick={add}>
          ＋<span>添加页面</span>
        </button>
      </nav>
      <section className="stage-area" id="deck-stage" tabIndex={-1}>
        <div className="stage-top">
          <span>
            第 {index + 1} 页 / 共 {p.data.slides.length} 页
          </span>
          <label>
            主题{" "}
            <select
              aria-label="演示主题"
              value={p.data.theme}
              onChange={(event) =>
                p.setData((deck) => ({
                  ...deck,
                  theme: event.target.value as Deck["theme"],
                }))
              }
            >
              <option value="ember">暖橙 · 深夜</option>
              <option value="ink">蓝墨 · 清晨</option>
              <option value="paper">米白 · 纸张</option>
            </select>
          </label>
          <div>
            <button disabled={index === 0} onClick={() => reorder(-1)}>
              前移
            </button>
            <button
              disabled={index === p.data.slides.length - 1}
              onClick={() => reorder(1)}
            >
              后移
            </button>
            <button onClick={remove}>删除页面</button>
          </div>
        </div>
        <div
          className="slide-stage"
          style={{
            background: `#${palette.background}`,
            color: `#${palette.foreground}`,
          }}
        >
          <p className="slide-kicker" style={{ color: `#${palette.accent}` }}>
            {slide.kicker}
          </p>
          <h2>{slide.title}</h2>
          <div
            className="slide-rule"
            style={{ background: `#${palette.accent}` }}
          />
          <ul style={{ color: `#${palette.muted}` }}>
            {slide.body
              .split("\n")
              .filter((line) => line.trim())
              .map((line, i) => (
                <li key={i}>{line}</li>
              ))}
          </ul>
          <span className="slide-number">
            {String(index + 1).padStart(2, "0")}
          </span>
        </div>
        <p className="preview-hint">
          舞台用于内容编排，最终字体与排版以演示软件打开的 PPTX 为准。
        </p>
      </section>
      <section className="slide-fields" aria-label="当前页面内容">
        <label>
          页眉
          <input
            aria-label="页面页眉"
            name="slideKicker"
            autoComplete="off"
            maxLength={60}
            value={slide.kicker}
            onChange={(event) => update("kicker", event.target.value)}
          />
        </label>
        <label>
          标题
          <input
            aria-label="页面标题"
            name="slideTitle"
            autoComplete="off"
            maxLength={80}
            value={slide.title}
            onChange={(event) => update("title", event.target.value)}
          />
        </label>
        <label className="body-field">
          要点
          <textarea
            aria-label="页面要点"
            name="slideBody"
            autoComplete="off"
            maxLength={1000}
            rows={5}
            value={slide.body}
            onChange={(event) => update("body", event.target.value)}
          />
          <small>每行一个要点，最多 7 行，每行约 35 个汉字。</small>
        </label>
        <label className="notes-field">
          演讲备注
          <textarea
            aria-label="演讲备注"
            name="slideNotes"
            autoComplete="off"
            maxLength={4000}
            rows={5}
            value={slide.notes}
            onChange={(event) => update("notes", event.target.value)}
          />
        </label>
      </section>
      <input
        className="sr-only"
        type="file"
        ref={file}
        aria-label="导入演示文稿文件"
        accept=".json,application/json"
        onChange={(event) => {
          const selectedFile = event.target.files?.[0];
          event.target.value = "";
          if (selectedFile) void importFile(selectedFile);
        }}
      />
    </main>
  );
}
