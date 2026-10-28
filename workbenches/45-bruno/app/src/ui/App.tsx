import { useEffect, useRef, useState } from "react";
import { zipSync, strToU8 } from "fflate";
import {
  Notice,
  ProjectPicker,
  useProjects,
  request,
  download,
} from "./workspace";
import {
  fieldsValue,
  parseResult,
  portable,
  receiptValue,
  restoreCollection,
  seed,
  validateCollection,
  exampleSource,
  type Fields,
  type Parsed,
  type Receipt,
  type SourceFile,
} from "../contracts/bruno";
import { isRecord } from "../contracts/project";

export function App() {
  const p = useProjects(seed, validateCollection, "服务接口", {
    storageKey: "bruno-v06",
    restoreDraftData: restoreCollection,
  });
  const latest = useRef(p);
  latest.current = p;
  const [selected, setSelected] = useState("request-status"),
    [tab, setTab] = useState("params"),
    [parsed, setParsed] = useState<Parsed | null>(null),
    [parseError, setParseError] = useState(""),
    [sidebar, setSidebar] = useState(true),
    [transitioning, setTransitioning] = useState(false),
    [composing, setComposing] = useState(false),
    [running, setRunning] = useState<string | null>(null);
  const transitionRef = useRef(false),
    runRef = useRef<string | null>(null),
    parseGeneration = useRef(0),
    operationGeneration = useRef(0),
    folder = useRef<HTMLInputElement>(null);
  const file = p.data.files.find((f) => f.id === selected) ?? p.data.files[0];
  const fileId = file?.id ?? "";
  const rawKey = `raw-${fileId}`,
    fieldsKey = `fields-${fileId}`;
  const raw =
    typeof p.draft[rawKey] === "string"
      ? String(p.draft[rawKey])
      : (file?.source ?? "");
  let fields: Fields | null = null;
  try {
    fields =
      p.draft[fieldsKey] !== undefined
        ? fieldsValue(p.draft[fieldsKey])
        : (parsed?.fields ?? null);
  } catch {
    /* malformed extras remain exportable */
  }
  const locked = p.loading || p.busy || transitioning;
  const unapplied =
    p.draft[fieldsKey] !== undefined ||
    (typeof p.draft[rawKey] === "string" && p.draft[rawKey] !== file?.source);
  const result = p.data.results.filter((r) => r.requestId === fileId).at(-1);
  useEffect(() => {
    folder.current?.setAttribute("webkitdirectory", "");
  }, []);
  useEffect(() => {
    setSelected(latest.current.data.files[0]?.id ?? "");
    setParsed(null);
    setParseError("");
    setRunning(null);
    setComposing(false);
    runRef.current = null;
    operationGeneration.current++;
  }, [p.documentKey]);
  useEffect(() => {
    const generation = ++parseGeneration.current;
    setParsed(null);
    setParseError("");
    if (!file) return;
    void request("/api/bru/parse", {
      method: "POST",
      body: JSON.stringify(file),
    })
      .then((v) => {
        if (generation === parseGeneration.current) setParsed(parseResult(v));
      })
      .catch((e) => {
        if (generation === parseGeneration.current)
          setParseError(e instanceof Error ? e.message : "解析失败。");
      });
  }, [p.documentKey, file?.id, file?.path, file?.source]);
  function setField(key: keyof Fields, value: string) {
    if (locked || !fields) return;
    const copy = { ...fields, [key]: value };
    p.setDraft((v) => ({ ...v, [fieldsKey]: copy }));
  }
  async function transition(action: () => Promise<boolean>) {
    if (transitionRef.current || runRef.current) return;
    transitionRef.current = true;
    setTransitioning(true);
    operationGeneration.current++;
    try {
      await action();
    } finally {
      transitionRef.current = false;
      setTransitioning(false);
    }
  }
  async function importFiles(list: FileList | null) {
    if (!list || !list.length || transitionRef.current || runRef.current)
      return;
    transitionRef.current = true;
    setTransitioning(true);
    operationGeneration.current++;
    try {
      const files = Array.from(list);
      if (files.reduce((n, f) => n + f.size, 0) > 1700000)
        throw new Error("导入超过 1.7 MB。");
      if (
        files.length === 1 &&
        !files[0].name.endsWith(".bru") &&
        files[0].name !== "bruno.json"
      ) {
        const v = portable(JSON.parse(await files[0].text()));
        await p.replace(v.data, v.title, v.extra);
      } else {
        const incoming: SourceFile[] = [];
        for (const f of files) {
          if (!f.name.endsWith(".bru") && f.name !== "bruno.json") continue;
          const path = f.webkitRelativePath
            ? f.webkitRelativePath.split("/").slice(1).join("/")
            : f.name;
          incoming.push({
            id: crypto.randomUUID(),
            path,
            source: await f.text(),
          });
        }
        if (!incoming.length)
          throw new Error("请选择 .bru 或 bruno.json 文件。");
        const data = restoreCollection({
          files: incoming,
          results: [],
          notes: "",
        });
        await p.replace(data, "导入集合", {});
      }
    } catch (e) {
      p.report(e);
    } finally {
      transitionRef.current = false;
      setTransitioning(false);
    }
  }
  async function apply(mode: "raw" | "fields") {
    if (!file || transitionRef.current || composing) return;
    const generation = ++operationGeneration.current,
      key = p.documentKey,
      id = file.id,
      source = raw;
    setComposing(true);
    p.setError("");
    try {
      let next = source;
      if (mode === "raw") {
        await request("/api/bru/parse", {
          method: "POST",
          body: JSON.stringify({ ...file, source }),
        });
      } else {
        const response = await request("/api/bru/compose", {
          method: "POST",
          body: JSON.stringify({ file, fields }),
        });
        if (!isRecord(response) || typeof response.source !== "string")
          throw new Error("原生序列化失败。");
        next = response.source;
      }
      if (
        generation !== operationGeneration.current ||
        latest.current.documentKey !== key
      )
        return;
      const candidate = {
        ...latest.current.data,
        files: latest.current.data.files.map((f) =>
          f.id === id ? { ...f, source: next } : f,
        ),
      };
      restoreCollection(candidate);
      p.setData(candidate);
      p.setDraft((v) => {
        const n = { ...v };
        if (mode === "raw" && n[rawKey] === source) delete n[rawKey];
        if (
          mode === "fields" &&
          JSON.stringify(n[fieldsKey]) === JSON.stringify(fields)
        )
          delete n[fieldsKey];
        return n;
      });
      p.setNotice("已更新 Bru 源文件。");
    } catch (e) {
      if (generation === operationGeneration.current) p.report(e);
    } finally {
      if (generation === operationGeneration.current) setComposing(false);
    }
  }
  function updateReceipt(receipt: Receipt, key: string) {
    if (latest.current.documentKey !== key) return;
    p.setData((v) => ({
      ...v,
      results: v.results.map((r) => (r.id === receipt.id ? receipt : r)),
    }));
  }
  async function send() {
    if (
      !file ||
      !fields ||
      runRef.current ||
      transitionRef.current ||
      unapplied
    )
      return;
    if (
      result?.state === "unknown" &&
      !confirm("上次回执未知。请先核对远端是否已执行；确认后将发起新的请求。")
    )
      return;
    if (p.data.results.length >= 4) {
      p.setError("已有 4 个快照。请导出完整工程，再清理不需要的快照。");
      return;
    }
    const key = p.documentKey,
      id = crypto.randomUUID();
    runRef.current = id;
    setRunning(id);
    const initial: Receipt = {
      id,
      documentId: key,
      requestId: file.id,
      state: "initiated",
      method: fields.method,
      url: fields.url,
      source: file.source,
      startedAt: new Date().toISOString(),
    };
    const data = { ...p.data, results: [...p.data.results, initial] };
    p.setError("");
    try {
      const saved = await p.save(data);
      if (!saved) throw new Error("发起记录尚未确认保存，请恢复保存后再发送。");
      if (latest.current.documentKey !== key) return;
      const receipt = receiptValue(
        await request("/api/http/run", {
          method: "POST",
          body: JSON.stringify({
            operationId: id,
            documentId: key,
            requestId: file.id,
            data,
          }),
        }),
      );
      updateReceipt(receipt, key);
    } catch (e) {
      updateReceipt(
        {
          ...initial,
          state: "unknown",
          message: e instanceof Error ? e.message : "回执未知，请读取回执。",
        },
        key,
      );
      p.report(e);
    } finally {
      if (latest.current.documentKey === key) {
        runRef.current = null;
        setRunning(null);
      }
    }
  }
  async function reconcile() {
    if (!result) return;
    const key = p.documentKey;
    try {
      const value = await request("/api/http/" + result.id);
      if (value === null) {
        p.setNotice("服务器未找到此操作记录；不会重发请求。");
        return;
      }
      const receipt = receiptValue(value);
      if (
        receipt.documentId !== result.documentId ||
        receipt.requestId !== result.requestId
      )
        throw new Error("回执不属于当前请求。");
      updateReceipt(receipt, key);
    } catch (e) {
      if (latest.current.documentKey === key) p.report(e);
    }
  }
  function newRequest() {
    if (locked || p.data.files.length >= 20) return;
    const id = crypto.randomUUID();
    p.setData((v) => ({
      ...v,
      files: [
        ...v.files,
        {
          id,
          path: `requests/request-${v.files.length + 1}.bru`,
          source: exampleSource,
        },
      ],
    }));
    setSelected(id);
  }
  function exportZip() {
    try {
      validateCollection(p.data);
      const entries: Record<string, Uint8Array> = {};
      for (const f of p.data.files) entries[f.path] = strToU8(f.source);
      if (!entries["bruno.json"])
        entries["bruno.json"] = strToU8(
          JSON.stringify(
            {
              version: "1",
              name: p.title,
              type: "collection",
              ignore: ["node_modules", ".git"],
            },
            null,
            2,
          ),
        );
      const bytes = zipSync(entries);
      download(
        new Blob([bytes as Uint8Array<ArrayBuffer>], {
          type: "application/zip",
        }),
        "collection-native.zip",
      );
    } catch (e) {
      p.report(e);
    }
  }
  return (
    <main>
      <a href="#request" className="skip">
        跳到请求编辑
      </a>
      <header>
        <div className="brand">
          <b>
            bruno<span> / </span>
          </b>
          <h1>接口调试台</h1>
        </div>
        <input
          aria-label="集合名称"
          maxLength={120}
          value={p.title}
          disabled={locked}
          onChange={(e) => p.setTitle(e.target.value)}
        />
        <span className={"save " + p.autoState.phase} role="status">
          {p.autoState.message}
        </span>
        <button onClick={() => setSidebar((v) => !v)} aria-expanded={sidebar}>
          集合
        </button>
      </header>
      <nav aria-label="集合操作">
        <ProjectPicker
          items={p.items}
          id={p.current?.id}
          disabled={locked || Boolean(running)}
          onOpen={(id) => void transition(() => p.open(id))}
        />
        <button
          disabled={locked || Boolean(running)}
          onClick={() => void transition(p.fresh)}
        >
          新建集合
        </button>
        <label className="file-button">
          导入文件
          <input
            aria-label="导入文件"
            type="file"
            multiple
            accept=".bru,.json"
            disabled={locked || Boolean(running)}
            onChange={(e) => {
              void importFiles(e.target.files);
              e.target.value = "";
            }}
          />
        </label>
        <label className="file-button">
          导入文件夹
          <input
            ref={folder}
            aria-label="导入文件夹"
            type="file"
            multiple
            disabled={locked || Boolean(running)}
            onChange={(e) => {
              void importFiles(e.target.files);
              e.target.value = "";
            }}
          />
        </label>
        <button onClick={exportZip}>原生集合 ZIP</button>
        <button
          onClick={() =>
            download(
              new Blob(
                [
                  JSON.stringify(
                    {
                      format: "bruno-workbench",
                      title: p.title,
                      data: p.data,
                      extra: p.draft,
                    },
                    null,
                    2,
                  ),
                ],
                { type: "application/json" },
              ),
              "bruno-project.json",
            )
          }
        >
          完整工程
        </button>
        <button onClick={p.exportDraft}>恢复稿</button>
        <button disabled={locked} onClick={() => void p.save()}>
          重试保存
        </button>
        {p.autoState.phase === "conflict" && p.current ? (
          <button onClick={() => void transition(() => p.open(p.current!.id))}>
            打开服务器版本
          </button>
        ) : null}
      </nav>
      <Notice error={p.error} notice={p.notice} />
      <div className={"workspace " + (!sidebar ? "collapsed" : "")}>
        {sidebar ? (
          <aside>
            <h2>
              COLLECTION <span>{p.data.files.length}</span>
            </h2>
            <button className="add" disabled={locked} onClick={newRequest}>
              ＋ 新请求
            </button>
            <div className="files">
              {p.data.files.map((f) => (
                <button
                  key={f.id}
                  className={f.id === fileId ? "active" : ""}
                  onClick={() => setSelected(f.id)}
                >
                  <span>{f.path.endsWith(".bru") ? "BRU" : "JSON"}</span>
                  {f.path}
                </button>
              ))}
            </div>
            <label>
              集合笔记
              <textarea
                aria-label="集合笔记"
                maxLength={10000}
                disabled={locked}
                value={p.data.notes}
                onChange={(e) =>
                  p.setData((v) => ({ ...v, notes: e.target.value }))
                }
              />
            </label>
            <p className="scope">
              源文件、手动填写的参数与响应会随工程导出。环境秘密绑定暂不支持。
            </p>
          </aside>
        ) : null}
        <section className="main-area" id="request">
          {file ? (
            <>
              <div className="request-title">
                <h2>{fields?.name ?? file.path}</h2>
                <button
                  onClick={() =>
                    download(
                      new Blob([file.source], { type: "text/plain" }),
                      file.path.split("/").at(-1) || "request.bru",
                    )
                  }
                >
                  导出当前文件
                </button>
              </div>
              <div className="urlbar">
                <select
                  aria-label="HTTP 方法"
                  value={fields?.method ?? "GET"}
                  disabled={
                    locked || !fields || Boolean(parsed?.blocked.length)
                  }
                  onChange={(e) => setField("method", e.target.value)}
                >
                  {[
                    "GET",
                    "POST",
                    "PUT",
                    "PATCH",
                    "DELETE",
                    "HEAD",
                    "OPTIONS",
                  ].map((m) => (
                    <option key={m}>{m}</option>
                  ))}
                </select>
                <input
                  aria-label="请求 URL"
                  maxLength={8000}
                  value={fields?.url ?? ""}
                  disabled={
                    locked || !fields || Boolean(parsed?.blocked.length)
                  }
                  spellCheck={false}
                  autoComplete="off"
                  placeholder="http://127.0.0.1:8080/status…"
                  onChange={(e) => setField("url", e.target.value)}
                />
                <button
                  className="send"
                  disabled={
                    locked ||
                    Boolean(running) ||
                    !parsed ||
                    !fields ||
                    Boolean(parsed.blocked.length) ||
                    unapplied
                  }
                  onClick={() => void send()}
                >
                  {running ? "发送中…" : "发送请求 →"}
                </button>
                {running ? (
                  <button
                    onClick={() =>
                      void request("/api/http/" + running + "/cancel", {
                        method: "POST",
                      })
                        .then(() =>
                          p.setNotice("已请求取消；远端是否执行需要核对。"),
                        )
                        .catch(p.report)
                    }
                  >
                    取消
                  </button>
                ) : null}
              </div>
              {parseError ? (
                <p role="alert" className="error">
                  {parseError}
                </p>
              ) : null}
              {parsed?.blocked.length ? (
                <div className="blocked" role="status">
                  {parsed.blocked.join(" ")}
                </div>
              ) : null}
              <div className="split">
                <section className="request-editor">
                  <div className="tabs">
                    <button
                      aria-pressed={tab === "params"}
                      onClick={() => setTab("params")}
                    >
                      请求参数
                    </button>
                    <button
                      aria-pressed={tab === "source"}
                      onClick={() => setTab("source")}
                    >
                      Bru 源文件
                    </button>
                    <span>{unapplied ? "有未应用编辑" : "源文件已同步"}</span>
                  </div>
                  {tab === "params" ? (
                    <fieldset
                      disabled={
                        locked || !fields || Boolean(parsed?.blocked.length)
                      }
                    >
                      <label>
                        请求名称
                        <input
                          maxLength={120}
                          value={fields?.name ?? ""}
                          onChange={(e) => setField("name", e.target.value)}
                        />
                      </label>
                      <label>
                        Query <small>每行 name: value · ~ 停用</small>
                        <textarea
                          aria-label="Query 参数"
                          maxLength={10000}
                          spellCheck={false}
                          value={fields?.query ?? ""}
                          onChange={(e) => setField("query", e.target.value)}
                        />
                      </label>
                      <label>
                        Headers
                        <textarea
                          aria-label="Headers"
                          maxLength={10000}
                          spellCheck={false}
                          value={fields?.headers ?? ""}
                          onChange={(e) => setField("headers", e.target.value)}
                        />
                      </label>
                      <label>
                        Body
                        <select
                          aria-label="Body 类型"
                          value={fields?.bodyType ?? "none"}
                          onChange={(e) => setField("bodyType", e.target.value)}
                        >
                          {["none", "json", "text", "xml"].map((t) => (
                            <option key={t}>{t}</option>
                          ))}
                        </select>
                      </label>
                      <textarea
                        aria-label="请求正文"
                        maxLength={30000}
                        spellCheck={false}
                        value={fields?.body ?? ""}
                        onChange={(e) => setField("body", e.target.value)}
                      />
                      <button
                        disabled={composing || !unapplied}
                        onClick={() => void apply("fields")}
                      >
                        {composing ? "序列化…" : "更新 Bru 源文件"}
                      </button>
                    </fieldset>
                  ) : (
                    <div className="source">
                      <label>
                        文件路径
                        <input
                          aria-label="文件路径"
                          maxLength={160}
                          disabled={locked}
                          value={file.path}
                          onChange={(e) =>
                            p.setData((v) => ({
                              ...v,
                              files: v.files.map((f) =>
                                f.id === file.id
                                  ? { ...f, path: e.target.value }
                                  : f,
                              ),
                            }))
                          }
                        />
                      </label>
                      <button
                        disabled={locked || Boolean(running)}
                        onClick={() => {
                          if (confirm("移除此源文件？请先导出需要保留的版本。"))
                            p.setData((v) => ({
                              ...v,
                              files: v.files.filter((f) => f.id !== file.id),
                            }));
                        }}
                      >
                        移除源文件
                      </button>
                      <label>
                        原生源文件
                        <textarea
                          aria-label="Bru 源文件编辑器"
                          maxLength={40000}
                          spellCheck={false}
                          disabled={locked}
                          value={raw}
                          onChange={(e) =>
                            p.setDraft((v) => ({
                              ...v,
                              [rawKey]: e.target.value,
                            }))
                          }
                        />
                      </label>
                      <button
                        disabled={locked || composing}
                        onClick={() => void apply("raw")}
                      >
                        解析并采用源文件
                      </button>
                    </div>
                  )}
                </section>
                <section className="response">
                  <div className="response-title">
                    <h2>响应检查</h2>
                    {result ? (
                      <span
                        className={
                          result.state === "complete"
                            ? "status-code"
                            : "state-unknown"
                        }
                      >
                        {result.status ??
                          (result.state === "initiated"
                            ? "待确认"
                            : "回执未知")}
                      </span>
                    ) : null}
                  </div>
                  {result ? (
                    <>
                      <div className="response-meta">
                        <span>{result.durationMs ?? "—"} ms</span>
                        <span>{result.bytes ?? "—"} bytes</span>
                        <span>{result.encoding ?? "等待回执"}</span>
                      </div>
                      <p role="status">
                        {result.message ?? "发起记录已保存；可读取执行回执。"}
                      </p>
                      <div className="response-actions">
                        <button onClick={() => void reconcile()}>
                          读取回执
                        </button>
                        <button
                          disabled={Boolean(running)}
                          onClick={() => {
                            if (
                              confirm("移除此响应快照？服务器操作记录仍保留。")
                            )
                              p.setData((v) => ({
                                ...v,
                                results: v.results.filter(
                                  (r) => r.id !== result.id,
                                ),
                              }));
                          }}
                        >
                          移除快照
                        </button>
                      </div>
                      <details>
                        <summary>响应 Headers</summary>
                        <pre>
                          {JSON.stringify(result.headers ?? {}, null, 2)}
                        </pre>
                      </details>
                      <h3>Body {result.truncated ? "· 已截断" : ""}</h3>
                      <pre className="response-body">
                        {result.body ?? "尚未收到正文。"}
                      </pre>
                      <details>
                        <summary>本次发送的 Bru</summary>
                        <pre>{result.source}</pre>
                      </details>
                    </>
                  ) : (
                    <div className="empty">
                      <span>↗</span>
                      <h3>准备检查接口</h3>
                      <p>
                        填写请求地址，更新源文件后发送。响应状态、头与正文会保存在这里。
                      </p>
                    </div>
                  )}
                </section>
              </div>
            </>
          ) : (
            <div className="empty">
              <h2>集合中尚无文件</h2>
              <button onClick={newRequest}>新请求</button>
            </div>
          )}
        </section>
      </div>
      <footer>
        原生 Bru · 显式 HTTP 调试{" "}
        <span>10 秒超时 / 64 KiB 正文 / 不自动重发</span>
      </footer>
    </main>
  );
}
