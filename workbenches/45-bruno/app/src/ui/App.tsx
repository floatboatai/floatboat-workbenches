import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Notice, useProjects, request, download } from "./workspace";
import { blankCollection, blankRequestSource, seed } from "../contracts/seed";
import { fileKind, portable, restoreCollection, validateCollection, type SourceFile } from "../contracts/bruno";
import { isRecord } from "../contracts/project";
import { buildTree, environments, firstRequest, historyFor, inheritedAuthLabel, uniquePath } from "./model";
import { CollectionTree } from "./CollectionTree";
import { buildCollection, readEntries, safeName, zipCollection } from "./transfer";
import { RequestEditor, type RequestTab } from "./RequestEditor";
import { RequestHead } from "./RequestHead";
import { ResponseConsole } from "./ResponseConsole";
import { SettingsPane } from "./SettingsPane";
import { CollectionMenu } from "./CollectionMenu";
import { EnvironmentDialog } from "./EnvironmentDialog";
import { useEnvironments } from "./useEnvironments";
import { useNativeSource } from "./useNativeSource";
import { useSender } from "./useSender";

const NO_FILES: SourceFile[] = [];
const downloadSource = (f: SourceFile) =>
  download(new Blob([f.source], { type: "text/plain" }), f.path.split("/").at(-1) || "request.bru");

