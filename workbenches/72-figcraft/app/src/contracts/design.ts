import { isRecord, boundedText } from "./project.ts";
export type Design = { file: string; notes: Record<string, string> };
export type View = {
  file: string;
  name: string;
  frames: {
    id: number;
    name: string;
    width: number;
    height: number;
    status: string;
  }[];
  selectedId: number;
  layers: {
    id: number;
    name: string;
    type: string;
    text: string;
    depth: number;
  }[];
  image: string;
  width: number;
  height: number;
  engine: string;
  artifact?: { format: string; data: string };
};
/** base64 长度上限对应 figdoc.MAX_FILE_BYTES（1.35 MB 原始字节）。 */
export const MAX_FILE_BASE64 = 1_800_000;
export function designValue(v: unknown): Design {
  if (!isRecord(v) || !isRecord(v.notes)) throw new Error("设计项目格式无效。");
  const file = boundedText(v.file, MAX_FILE_BASE64);
  if (!/^[A-Za-z0-9+/]+={0,2}$/.test(file))
    throw new Error("原生设计编码无效。");
  const notes: Record<string, string> = {};
  if (Object.keys(v.notes).length > 5000) throw new Error("校样记录过多。");
  for (const [id, note] of Object.entries(v.notes)) {
    if (!/^\d{1,12}$/.test(id)) throw new Error("画板编号无效。");
    notes[id] = boundedText(note, 12000);
  }
  return { file, notes };
}
export function viewValue(v: unknown): View {
  if (
    !isRecord(v) ||
    !Array.isArray(v.frames) ||
    !Array.isArray(v.layers) ||
    typeof v.selectedId !== "number" ||
    typeof v.width !== "number" ||
    typeof v.height !== "number"
  )
    throw new Error("原生引擎响应无效。");
  if (
    !Number.isFinite(v.width) ||
    !Number.isFinite(v.height) ||
    v.width < 1 ||
    v.height < 1
  )
    throw new Error("画板尺寸无效。");
  const frames = v.frames.map((x) => {
    if (
      !isRecord(x) ||
      typeof x.id !== "number" ||
      typeof x.width !== "number" ||
      typeof x.height !== "number"
    )
      throw new Error("画板响应无效。");
    return {
      id: x.id,
      name: boundedText(x.name, 200),
      width: x.width,
      height: x.height,
      status: boundedText(x.status, 50),
    };
  });
  const layers = v.layers.map((x) => {
    if (!isRecord(x) || typeof x.id !== "number" || typeof x.depth !== "number")
      throw new Error("图层响应无效。");
    return {
      id: x.id,
      name: boundedText(x.name, 200),
      type: boundedText(x.type, 100),
      text: boundedText(x.text, 12000),
      depth: x.depth,
    };
  });
  return {
    file: boundedText(v.file, MAX_FILE_BASE64),
    name: boundedText(v.name, 200),
    frames,
    selectedId: v.selectedId,
    layers,
    image: boundedText(v.image, 4_000_000),
    width: v.width,
    height: v.height,
    engine: boundedText(v.engine, 100),
    ...(isRecord(v.artifact)
      ? {
          artifact: {
            format: boundedText(v.artifact.format, 10),
            data: boundedText(v.artifact.data, 3000000),
          },
        }
      : {}),
  };
}
