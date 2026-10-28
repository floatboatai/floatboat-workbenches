import { createBuildContext, exportAsBytes } from "@penpot/library";
import { unzipSync, strFromU8 } from "fflate";
import { kitValue, type Kit, seed } from "../contracts/domain.ts";
import { isRecord } from "../contracts/project.ts";
export async function buildNative(input: unknown, title: string) {
  const kit = kitValue(input),
    ctx = createBuildContext();
  ctx.addFile({ name: title, isShared: true });
  const file = ctx.currentFileId,
    colorIds = new Map<string, string>(),
    fontIds = new Map<string, string>();
  for (const c of kit.colors)
    colorIds.set(
      c.id,
      ctx.addLibraryColor({ name: c.name, color: c.value, opacity: 1 }),
    );
  for (const f of kit.fonts)
    fontIds.set(
      f.id,
      ctx.addLibraryTypography({
        name: f.name,
        fontId: f.family === "Source Sans Pro" ? "sourcesanspro" : undefined,
        fontVariantId: "regular",
        fontFamily: f.family,
        fontSize: f.size,
        fontWeight: f.weight,
        fontStyle: "normal",
        lineHeight: "1.3",
        letterSpacing: "0",
      }),
    );
  ctx.addPage({ name: "组件样本" });
  let x = 0;
  for (const sample of kit.samples) {
    const bg = kit.colors.find((c) => c.id === sample.colorId)!,
      fg = kit.colors.find((c) => c.id === sample.foregroundId)!,
      font = kit.fonts.find((f) => f.id === sample.fontId)!;
    const width = Number(sample.width),
      height = Number(sample.height),
      componentId = ctx.genId();
    const board = ctx.addBoard({
      name: sample.name,
      x,
      y: 0,
      width,
      height,
      componentId,
      componentFile: file,
      componentRoot: true,
      mainInstance: true,
      fills: [
        {
          fillColor: bg.value,
          fillOpacity: 1,
          fillColorRefId: colorIds.get(bg.id),
          fillColorRefFile: file,
        },
      ],
      r1: Number(sample.radius),
      r2: Number(sample.radius),
      r3: Number(sample.radius),
      r4: Number(sample.radius),
    });
    const content = (text: string, size: string) => ({
      type: "root",
      children: [
        {
          type: "paragraph-set",
          children: [
            {
              type: "paragraph",
              fontFamily: font.family,
              fontId:
                font.family === "Source Sans Pro" ? "sourcesanspro" : undefined,
              fontSize: size,
              fontWeight: font.weight,
              lineHeight: "1.3",
              children: [
                {
                  text,
                  fontFamily: font.family,
                  fontId:
                    font.family === "Source Sans Pro"
                      ? "sourcesanspro"
                      : undefined,
                  fontSize: size,
                  fontWeight: font.weight,
                  typographyRefId: fontIds.get(font.id),
                  typographyRefFile: file,
                  fills: [
                    {
                      fillColor: fg.value,
                      fillOpacity: 1,
                      fillColorRefId: colorIds.get(fg.id),
                      fillColorRefFile: file,
                    },
                  ],
                },
              ],
            },
          ],
        },
      ],
    });
    ctx.addText({
      name: "标题",
      x: x + 24,
      y:
        sample.kind === "button"
          ? Math.max(4, (height - Number(font.size) * 1.4) / 2)
          : 30,
      width: width - 48,
      height: sample.kind === "button" ? Number(font.size) * 1.4 : 85,
      content: content(sample.label, font.size),
      growType: "fixed",
    });
    if (sample.kind === "card")
      ctx.addText({
        name: "说明",
        x: x + 24,
        y: 130,
        width: width - 48,
        height: 90,
        content: content(sample.body, "16"),
        growType: "fixed",
      });
    ctx.closeBoard();
    ctx.addComponent({
      componentId,
      frameId: board,
      pageId: ctx.currentPageId,
      fileId: file,
      name: sample.name,
      path: "样本",
    });
    x += width + 80;
  }
  ctx.closePage();
  ctx.closeFile();
  return exportAsBytes(ctx);
}
export function importAssets(data: string) {
  if (data.length > 4000000 || !/^[A-Za-z0-9+/]+={0,2}$/.test(data))
    throw new Error("原生包格式或大小无效。");
  let total = 0,
    count = 0;
  const zip = unzipSync(Buffer.from(data, "base64"), {
    filter: (f) => {
      count++;
      total += f.originalSize;
      if (count > 5000 || total > 12000000 || f.originalSize > 5000000)
        throw new Error("原生包展开内容过大。");
      return (
        f.name === "manifest.json" ||
        /^files\/[^/]+\.json$/.test(f.name) ||
        /^files\/[^/]+\/(colors|typographies)\/[^/]+\.json$/.test(f.name)
      );
    },
  });
  const manifest: unknown = JSON.parse(
    strFromU8(zip["manifest.json"] ?? new Uint8Array()),
  );
  if (
    !isRecord(manifest) ||
    manifest.type !== "penpot/export-files" ||
    !Array.isArray(manifest.files)
  )
    throw new Error("需要Penpot原生导出包。");
  const colors: Kit["colors"] = [],
    fonts: Kit["fonts"] = [];
  let skipped = 0;
  for (const file of manifest.files) {
    if (!isRecord(file) || typeof file.id !== "string") continue;
    const bytes = zip["files/" + file.id + ".json"];
    if (!bytes) continue;
    const v: unknown = JSON.parse(strFromU8(bytes));
    if (!isRecord(v)) continue;
    if (isRecord(v.colors))
      for (const [id, raw] of Object.entries(v.colors)) {
        if (
          isRecord(raw) &&
          typeof raw.name === "string" &&
          typeof raw.color === "string" &&
          /^#[0-9a-f]{6}$/i.test(raw.color)
        )
          colors.push({ id, name: raw.name, value: raw.color });
        else skipped++;
      }
    if (isRecord(v.typographies))
      for (const [id, raw] of Object.entries(v.typographies)) {
        if (
          isRecord(raw) &&
          typeof raw.name === "string" &&
          typeof raw.fontFamily === "string"
        )
          fonts.push({
            id,
            name: raw.name,
            family: raw.fontFamily,
            size: String(raw.fontSize ?? 16),
            weight: String(raw.fontWeight ?? 400),
          });
        else skipped++;
      }
  }
  for (const [path, bytes] of Object.entries(zip)) {
    const m = /^files\/([^/]+)\/(colors|typographies)\/([^/]+)\.json$/.exec(
      path,
    );
    if (!m || !manifest.files.some((f) => isRecord(f) && f.id === m[1]))
      continue;
    const raw: unknown = JSON.parse(strFromU8(bytes));
    if (!isRecord(raw)) continue;
    if (m[2] === "colors") {
      if (
        typeof raw.name === "string" &&
        typeof raw.color === "string" &&
        /^#[0-9a-f]{6}$/i.test(raw.color)
      )
        colors.push({ id: m[3], name: raw.name, value: raw.color });
      else skipped++;
    } else if (
      typeof raw.name === "string" &&
      typeof raw.fontFamily === "string"
    )
      fonts.push({
        id: m[3],
        name: raw.name,
        family: raw.fontFamily,
        size: String(raw.fontSize ?? 16),
        weight: String(raw.fontWeight ?? 400),
      });
    else skipped++;
  }
  if (!colors.length && !fonts.length)
    throw new Error("原生包没有可提取的纯色或字体资产；画板不会被导入。");
  return {
    data: kitValue({
      colors,
      fonts,
      samples: [],
      notes: "从原生Penpot文件提取颜色与字体；未导入画板。",
    }),
    skipped,
  };
}