export function App() {
  const p = useProjects(seed, validateCollection, "订单服务 API", {
    storageKey: "bruno-v06",
    restoreDraftData: restoreCollection,
  });
  const latest = useRef(p);
  latest.current = p;
  const files = p.data.files;
  const [transitioning, setTransitioning] = useState(false);
  const transitionRef = useRef(false);
  const locked = p.loading || transitioning;
  const [requestTab, setRequestTab] = useState<RequestTab>("params");
  const [menuOpen, setMenuOpen] = useState(false);
  const [envOpen, setEnvOpen] = useState(false);
  const [drawer, setDrawer] = useState(false);
  const [echoUrl, setEchoUrl] = useState<string | null>(null);
  const urlInput = useRef<HTMLInputElement>(null);

  const tree = useMemo(() => buildTree(files), [files]);
  const envList = useMemo(() => environments(files), [files]);
  const envFiles = useMemo(() => envList.map((e) => e.file), [envList]);
  const settingsFiles = useMemo(() => files.filter((f) => ["collection", "config"].includes(fileKind(f.path))), [files]);
  const selectedId = typeof p.draft.__selected === "string" ? p.draft.__selected : "";
  const file =
    files.find((f) => f.id === selectedId && fileKind(f.path) !== "environment") ??
    files.find((f) => f.id === firstRequest(files)) ??
    files.find((f) => fileKind(f.path) !== "environment");
  const fileId = file?.id ?? "";
  const kind = file ? fileKind(file.path) : null;
  const activeEnv =
    p.data.activeEnvironment && envList.some((e) => e.name === p.data.activeEnvironment) ? p.data.activeEnvironment : "";

  const native = useNativeSource(latest, file, envOpen ? envFiles : NO_FILES);
  const env = useEnvironments(latest, native.parsed);
  const sender = useSender(latest);
  const model = native.model;
  const blocked = native.currentParsed?.blocked ?? [];
  const warnings = native.currentParsed?.warnings ?? [];

  useEffect(() => {
    void request("/api/echo")
      .then((v) => setEchoUrl(isRecord(v) && typeof v.url === "string" ? v.url : null))
      .catch(() => setEchoUrl(null));
  }, []);

  const select = useCallback(
    (id: string) => {
      latest.current.setDraft((v) => (v.__selected === id ? v : { ...v, __selected: id }));
      sender.setShownReceipt(null);
      sender.setConfirmUnknown(false);
      sender.setSendError("");
      setDrawer(false);
    },
    [sender.setShownReceipt, sender.setConfirmUnknown, sender.setSendError], // eslint-disable-line react-hooks/exhaustive-deps
  );
  const history = useMemo(() => (fileId ? historyFor(p.data.results, fileId) : []), [p.data.results, fileId]);
  const snapshot = history.find((r) => r.id === sender.shownReceipt) ?? history[0];
  const shown = snapshot ? (sender.live[snapshot.id] ?? snapshot) : undefined;
  const last = history[0];

  const send = (force = false) =>
    sender.send(
      {
        file: kind === "request" ? file : undefined,
        model,
        rawPending: native.rawDraft !== undefined,
        blocked,
        pendingModel: native.reqEntry?.hash === null ? native.reqEntry.model : null,
        composeNow: native.composeNow,
        activeEnv,
        secrets: env.secrets,
        last,
        busy: () => transitionRef.current,
      },
      force,
    );
  const sendRef = useRef(send);
  sendRef.current = send;
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "Enter" && !document.querySelector("dialog[open]")) {
        e.preventDefault();
        void sendRef.current();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  function addRequest() {
    if (locked) return;
    const dir = file && ["request", "folder"].includes(kind ?? "") ? file.path.split("/").slice(0, -1).join("/") : "";
    const id = crypto.randomUUID();
    p.setData((v) => ({ ...v, files: [...v.files, { id, path: uniquePath(v.files, dir, "新请求"), source: blankRequestSource }] }));
    select(id);
    setRequestTab("params");
    requestAnimationFrame(() => urlInput.current?.focus());
  }
  function duplicateRequest() {
    if (!file || kind !== "request" || locked) return;
    const dir = file.path.split("/").slice(0, -1).join("/");
    const stem = file.path.split("/").at(-1)!.replace(/\.bru$/, "") + " 副本";
    const id = crypto.randomUUID();
    const source = file.source.replace(/^(\s*name:\s*)(.+)$/m, "$1$2 副本");
    p.setData((v) => ({ ...v, files: [...v.files, { id, path: uniquePath(v.files, dir, stem), source }] }));
    select(id);
  }
  function removeFile() {
    if (!file || locked || sender.runRef.current) return;
    if (!confirm(`删除「${file.path}」？响应历史也会移除；可先从集合菜单导出。`)) return;
    const id = file.id;
    p.setData((v) => ({ ...v, files: v.files.filter((f) => f.id !== id), results: v.results.filter((r) => r.requestId !== id) }));
    p.setDraft((v) => {
      const n = { ...v };
      for (const k of ["req-", "raw-", "env-"]) delete n[k + id];
      delete n.__selected;
      return n;
    });
  }
  const renamePath = (path: string) =>
    file && p.setData((v) => ({ ...v, files: v.files.map((f) => (f.id === file.id ? { ...f, path } : f)) }));
  const setActiveEnv = (name: string) => p.setData((v) => ({ ...v, activeEnvironment: name || undefined }));

  async function transition(action: () => Promise<boolean>) {
    if (transitionRef.current || sender.runRef.current) return;
    transitionRef.current = true;
    setTransitioning(true);
    try {
      if (await action()) setMenuOpen(false);
    } finally {
      transitionRef.current = false;
      setTransitioning(false);
    }
  }
  async function importFiles(list: FileList | null) {
    if (!list?.length) return;
    const picked = Array.from(list);
    await transition(async () => {
      try {
        if (picked.reduce((n, f) => n + f.size, 0) > 20 * 1024 * 1024) throw new Error("导入内容超过 20 MB。");
        if (picked.length === 1 && /\.json$/i.test(picked[0].name) && picked[0].name !== "bruno.json") {
          const v = portable(JSON.parse(await picked[0].text()));
          const ok = await p.replace(v.data, v.title, v.extra);
          if (ok) p.setNotice(`已导入工程「${v.title}」为新副本。`);
          return ok;
        }
        const { entries, rootName } = await readEntries(picked);
        const { data, title, skipped, invalid } = buildCollection(entries, rootName);
        const ok = await p.replace(data, title, {});
        if (ok)
          p.setNotice(
            `已导入 ${data.files.length} 个文件为新集合「${title}」${skipped ? `，跳过 ${skipped} 个非 Bru 文件` : ""}${invalid ? `（${invalid} 已作为草稿保留）` : ""}。`,
          );
        return ok;
      } catch (e) {
        p.report(e);
        return false;
      }
    });
  }
  function exportZip() {
    try {
      download(zipCollection(p.data, p.title), safeName(p.title) + ".zip");
    } catch (e) {
      p.report(e);
    }
  }
  const exportProject = () =>
    download(
      new Blob([JSON.stringify({ format: "bruno-workbench", title: p.title, data: p.data, extra: p.draft }, null, 2)], {
        type: "application/json",
      }),
      "bruno-project.json",
    );

  const inheritedAuth = useMemo(() => (file ? inheritedAuthLabel(files, file.path) : ""), [file, files]);
  const running = Boolean(sender.running);
  const phase = p.autoState.phase;

  return (
    <main className={"app" + (drawer ? " drawer-open" : "")}>
      <a href="#url" className="skip">
        跳到请求地址
      </a>
      <header className="topbar">
        <div className="brand" aria-hidden="true" translate="no">
          <b>bruno</b>
          <span>/</span>
        </div>
        <button className="collection-button" aria-haspopup="dialog" onClick={() => setMenuOpen(true)}>
          <span className="label">集合</span>
          <span className="title">{p.title}</span>
          <span aria-hidden="true">▾</span>
        </button>
        <button className="tree-toggle" aria-expanded={drawer} aria-controls="collection-tree" onClick={() => setDrawer((v) => !v)}>
          请求列表
        </button>
        <div className="env-picker">
          <select aria-label="当前环境" value={activeEnv} disabled={locked} onChange={(e) => setActiveEnv(e.target.value)}>
            <option value="">无环境</option>
            {envList.map((e) => (
              <option key={e.file.id} value={e.name}>
                {e.name}
              </option>
            ))}
          </select>
          <button aria-haspopup="dialog" onClick={() => setEnvOpen(true)}>
            环境
          </button>
        </div>
        <span className={"save-state " + phase} role="status">
          {p.autoState.message}
        </span>
        {["draft", "offline", "conflict"].includes(phase) ? (
          <button className="quiet" disabled={locked} onClick={() => (phase === "conflict" ? setMenuOpen(true) : void p.save())}>
            {phase === "conflict" ? "处理冲突" : "重试保存"}
          </button>
        ) : null}
      </header>
      <Notice error={p.error} notice={p.notice} />
      <div className="workspace">
        <aside id="collection-tree" className="sidebar">
          <CollectionTree
            tree={tree}
            title={p.title}
            selected={fileId}
            onSelect={select}
            onNew={addRequest}
            settingsFiles={settingsFiles}
            results={p.data.results}
            locked={locked}
          />
        </aside>
        {drawer ? <button className="scrim" aria-label="关闭请求列表" onClick={() => setDrawer(false)} /> : null}
        {!file ? (
          <section className="empty-main">
            <h2>集合里还没有请求</h2>
            <button onClick={addRequest}>＋ 新请求</button>
          </section>
        ) : kind === "request" ? (
          <section className="exchange" aria-label="请求与响应">
            <RequestHead
              file={file}
              model={model}
              setModel={(m) => {
                sender.setSendError("");
                native.setModel(m);
              }}
              locked={locked}
              rawPending={native.rawDraft !== undefined}
              running={running}
              syncLabel={native.syncLabel}
              syncError={native.syncError}
              pendingCompose={native.pendingCompose}
              urlInput={urlInput}
              onSend={(force) => void send(force)}
              onCancel={sender.cancel}
              onDuplicate={duplicateRequest}
              onExport={() => downloadSource(file)}
              onRemove={removeFile}
              guard={sender.confirmUnknown && last?.state === "unknown" ? last : null}
              onReconcile={(r) => void sender.reconcile(r)}
              onDismissGuard={() => sender.setConfirmUnknown(false)}
              sendError={sender.sendError}
              blocked={blocked}
              warnings={warnings}
            />
            <div className="split">
              <RequestEditor
                model={model}
                onChange={native.setModel}
                disabled={locked}
                tab={requestTab}
                setTab={setRequestTab}
                source={native.sourceText}
                rawPending={native.rawDraft !== undefined}
                onSource={native.setRaw}
                sourceError={native.sourceError}
                assertions={shown?.assertions}
                inheritedAuth={inheritedAuth}
              />
              <ResponseConsole
                receipt={shown}
                history={history}
                tab={sender.responseTab}
                setTab={sender.setResponseTab}
                onPick={(id) => {
                  sender.setShownReceipt(id);
                  sender.setResponseTab("body");
                }}
                onReconcile={(r) => void sender.reconcile(r)}
                onLoadFull={(r) => void sender.reconcile(r)}
                onClearHistory={() => {
                  if (confirm("清空此请求的响应历史？执行记录仍保留在服务器。"))
                    p.setData((v) => ({ ...v, results: v.results.filter((r) => r.requestId !== fileId) }));
                }}
                running={running}
                echoHint={activeEnv ? "" : "提示：右上角选择环境后，{{baseUrl}} 等变量才能解析。"}
              />
            </div>
          </section>
        ) : (
          <SettingsPane
            file={file}
            kind={kind ?? ""}
            locked={locked}
            syncLabel={native.syncLabel}
            syncError={native.syncError}
            warnings={warnings}
            sourceText={native.sourceText}
            sourceError={native.sourceError}
            onSource={native.setRaw}
            onPath={renamePath}
            notes={p.data.notes}
            onNotes={(notes) => p.setData((v) => ({ ...v, notes }))}
          />
        )}
      </div>
      {kind === "request" && file ? (
        <footer className="statusbar">
          <label className="path-field inline">
            <span>文件路径</span>
            <input className="mono" aria-label="请求文件路径" value={file.path} disabled={locked} onChange={(e) => renamePath(e.target.value)} />
          </label>
          <span>官方 @usebruno/lang 解析 · 显式发送 · 不执行脚本 · 30 秒超时 · 响应 2 MiB</span>
        </footer>
      ) : null}
      <CollectionMenu
        open={menuOpen}
        onClose={() => setMenuOpen(false)}
        title={p.title}
        setTitle={p.setTitle}
        items={p.items}
        currentId={p.current?.id}
        locked={locked || running}
        phase={phase}
        message={p.autoState.message}
        onBlank={() => void transition(() => p.replace(blankCollection(), "新集合", {}))}
        onSample={() => void transition(() => p.replace(structuredClone(seed), "订单服务 API", {}))}
        onOpen={(id) => void transition(() => p.open(id))}
        onImportFiles={(l) => void importFiles(l)}
        onExportZip={exportZip}
        onExportRequest={() => file && downloadSource(file)}
        onExportProject={exportProject}
        onExportDraft={p.exportDraft}
        onSave={() => void p.save()}
        onServerVersion={() => p.current && void transition(() => p.open(p.current!.id))}
        onRemove={() => void transition(p.remove)}
        canExportRequest={kind === "request"}
      />
      <EnvironmentDialog
        open={envOpen}
        onClose={() => setEnvOpen(false)}
        envs={envList}
        active={activeEnv}
        onActivate={setActiveEnv}
        varsFor={env.varsFor}
        errorFor={(id) => env.envError[id] ?? ""}
        onVars={env.setVars}
        secrets={env.secrets}
        onSecret={env.setSecret}
        onToggleSecret={env.toggleSecret}
        onAdd={env.add}
        onRename={env.rename}
        onRemove={env.remove}
        runtime={sender.runtime}
        onClearRuntime={sender.clearRuntime}
        echoUrl={echoUrl}
        locked={locked}
      />
    </main>
  );
}
