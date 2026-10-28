import { ReviewPane } from "./ReviewPane.tsx";
import { useState } from "react";
import { useReader } from "./useReader.ts";
import { ProjectPicker, Notice, download } from "./workspace.tsx";
import { DocumentPage } from "./DocumentPage.tsx";
import { readerValue, type IndexNode } from "../contracts/reader.ts";
import { blobRequest } from "./files.ts";
function Contents({
  nodes,
  page,
  onSelect,
  level = 0,
}: {
  nodes: IndexNode[];
  page: number;
  onSelect: (page: number) => void;
  level?: number;
}) {
  return (
    <ol className="chapter-list">
      {nodes.map((n) => (
        <li key={n.node_id}>
          <button
            className={
              page >= n.start_index && page <= n.end_index
                ? "chapter active"
                : "chapter"
            }
            style={{ paddingLeft: 12 + level * 13 }}
            onClick={() => onSelect(n.start_index)}
          >
            <span>{n.title}</span>
            <small>{String(n.start_index).padStart(2, "0")}</small>
          </button>
          {n.nodes?.length ? (
            <Contents
              nodes={n.nodes}
              page={page}
              onSelect={onSelect}
              level={level + 1}
            />
          ) : null}
        </li>
      ))}
    </ol>
  );
}
export function App() {
  const desk = useReader(),
    { project, index, mutable, pending, operation, status } = desk;
  const [tab, setTab] = useState("read"),
    [jsonOpen, setJsonOpen] = useState(false);
  const data = project.data,
    doc = data.document;
  const rawJson =
    typeof project.draft.inputJson === "string"
      ? project.draft.inputJson
      : JSON.stringify(data, null, 2);
  const setPage = (page: number) => {
    project.setData((d) => ({ ...d, page }));
    setTab("read");
  };
  const addNote = () => {
    if (data.notes.length >= 60) return;
    project.setData((d) => ({
      ...d,
      notes: [
        {
          id: crypto.randomUUID(),
          page: d.page,
          quote: (index?.pages[d.page - 1].text ?? "").slice(0, 140),
          text: "",
        },
        ...d.notes,
      ],
    }));
    setTab("review");
  };
  return (
    <div className="reader-app">
      <a className="skip" href="#reading-desk">
        跳到阅读区
      </a>
      <header className="topbar">
        <div className="brand">
          <span className="brand-mark" aria-hidden="true">
            页
          </span>
          <div>
            <h1>页间</h1>
            <small>PAGEINDEX / READING ROOM</small>
          </div>
        </div>
        <div className="project-heading">
          <input
            aria-label="项目名称"
            name="projectTitle"
            autoComplete="off"
            maxLength={120}
            value={project.title}
            disabled={!mutable}
            onChange={(e) => project.setTitle(e.target.value)}
          />
          <ProjectPicker
            items={project.items}
            id={project.current?.id}
            disabled={!mutable || !!pending}
            onOpen={(id) => {
              void desk.openProject(id);
            }}
          />
        </div>
        <div className="file-tools">
          <button
            disabled={!mutable || !!pending}
            onClick={() => void desk.newProject()}
          >
            新建
          </button>
          <button
            disabled={!mutable || !!pending}
            onClick={() => desk.portable.current?.click()}
          >
            导入项目
          </button>
          <button
            disabled={!mutable}
            className="solid"
            onClick={() => void desk.exportProject()}
          >
            导出项目
          </button>
        </div>
        <input
          ref={desk.file}
          hidden
          type="file"
          accept="application/pdf,.pdf"
          aria-label="上传PDF文件"
          onChange={(e) => {
            const f = e.target.files?.[0];
            e.currentTarget.value = "";
            if (f) void desk.loadPdf(f);
          }}
        />
        <input
          ref={desk.portable}
          hidden
          type="file"
          accept="application/json,.json"
          aria-label="导入完整阅读项目"
          onChange={(e) => {
            const f = e.target.files?.[0];
            e.currentTarget.value = "";
            if (f) void desk.importProject(f);
          }}
        />
      </header>
      <input
        ref={desk.recoveryFile}
        hidden
        type="file"
        accept="application/pdf,.pdf"
        aria-label="补齐恢复稿原PDF"
        onChange={(e) => {
          const file = e.target.files?.[0];
          e.currentTarget.value = "";
          if (file) void desk.loadPdf(file, true);
        }}
      />
      <div className="status-line">
        <span className={`save-state ${project.autoState.phase}`} role="status">
          {project.autoState.message}
        </span>
        <span>{operation || "原文、问题与便笺随项目保留"}</span>
        <details>
          <summary>恢复与连接</summary>
          <div className="recovery">
            <p>
              {status.parserMessage} · 模型{status.model ? "已连接" : "未连接"}
            </p>
            <button onClick={() => void desk.refreshStatus()}>重新检查</button>
            <button onClick={() => void project.save()}>重试保存</button>
            <button onClick={project.exportDraft}>导出恢复草稿</button>
            {project.current ? (
              <button
                onClick={() => void desk.openProject(project.current!.id)}
              >
                打开服务器版本
              </button>
            ) : null}
          </div>
        </details>
      </div>
      <Notice error={project.error} notice={project.notice} />
      {pending ? (
        <div className="pending" role="status">
          上次提问的提交回执尚未确认。
          <button disabled={!mutable} onClick={() => void desk.ask()}>
            核对原提交
          </button>
        </div>
      ) : null}
      {project.draft.importedPendingQuestion ? (
        <p className="pending">
          导入文件包含一条未确认提问，已保留其记录；不会自动执行。
        </p>
      ) : null}
      <nav className="mobile-tabs" aria-label="阅读工作区">
        {[
          ["outline", "目录"],
          ["read", "阅读"],
          ["review", "审阅"],
        ].map(([key, label]) => (
          <button
            key={key}
            aria-pressed={tab === key}
            onClick={() => setTab(key)}
          >
            {label}
          </button>
        ))}
      </nav>
      <main id="reading-desk">
        <fieldset className="desk" data-tab={tab} disabled={!mutable}>
          <aside className="outline">
            <div className="pane-label">
              <h2>文档目录</h2>
              <span>CONTENTS</span>
            </div>
            <div className="document-label">
              <strong>{doc?.name ?? "尚未打开文档"}</strong>
              {doc ? (
                <small>{doc.pages} 页 · PDF</small>
              ) : (
                <small>打开一份报告开始阅读</small>
              )}
            </div>
            <button
              className="upload"
              disabled={!mutable || !!pending}
              onClick={() => desk.file.current?.click()}
            >
              ＋ 打开 PDF
            </button>
            {index ? (
              <Contents
                nodes={index.index.structure}
                page={data.page}
                onSelect={setPage}
              />
            ) : doc ? (
              <p className="muted">正在读取章节…</p>
            ) : (
              <p className="muted">
                章节会随文档建立，点击目录可直接定位原页。
              </p>
            )}
            <div className="outline-footer">
              <button
                disabled={!index || !mutable}
                onClick={() =>
                  index &&
                  download(
                    new Blob([JSON.stringify(index.index, null, 2)], {
                      type: "application/json",
                    }),
                    "pageindex-structure.json",
                  )
                }
              >
                导出章节索引
              </button>
              <button
                onClick={() => setJsonOpen((v) => !v)}
                aria-expanded={jsonOpen}
              >
                项目 JSON 草稿
              </button>
            </div>
          </aside>
          <section className="reading">
            <div className="reading-toolbar">
              <span>{doc ? "原文阅读" : "阅读桌"}</span>
              {doc ? (
                <div className="page-controls">
                  <button
                    aria-label="上一页"
                    disabled={data.page <= 1 || !mutable}
                    onClick={() => setPage(data.page - 1)}
                  >
                    ←
                  </button>
                  <label>
                    <span className="sr-only">当前页码</span>
                    <select
                      aria-label="当前页码"
                      value={data.page}
                      onChange={(e) => setPage(Number(e.target.value))}
                    >
                      {Array.from({ length: doc.pages }, (_, i) => (
                        <option key={i} value={i + 1}>
                          {i + 1} / {doc.pages}
                        </option>
                      ))}
                    </select>
                  </label>
                  <button
                    aria-label="下一页"
                    disabled={data.page >= doc.pages || !mutable}
                    onClick={() => setPage(data.page + 1)}
                  >
                    →
                  </button>
                </div>
              ) : null}
              <button
                disabled={!doc || !mutable || data.notes.length >= 60}
                onClick={addNote}
              >
                摘录本页
              </button>
            </div>
            {index ? (
              <DocumentPage
                id={index.source.id}
                page={data.page}
                text={index.pages[data.page - 1]?.text ?? ""}
              />
            ) : (
              <div className="empty-paper">
                <small>一份文档，一张阅读桌</small>
                <h2>{doc ? "原PDF尚未恢复。" : "把问题带回原文。"}</h2>
                <p>
                  {doc
                    ? "选择最初的PDF，已有便笺、问题和草稿会保留。"
                    : "打开PDF，沿章节阅读，留下有页码的摘录与意见。"}
                </p>
                <button
                  className="solid"
                  disabled={!mutable || !!pending}
                  onClick={() =>
                    doc
                      ? desk.recoveryFile.current?.click()
                      : desk.file.current?.click()
                  }
                >
                  {doc ? "补齐原PDF" : "选择 PDF"}
                </button>
                <button
                  className="text-button"
                  disabled={!mutable || !!pending}
                  onClick={() => void desk.sample()}
                >
                  打开示例操作手册
                </button>
                <span>支持带文字的 PDF · 最多40页 / 8MiB</span>
              </div>
            )}
            {doc ? (
              <div className="paper-caption">
                <span>{doc.name}</span>
                <button
                  disabled={!mutable}
                  onClick={() =>
                    void blobRequest(`/api/documents/${doc.id}/pdf`)
                      .then((b) => download(b, doc.name))
                      .catch(project.report)
                  }
                >
                  下载原 PDF
                </button>
              </div>
            ) : null}
            {jsonOpen ? (
              <section className="json-panel">
                <h2>项目 JSON 草稿</h2>
                <label htmlFor="project-json">未应用内容也会保存</label>
                <textarea
                  id="project-json"
                  name="projectJson"
                  spellCheck={false}
                  autoComplete="off"
                  value={rawJson}
                  maxLength={180000}
                  onChange={(e) =>
                    project.setDraft((d) => ({
                      ...d,
                      inputJson: e.target.value,
                    }))
                  }
                />
                <button
                  disabled={!mutable || !!pending}
                  onClick={() => {
                    try {
                      const next = readerValue(JSON.parse(rawJson));
                      if (next.document?.id !== doc?.id)
                        throw new Error(
                          "请通过打开PDF创建新文档，JSON草稿不能替换原文件。",
                        );
                      project.setData(next);
                      project.setNotice("已应用项目内容。");
                    } catch (e) {
                      project.report(e);
                    }
                  }}
                >
                  应用 JSON
                </button>
              </section>
            ) : null}
          </section>
          <ReviewPane desk={desk} setPage={setPage} addNote={addNote} />
        </fieldset>
      </main>
      <footer className="footer">
        <span>PAGEINDEX · 页码连接每一条证据</span>
        <span>
          {doc
            ? `${doc.pages} 页 / ${data.notes.length} 条便笺`
            : "文档保存在当前工作台"}
        </span>
      </footer>
    </div>
  );
}
