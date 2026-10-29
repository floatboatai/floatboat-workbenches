import * as native from "../vendor/oasis-editor/oasis-editor.js";
import type { EditorDocument, OasisEditorClient } from "oasis-editor";
import { getPageConnection } from "./connection";
import { demoDocument } from "./demo";
import { zhCN } from "./locale-zh-CN";
import { A4_PORTRAIT } from "../contracts/review";
/** The native engine only ships en/pt-BR; Chinese menus and dialogs come from this table. */
const LOCALE = "zh-CN";
native.registerWorkbenchLocale(LOCALE, zhCN);
type UiConfig = NonNullable<Parameters<typeof native.createOasisEditor>[1]>["ui"];
let fonts: Promise<void> | undefined;
export function prepareFonts() {
  return (fonts ??= (async () => {
    const page = await getPageConnection();
    const bytes = await Promise.all(
      ["Regular", "Bold"].map(async (style) => {
        const r = await page.fetch(
          "/api/fonts/WorkbenchSansSC-" + style + ".ttf",
        );
        if (!r.ok) throw Error("本地字体读取失败，请重试；文稿未被修改。");
        const b = new Uint8Array(await r.arrayBuffer());
        if (b.length < 1000000) throw Error("字体不完整。");
        return b;
      }),
    );
    native.setWorkbenchFonts(bytes[0], bytes[1]);
    try {
      localStorage.setItem("oasis.welcomeSeen", "1");
      localStorage.setItem("oasis.preciseFontMode", "off");
    } catch {}
  })().catch((e) => {
    fonts = undefined;
    throw e;
  }));
}
export function example(): EditorDocument {
  return demoDocument();
}
/** Name written into new tracked changes and comments; a per-viewer preference. */
export function setRevisionAuthor(name: string) {
  native.setWorkbenchRevisionAuthor(name);
}
export function mountEditor(
  host: HTMLElement,
  doc: EditorDocument | null,
): OasisEditorClient {
  const ui = {
    theme: "light",
    locale: LOCALE,
    showChrome: false,
    showTitleBar: false,
    showToolbar: false,
    showMenubar: false,
    showOutline: false,
    viewportHeight: "100%",
  } as const;
  return native.createOasisEditor(host, {
    // The registered zh-CN table is selected by id; upstream types only list en/pt-BR.
    ui: ui as unknown as UiConfig,
    document: {
      initialDocument: doc ?? example(),
      persistenceEnabled: false,
      remoteWebFonts: false,
    },
  });
}
export async function importNative(bytes: Uint8Array, filename: string) {
  await prepareFonts();
  const host = document.createElement("div");
  host.style.cssText =
    "position:fixed;left:-12000px;width:1000px;height:800px;";
  document.body.append(host);
  const editor = mountEditor(
    host,
    native.createDocument({ blocks: [native.createParagraph("")] }),
  );
  try {
    await editor.ready;
    const r = await editor.io.import({ format: "docx", data: bytes, filename });
    if (!r.ok) throw Error(r.error.message);
    return {
      document: JSON.parse(
        JSON.stringify(editor.getDocument()),
      ) as EditorDocument,
      warnings: r.warnings.map((w) => w.message),
    };
  } finally {
    await editor.dispose();
    host.remove();
  }
}
export function blank() {
  const doc = native.createDocument({
    title: "未命名文稿",
    blocks: [native.createParagraph("")],
  });
  doc.pageSettings = { ...A4_PORTRAIT, margins: { ...A4_PORTRAIT.margins } };
  for (const section of doc.sections ?? [])
    section.pageSettings = { ...A4_PORTRAIT, margins: { ...A4_PORTRAIT.margins } };
  return doc;
}
