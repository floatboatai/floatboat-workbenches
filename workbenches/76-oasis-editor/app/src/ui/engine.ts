import * as native from "../vendor/oasis-editor/oasis-editor.js";
import type { EditorDocument, OasisEditorClient } from "oasis-editor";
import { getPageConnection } from "./connection";
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
  const image = document.createElement("canvas");
  image.width = 580;
  image.height = 160;
  const x = image.getContext("2d")!;
  x.fillStyle = "#e9e3d9";
  x.fillRect(0, 0, 580, 160);
  x.fillStyle = "#67465e";
  for (let i = 0; i < 5; i++) {
    x.fillRect(38 + i * 102, 40, 62, 84);
    x.fillStyle = i % 2 ? "#67465e" : "#9aab91";
  }
  x.fillStyle = "#fbf8f0";
  x.fillRect(22, 123, 536, 5);
  const photo = native.createParagraph("");
  photo.runs = [
    {
      id: crypto.randomUUID(),
      kind: "image",
      text: "\ufffc",
      image: {
        src: image.toDataURL("image/png"),
        width: 580,
        height: 160,
        alt: "书架上的五册书，阅读活动插图",
      },
    },
  ];
  const intro = native.createParagraph(
    "从一本书开始，让邻里重新相遇。这个春天，我们邀请社区成员分享读书笔记、交换旧书，并共同完成一份属于街区的阅读地图。",
  );
  const blocks = [
    native.createParagraph("社区文化项目 · 春季刊 / 2026"),
    native.createHeading("把阅读带回街角"),
    native.createParagraph("春日社区阅读计划 · 编辑工作稿"),
    photo,
    intro,
    native.createHeading("01  活动与交付", { level: 2 }),
    native.createTable([
      ["阶段", "安排", "交付内容"],
      ["筹备", "第一周", "邀请读者、整理书单"],
      ["共读", "第二至三周", "开展三场分享会"],
      ["归档", "第四周", "发布阅读地图与活动记录"],
    ]),
  ];
  for (let n = 1; n <= 9; n++)
    blocks.push(
      native.createHeading(
        `${String(n + 1).padStart(2, "0")}  ${["读者的来信", "街角阅读空间", "记录与分享"][n % 3]}`,
        { level: 2 },
      ),
      native.createParagraph(
        "每一次交流都值得被认真记录。请在校样时核对人名、时间与图片说明，保留参与者原本的表达。我们会把不同年龄读者的声音编入手册，让一份短小的文档也能承载丰富的故事。".repeat(
          n % 2 ? 3 : 2,
        ),
      ),
    );
  return native.createDocument({ title: "春日社区阅读计划", blocks });
}
export function mountEditor(
  host: HTMLElement,
  doc: EditorDocument | null,
): OasisEditorClient {
  return native.createOasisEditor(host, {
    ui: {
      theme: "light",
      locale: "en",
      showChrome: false,
      showTitleBar: false,
      showToolbar: false,
      showMenubar: false,
      showOutline: false,
      viewportHeight: "100%",
    },
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
  return native.createDocument({
    title: "未命名文稿",
    blocks: [native.createParagraph("")],
  });
}
