import { useEffect, useRef, useState, lazy, Suspense } from "react";
import { Editor } from "./Editor";
import { Paper } from "./Paper";
import {
  Notice,
  ProjectPicker,
  useProjects,
  download,
  request,
} from "./workspace";
import {
  seed,
  restoreInvoice,
  importInvoice,
  imageAsset,
  bytes,
  type InvoiceData,
} from "../contracts/document";
import { SOURCE_COMMIT, toNative, validateDocument } from "../contracts/native";
import { isRecord } from "../contracts/project";
const PdfProof = lazy(() =>
  import("./PdfProof").then((m) => ({ default: m.PdfProof })),
);
interface Proof {
  base64: string;
  filename: string;
  sha256: string;
  number: string;
  wire: string;
}
function ProofDialog({
  proof,
  onClose,
  onDownload,
}: {
  proof: Proof;
  onClose: () => void;
  onDownload: () => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const dialog = ref.current;
    dialog?.showModal();
    return () => dialog?.close();
  }, []);
  return (
    <dialog
      ref={ref}
      className="proof-dialog"
      onCancel={onClose}
      onClose={onClose}
    >
      <header>
        <div>
          <strong>PDF 校样</strong>
          <small>{proof.number}</small>
        </div>
        <div>
          <button onClick={onDownload}>下载 PDF</button>
          <button aria-label="关闭PDF校样" onClick={onClose}>
            关闭
          </button>
        </div>
      </header>
      <Suspense fallback={<p role="status">正在打开校样…</p>}>
        <PdfProof base64={proof.base64} />
      </Suspense>
    </dialog>
  );
}
function pdfBlob(proof: Proof) {
  return new Blob(
    [Uint8Array.from(atob(proof.base64), (c) => c.charCodeAt(0))],
    { type: "application/pdf" },
  );
}
export function App() {
  const p = useProjects(seed, validateDocument, "青禾书店 · 开业设计报价", {
    storageKey: "invoice-builder-v07",
    restoreDraftData: restoreInvoice,
  });
  const latest = useRef(p);
  latest.current = p;
  const moving = useRef(false),
    pdfGeneration = useRef(0),
    assetGeneration = useRef(0);
  const [transitioning, setTransitioning] = useState(false),
    [pdfBusy, setPdfBusy] = useState(false),
    [assetBusy, setAssetBusy] = useState(false),
    [proof, setProof] = useState<Proof | null>(null),
    [proofOpen, setProofOpen] = useState(false),
    [mobileView, setMobileView] = useState<"edit" | "paper">("edit");
  const section =
    typeof p.draft.section === "string" &&
    ["document", "items", "notes", "layout"].includes(p.draft.section)
      ? p.draft.section
      : "document";
  const raw = typeof p.draft.rawImport === "string" ? p.draft.rawImport : "";
  const locked = transitioning || p.loading || p.busy;
  let validation = "";
  try {
    validateDocument(p.data);
  } catch (e) {
    validation = e instanceof Error ? e.message : "请检查输入。";
  }
  function clearPreview() {
    pdfGeneration.current++;
    assetGeneration.current++;
    setPdfBusy(false);
    setAssetBusy(false);
    setProof(null);
    setProofOpen(false);
  }
  async function transition(action: () => Promise<boolean>) {
    if (moving.current) return;
    moving.current = true;
    clearPreview();
    setTransitioning(true);
    try {
      await action();
    } catch (e) {
      latest.current.report(e);
    } finally {
      moving.current = false;
      setTransitioning(false);
    }
  }
  function setData(change: (d: InvoiceData) => InvoiceData) {
    if (moving.current || latest.current.loading || latest.current.busy) return;
    setProof(null);
    setProofOpen(false);
    p.setData(change);
  }
  async function createProof() {
    if (moving.current || pdfBusy) return;
    let data: InvoiceData;
    try {
      data = validateDocument(structuredClone(latest.current.data));
    } catch (e) {
      p.report(e);
      return;
    }
    const key = latest.current.documentKey,
      token = ++pdfGeneration.current,
      wire = JSON.stringify(data);
    setPdfBusy(true);
    p.setError("");
    try {
      const response = await request("/api/pdf", {
        method: "POST",
        body: JSON.stringify({ data }),
      });
      if (
        key !== latest.current.documentKey ||
        token !== pdfGeneration.current ||
        moving.current
      )
        return;
      if (
        !isRecord(response) ||
        typeof response.base64 !== "string" ||
        response.base64.length > 16000000 ||
        typeof response.filename !== "string" ||
        typeof response.sha256 !== "string"
      )
        throw Error("PDF响应格式无效。");
      if (wire !== JSON.stringify(latest.current.data)) {
        p.setNotice("内容已更新，请重新生成校样。");
        return;
      }
      setProof({
        base64: response.base64,
        filename: response.filename,
        sha256: response.sha256,
        number: data.number,
        wire,
      });
      setProofOpen(true);
    } catch (e) {
      if (key === latest.current.documentKey && token === pdfGeneration.current)
        p.report(e);
    } finally {
      if (key === latest.current.documentKey && token === pdfGeneration.current)
        setPdfBusy(false);
    }
  }
  async function attach(slot: "logo" | "signature", file: File) {
    if (moving.current || assetBusy) return;
    const key = p.documentKey,
      token = ++assetGeneration.current;
    setAssetBusy(true);
    try {
      if (file.size > 150 * 1024)
        throw Error("图片原件限150 KiB，请先缩小文件。");
      if (!["image/png", "image/jpeg"].includes(file.type))
        throw Error("请选择PNG或JPEG原件。");
      const buffer = await file.arrayBuffer();
      const decoded = await createImageBitmap(
        new Blob([buffer], { type: file.type }),
      );
      const width = decoded.width,
        height = decoded.height;
      decoded.close();
      let text = "";
      for (const b of new Uint8Array(buffer)) text += String.fromCharCode(b);
      const asset = imageAsset({
        name: file.name,
        mime: file.type,
        base64: btoa(text),
        width,
        height,
      });
      if (
        key !== latest.current.documentKey ||
        token !== assetGeneration.current ||
        moving.current
      )
        return;
      setData((d) => ({ ...d, [slot]: asset }));
    } catch (e) {
      if (
        key === latest.current.documentKey &&
        token === assetGeneration.current
      )
        p.report(e);
    } finally {
      if (
        key === latest.current.documentKey &&
        token === assetGeneration.current
      )
        setAssetBusy(false);
    }
  }
  async function importText(text: string) {
    const imported = importInvoice(JSON.parse(text));
    for (const asset of [imported.data.logo, imported.data.signature]) {
      if (!asset) continue;
      const bitmap = await createImageBitmap(
        new Blob(
          [Uint8Array.from(atob(asset.base64), (c) => c.charCodeAt(0))],
          { type: asset.mime },
        ),
      );
      bitmap.close();
    }
    return p.replace(imported.data, imported.title, imported.extra);
  }
  async function importFile(file: File) {
    await transition(async () => {
      if (file.size > 12 * 1024 * 1024) throw Error("恢复文件超过12MiB。");
      const text = await file.text();
      try {
        return await importText(text);
      } catch (e) {
        if (text.length <= 150000)
          p.setDraft((d) => ({ ...d, rawImport: text }));
        throw e;
      }
    });
  }
  function fullExport() {
    try {
      const snapshot = { title: p.title, data: p.data, extra: p.draft };
      if (bytes(snapshot) > 1950000)
        throw Error("工作稿超过1.95MB，请导出恢复稿并拆分内容。");
      download(
        new Blob(
          [
            JSON.stringify({
              format: "invoice-builder-workbench",
              version: 1,
              sourceCommit: SOURCE_COMMIT,
              ...snapshot,
            }),
          ],
          { type: "application/json" },
        ),
        "invoice-project.json",
      );
    } catch (e) {
      p.report(e);
    }
  }
  function nativeExport() {
    try {
      download(
        new Blob([JSON.stringify(toNative(p.data).invoiceForm, null, 2)], {
          type: "application/json",
        }),
        "invoice-native.json",
      );
    } catch (e) {
      p.report(e);
    }
  }
  return (
    <main>
      <a className="skip" href="#invoice-editor">
        跳到单据编辑
      </a>
      <header className="masthead">
        <div className="identity">
          <span className="brand-mark" aria-hidden="true">
            IB
          </span>
          <div>
            <h1>单据桌</h1>
            <small>Invoice Builder</small>
          </div>
        </div>
        <label className="document-name">
          <span className="sr-only">项目名称</span>
          <input
            aria-label="项目名称"
            name="documentTitle"
            autoComplete="off"
            maxLength={120}
            disabled={locked}
            value={p.title}
            onChange={(e) => p.setTitle(e.target.value)}
          />
        </label>
        <div className={"save " + p.autoState.phase} role="status">
          <span className="save-dot" />
          {p.autoState.message}
        </div>
      </header>
      <nav className="file-strip" aria-label="单据文件">
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
          新建单据
        </button>
        <label className={"file-button " + (locked ? "disabled" : "")}>
          导入工程
          <input
            disabled={locked}
            aria-label="导入单据工程"
            type="file"
            accept=".json,application/json"
            onChange={(e) => {
              const f = e.target.files?.[0];
              e.target.value = "";
              if (f) void importFile(f);
            }}
          />
        </label>
        <button disabled={locked} onClick={fullExport}>
          单据工程
        </button>
        <button disabled={locked} onClick={p.exportDraft}>
          恢复稿
        </button>
        <details className="more-actions">
          <summary>更多</summary>
          <div>
            <button
              disabled={locked || Boolean(validation)}
              onClick={nativeExport}
            >
              上游文档 JSON
            </button>
            <button disabled={locked} onClick={() => void p.save()}>
              重试保存
            </button>
            {p.current ? (
              <>
                <button
                  disabled={locked}
                  onClick={() => void transition(() => p.open(p.current!.id))}
                >
                  打开服务器版本
                </button>
                <button
                  disabled={locked}
                  onClick={() => void transition(() => p.remove())}
                >
                  删除单据
                </button>
              </>
            ) : null}
          </div>
        </details>
      </nav>
      <Notice error={p.error} notice={p.notice} />
      <div className="mobile-switch" aria-label="工作视图">
        <button
          aria-pressed={mobileView === "edit"}
          onClick={() => setMobileView("edit")}
        >
          填写
        </button>
        <button
          aria-pressed={mobileView === "paper"}
          onClick={() => setMobileView("paper")}
        >
          纸张
        </button>
      </div>
      <div className={"desk mobile-" + mobileView}>
        <section
          className="editor-panel"
          id="invoice-editor"
          aria-label="单据编辑"
        >
          <nav className="editor-tabs" aria-label="编辑内容">
            {[
              ["document", "资料"],
              ["items", "明细"],
              ["notes", "说明"],
              ["layout", "版式"],
            ].map(([key, label]) => (
              <button
                key={key}
                aria-pressed={section === key}
                disabled={locked}
                onClick={() => p.setDraft((d) => ({ ...d, section: key }))}
              >
                {label}
              </button>
            ))}
          </nav>
          {validation ? (
            <p className="validation" role="status">
              {validation}
            </p>
          ) : null}
          <fieldset disabled={locked}>
            <Editor
              data={p.data}
              setData={setData}
              section={section}
              assetBusy={assetBusy}
              attach={(slot, file) => void attach(slot, file)}
            />
          </fieldset>
          <details className="raw-import">
            <summary>粘贴工程或保留的原文</summary>
            <label>
              <span className="sr-only">工程原文</span>
              <textarea
                aria-label="工程原文"
                value={raw}
                maxLength={150000}
                disabled={locked}
                onChange={(e) =>
                  p.setDraft((d) => ({ ...d, rawImport: e.target.value }))
                }
                spellCheck={false}
              />
            </label>
            <button
              disabled={locked || !raw}
              onClick={() => void transition(() => importText(raw))}
            >
              导入为新单据
            </button>
            <p>工程原文尚未应用时也会保存。</p>
          </details>
        </section>
        <section className="paper-panel" aria-label="单据校样台">
          <div className="paper-toolbar">
            <div>
              <span>
                {p.data.pageSize === "A4" ? "A4" : "Letter"} · {p.data.currency}
              </span>
              <small>内容预览</small>
            </div>
            <div>
              <button
                className="primary"
                disabled={locked || Boolean(validation) || pdfBusy}
                onClick={() => {
                  if (proof) setProofOpen(true);
                  else void createProof();
                }}
              >
                {pdfBusy
                  ? "正在生成…"
                  : proof
                    ? "查看 PDF 校样"
                    : "生成 PDF 校样"}
              </button>
              {proof ? (
                <button
                  disabled={locked}
                  onClick={() => download(pdfBlob(proof), proof.filename)}
                >
                  下载 PDF
                </button>
              ) : null}
            </div>
          </div>
          <Paper data={p.data} />
          <p className="paper-caption">
            分页与打印结果请查看 PDF 校样。单据与图片会保留在当前工作稿中。
          </p>
        </section>
      </div>
      {proof && proofOpen ? (
        <ProofDialog
          proof={proof}
          onClose={() => setProofOpen(false)}
          onDownload={() => download(pdfBlob(proof), proof.filename)}
        />
      ) : null}
    </main>
  );
}
