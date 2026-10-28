import { humanJoints } from "./human-library.ts";
import { isRecord } from "./project.ts";
import { MAX_RESOURCE, MAX_SOURCE } from "./model.ts";
export interface GlbInfo {
  vertices: number;
  meshes: number;
  images: number;
  skins: number;
  animations: number;
  json: Record<string, unknown>;
  binary: Uint8Array;
}
export function inspectGlb(
  bytes: Uint8Array,
  kind: "source" | "bound" = "source",
): GlbInfo {
  const max = kind === "source" ? MAX_SOURCE : MAX_RESOURCE;
  if (bytes.length < 28 || bytes.length > max)
    throw Error(`GLB大小需在 28 B–${max / 1000000} MB 内。`);
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  if (
    view.getUint32(0, true) !== 0x46546c67 ||
    view.getUint32(4, true) !== 2 ||
    view.getUint32(8, true) !== bytes.length ||
    view.getUint32(16, true) !== 0x4e4f534a
  )
    throw Error("请导入完整的GLB 2.0文件。");
  const len = view.getUint32(12, true);
  if (len > 400000 || 20 + len + 8 > bytes.length)
    throw Error("GLB结构不完整。");
  const j: unknown = JSON.parse(
    new TextDecoder("utf-8", { fatal: true }).decode(bytes.slice(20, 20 + len)),
  );
  if (!isRecord(j)) throw Error("GLB JSON无效。");
  const pos = 20 + len;
  if (
    view.getUint32(pos + 4, true) !== 0x004e4942 ||
    pos + 8 + view.getUint32(pos, true) !== bytes.length
  )
    throw Error("GLB二进制块无效。");
  const binary = bytes.slice(pos + 8);
  const list = (name: string, max: number) => {
    const a = j[name] ?? [];
    if (!Array.isArray(a) || a.length > max || a.some((x) => !isRecord(x)))
      throw Error("GLB " + name + " 超出支持范围。");
    return a as Record<string, unknown>[];
  };
  const buffers = list("buffers", 1),
    views = list("bufferViews", 4000),
    accessors = list("accessors", 4000),
    meshes = list("meshes", 64),
    nodes = list("nodes", 256),
    images = list("images", 32),
    skins = list("skins", 64),
    animations = list("animations", 20);
  if (
    (Array.isArray(j.extensionsUsed) && j.extensionsUsed.length) ||
    (Array.isArray(j.extensionsRequired) && j.extensionsRequired.length)
  )
    throw Error("此版本不支持压缩或扩展GLB，请从建模软件导出普通GLB。");
  if (
    buffers.length !== 1 ||
    buffers[0].uri !== undefined ||
    typeof buffers[0].byteLength !== "number" ||
    buffers[0].byteLength > binary.length
  )
    throw Error("模型必须包含全部二进制资源，不支持外部URL。");
  for (const b of views) {
    const offset = b.byteOffset ?? 0,
      length = b.byteLength;
    if (
      b.buffer !== 0 ||
      !Number.isInteger(offset) ||
      !Number.isInteger(length) ||
      Number(offset) < 0 ||
      Number(length) < 0 ||
      Number(offset) + Number(length) > binary.length
    )
      throw Error("缓冲区越界。");
  }
  for (const a of accessors) {
    if (
      !Number.isInteger(a.count) ||
      Number(a.count) < 0 ||
      Number(a.count) > 100000 ||
      a.sparse !== undefined
    )
      throw Error("不支持稀疏或超限访问器。");
  }
  if (kind === "bound") {
    if (
      skins.length !== 1 ||
      !Array.isArray(skins[0].joints) ||
      skins[0].joints.length !== humanJoints.length ||
      new Set(skins[0].joints).size !== humanJoints.length ||
      skins[0].joints.some((i) => !Number.isInteger(i) || !nodes[Number(i)])
    )
      throw Error("绑定结果缺少有效骨架。");
    const names = (skins[0].joints as number[]).map((i) => nodes[i].name);
    if (humanJoints.some((name) => !names.includes(name)))
      throw Error("绑定结果与当前人形动作库不匹配。");
    for (const node of nodes)
      if (node.mesh !== undefined && node.skin !== 0)
        throw Error("绑定结果包含未绑定网格。");
  }
  const component = (a: Record<string, unknown>, i: number, lane: number) => {
    const bv = views[Number(a.bufferView)],
      type = a.componentType,
      width = type === 5126 ? 4 : type === 5123 ? 2 : type === 5121 ? 1 : 0;
    if (!bv || !width || a.type !== "VEC4") throw Error("蒙皮访问器格式无效。");
    const local = Number(a.byteOffset ?? 0),
      stride = Number(bv.byteStride ?? width * 4),
      offset = Number(bv.byteOffset ?? 0) + local + i * stride + lane * width;
    if (
      !Number.isSafeInteger(offset) ||
      !Number.isSafeInteger(stride) ||
      stride < width * 4 ||
      local < 0 ||
      local + i * stride + lane * width + width > Number(bv.byteLength) ||
      offset + width > binary.length
    )
      throw Error("蒙皮数据越界。");
    const view = new DataView(
      binary.buffer,
      binary.byteOffset,
      binary.byteLength,
    );
    return type === 5126
      ? view.getFloat32(offset, true)
      : type === 5123
        ? view.getUint16(offset, true)
        : view.getUint8(offset);
  };
  let vertices = 0;
  const meshCounts: number[] = [];
  for (const m of meshes) {
    let meshVertices = 0;
    if (!Array.isArray(m.primitives) || m.primitives.length > 32)
      throw Error("网格结构无效。");
    for (const p of m.primitives) {
      if (
        !isRecord(p) ||
        !isRecord(p.attributes) ||
        (p.mode !== undefined && p.mode !== 4) ||
        p.targets !== undefined
      )
        throw Error("仅支持三角网格，不支持Morph目标。");
      const idx = p.attributes.POSITION;
      if (!Number.isInteger(idx) || !accessors[Number(idx)])
        throw Error("网格位置数据缺失。");
      const a = accessors[Number(idx)],
        bv = views[Number(a.bufferView)];
      if (a.type !== "VEC3" || a.componentType !== 5126 || !bv)
        throw Error("位置必须为浮点三维坐标。");
      const offset = Number(bv.byteOffset ?? 0) + Number(a.byteOffset ?? 0),
        stride = Number(bv.byteStride ?? 12),
        count = Number(a.count);
      if (
        !Number.isSafeInteger(offset) ||
        offset < 0 ||
        !Number.isSafeInteger(stride) ||
        stride < 12 ||
        stride > 252 ||
        offset + (count - 1) * stride + 12 > binary.length
      )
        throw Error("顶点访问器越界。");
      const raw = new DataView(
        binary.buffer,
        binary.byteOffset,
        binary.byteLength,
      );
      for (let v = 0; v < count; v++)
        for (let k = 0; k < 3; k++) {
          const f = raw.getFloat32(offset + v * stride + k * 4, true);
          if (!Number.isFinite(f) || Math.abs(f) > 1000000)
            throw Error("模型包含非有限或过大的顶点。");
        }
      if (kind === "bound") {
        const joints = accessors[Number(p.attributes.JOINTS_0)],
          weights = accessors[Number(p.attributes.WEIGHTS_0)];
        if (
          !joints ||
          !weights ||
          joints.count !== count ||
          weights.count !== count ||
          ![5121, 5123].includes(Number(joints.componentType)) ||
          weights.componentType !== 5126
        )
          throw Error("绑定结果缺少有效关节或权重。");
        for (let i = 0; i < count; i++) {
          let sum = 0;
          for (let lane = 0; lane < 4; lane++) {
            const index = component(joints, i, lane),
              weight = component(weights, i, lane);
            if (
              index >= Number((skins[0].joints as unknown[]).length) ||
              !Number.isFinite(weight) ||
              weight < 0 ||
              weight > 1
            )
              throw Error("蒙皮关节或权重无效。");
            sum += weight;
          }
          if (Math.abs(sum - 1) > 0.0001) throw Error("顶点权重未归一化。");
        }
      }
      vertices += count;
      meshVertices += count;
    }
    meshCounts.push(meshVertices);
  }
  let instancedVertices = 0;
  for (const node of nodes) {
    if (node.mesh !== undefined) {
      if (
        !Number.isInteger(node.mesh) ||
        meshCounts[Number(node.mesh)] === undefined
      )
        throw Error("节点网格引用无效。");
      instancedVertices += meshCounts[Number(node.mesh)];
    }
  }
  if (vertices > 16000 || instancedVertices > 16000 || vertices < 1)
    throw Error("模型需包含 1–16000 个顶点。");
  if (kind === "source" && (skins.length || animations.length))
    throw Error("请导入尚未绑定、没有动画的静态人形GLB。");
  for (const node of nodes) {
    for (const prop of ["matrix", "translation", "rotation", "scale"]) {
      const v = node[prop];
      if (
        v !== undefined &&
        (!Array.isArray(v) ||
          v.length !==
            (
              { matrix: 16, translation: 3, rotation: 4, scale: 3 } as Record<
                string,
                number
              >
            )[prop] ||
          v.some(
            (n) =>
              typeof n !== "number" ||
              !Number.isFinite(n) ||
              Math.abs(n) > 1000000,
          ))
      )
        throw Error("模型变换包含无效数值。");
    }
  }
  const seen = new Set<number>(),
    visiting = new Set<number>();
  function visit(i: number) {
    if (!Number.isInteger(i) || !nodes[i]) throw Error("节点索引无效。");
    if (visiting.has(i)) throw Error("节点层级存在循环。");
    if (seen.has(i)) return;
    visiting.add(i);
    const c = nodes[i].children ?? [];
    if (!Array.isArray(c) || c.length > 256) throw Error("节点层级无效。");
    for (const n of c) visit(Number(n));
    visiting.delete(i);
    seen.add(i);
  }
  nodes.forEach((_, i) => visit(i));
  let pixels = 0;
  for (const im of images) {
    if (
      im.uri !== undefined ||
      !Number.isInteger(im.bufferView) ||
      (im.mimeType !== "image/png" && im.mimeType !== "image/jpeg")
    )
      throw Error("贴图必须是嵌入的PNG或JPEG。");
    const bv = views[Number(im.bufferView)];
    if (!bv) throw Error("贴图资源缺失。");
    const raw = binary.slice(
      Number(bv.byteOffset ?? 0),
      Number(bv.byteOffset ?? 0) + Number(bv.byteLength),
    );
    const dimensions = imageDimensions(raw, String(im.mimeType));
    pixels += dimensions.width * dimensions.height;
    if (pixels > 8_388_608) throw Error("模型贴图总像素超过预算。");
  }
  return {
    vertices,
    meshes: meshes.length,
    images: images.length,
    skins: skins.length,
    animations: animations.length,
    json: j,
    binary,
  };
}
export function imageDimensions(b: Uint8Array, mime: string) {
  let w = 0,
    h = 0;
  if (mime === "image/png" && b.length >= 24 && b[0] === 137 && b[1] === 80) {
    const d = new DataView(b.buffer, b.byteOffset, b.byteLength);
    w = d.getUint32(16);
    h = d.getUint32(20);
  } else if (
    mime === "image/jpeg" &&
    b.length >= 4 &&
    b[0] === 255 &&
    b[1] === 216
  ) {
    let i = 2;
    while (i + 8 < b.length) {
      if (b[i] !== 255) break;
      const marker = b[i + 1];
      i += 2;
      if (marker === 217 || marker === 218) break;
      const len = (b[i] << 8) + b[i + 1];
      if (len < 2 || i + len > b.length) break;
      if ([192, 193, 194].includes(marker)) {
        h = (b[i + 3] << 8) + b[i + 4];
        w = (b[i + 5] << 8) + b[i + 6];
        break;
      }
      i += len;
    }
  }
  if (w < 1 || h < 1 || w > 2048 || h > 2048)
    throw Error("贴图无效或超过2048×2048。");
  return { width: w, height: h };
}
