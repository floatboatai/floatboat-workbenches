import {
  NodeIO,
  Document,
  ColorUtils,
  type Accessor,
} from "@gltf-transform/core";
import {
  BoxGeometry,
  CylinderGeometry,
  SphereGeometry,
  type BufferGeometry,
} from "three";
import { createHash } from "node:crypto";
import { inspectGlb } from "../contracts/glb.ts";
import { editsValue, jsonObject, type Edits } from "../contracts/asset.ts";
import type { Inspection } from "../contracts/inspection.ts";
const io = new NodeIO();
export const hash = (bytes: Uint8Array) =>
  createHash("sha256").update(bytes).digest("hex");
const arr = (a: Accessor | null) =>
  a
    ? {
        type: a.getType(),
        component: a.getComponentType(),
        normalized: a.getNormalized(),
        array: Array.from(a.getArray() ?? []),
        extras: a.getExtras(),
        name: a.getName(),
      }
    : null;
export function invariant(d: Document) {
  const r = d.getRoot(),
    nodes = r.listNodes();
  return JSON.stringify({
    geometry: r.listMeshes().map((m) => ({
      name: m.getName(),
      extras: m.getExtras(),
      primitives: m.listPrimitives().map((p) => ({
        mode: p.getMode(),
        extras: p.getExtras(),
        indices: arr(p.getIndices()),
        attributes: p.listSemantics().map((s) => [s, arr(p.getAttribute(s))]),
        material: r.listMaterials().indexOf(p.getMaterial()!),
      })),
    })),
    images: r.listTextures().map((t) => ({
      name: t.getName(),
      mime: t.getMimeType(),
      hash: hash(t.getImage() ?? new Uint8Array()),
      extras: t.getExtras(),
    })),
    nodes: nodes.map((n) => ({
      mesh: r.listMeshes().indexOf(n.getMesh()!),
      skin: r.listSkins().indexOf(n.getSkin()!),
      children: n.listChildren().map((x) => nodes.indexOf(x)),
      t: n.getTranslation(),
      r: n.getRotation(),
      s: n.getScale(),
    })),
    skins: r.listSkins().map((s) => ({
      name: s.getName(),
      extras: s.getExtras(),
      joints: s.listJoints().map((n) => nodes.indexOf(n)),
      skeleton: nodes.indexOf(s.getSkeleton()!),
      inverse: arr(s.getInverseBindMatrices()),
    })),
    animations: r.listAnimations().map((a) => ({
      name: a.getName(),
      extras: a.getExtras(),
      samplers: a.listSamplers().map((s) => ({
        interpolation: s.getInterpolation(),
        extras: s.getExtras(),
        input: arr(s.getInput()),
        output: arr(s.getOutput()),
      })),
      channels: a.listChannels().map((c) => ({
        node: nodes.indexOf(c.getTargetNode()!),
        path: c.getTargetPath(),
        sampler: a.listSamplers().indexOf(c.getSampler()!),
        extras: c.getExtras(),
      })),
    })),
    scenes: r.listScenes().map((s) => ({
      name: s.getName(),
      extras: s.getExtras(),
      children: s.listChildren().map((n) => nodes.indexOf(n)),
    })),
    default: r.listScenes().indexOf(r.getDefaultScene()!),
  });
}
// NodeIO drops transform components within its default-value epsilon. Float arrays stay exact.
export function preserved(a: unknown, b: unknown, path = ""): boolean {
  if (a === b) return true;
  if (
    typeof a === "number" &&
    typeof b === "number" &&
    /^\.nodes\.\d+\.(t|r|s)\./.test(path)
  )
    return Math.abs(a - b) <= 1e-5;
  if (
    typeof a !== "object" ||
    typeof b !== "object" ||
    a === null ||
    b === null
  )
    return false;
  const x = a as Record<string, unknown>,
    y = b as Record<string, unknown>;
  return (
    Object.keys(x).length === Object.keys(y).length &&
    Object.keys(x).every(
      (k) => Object.hasOwn(y, k) && preserved(x[k], y[k], path + "." + k),
    )
  );
}
function editable(d: Document) {
  const r = d.getRoot();
  return JSON.stringify({
    root: r.getExtras(),
    nodes: r.listNodes().map((n) => [n.getName(), n.getExtras()]),
    materials: r.listMaterials().map((m) => {
      const pairs: [
        import("@gltf-transform/core").Texture | null,
        import("@gltf-transform/core").TextureInfo | null,
      ][] = [
        [m.getBaseColorTexture(), m.getBaseColorTextureInfo()],
        [m.getMetallicRoughnessTexture(), m.getMetallicRoughnessTextureInfo()],
        [m.getNormalTexture(), m.getNormalTextureInfo()],
        [m.getOcclusionTexture(), m.getOcclusionTextureInfo()],
        [m.getEmissiveTexture(), m.getEmissiveTextureInfo()],
      ];
      return {
        name: m.getName(),
        extras: m.getExtras(),
        base: m.getBaseColorFactor(),
        metal: m.getMetallicFactor(),
        rough: m.getRoughnessFactor(),
        emissive: m.getEmissiveFactor(),
        alpha: m.getAlphaMode(),
        cutoff: m.getAlphaCutoff(),
        double: m.getDoubleSided(),
        normal: m.getNormalScale(),
        occlusion: m.getOcclusionStrength(),
        maps: pairs.map(([t, i]) => [
          r.listTextures().indexOf(t!),
          i
            ? {
                texCoord: i.getTexCoord(),
                wrapS: i.getWrapS(),
                wrapT: i.getWrapT(),
                min: i.getMinFilter(),
                mag: i.getMagFilter(),
              }
            : null,
        ]),
      };
    }),
  });
}
export async function readDocument(bytes: Uint8Array) {
  const info = inspectGlb(bytes),
    d = await io.readBinary(bytes);
  for (const n of d.getRoot().listNodes()) {
    const world = n.getWorldMatrix();
    if (
      world.some((x) => !Number.isFinite(x) || Math.abs(x) > 1e6) ||
      n.getScale().some((x) => Math.abs(x) < 1e-8)
    )
      throw Error("节点变换退化或世界坐标超出预算。");
  }
  // glTF Transform represents TRS nodes. Reject shear rather than silently decomposing it.
  const raw = info.json.nodes as Record<string, unknown>[];
  d.getRoot()
    .listNodes()
    .forEach((n, i) => {
      if (Array.isArray(raw[i]?.matrix)) {
        const m = n.getMatrix();
        if (raw[i].matrix.some((x, k) => Math.abs(Number(x) - m[k]) > 1e-5))
          throw Error("含剪切矩阵的节点暂不能无损处理。");
      }
    });
  return d;
}
export async function inspect(bytes: Uint8Array): Promise<Inspection> {
  const info = inspectGlb(bytes),
    d = await readDocument(bytes),
    r = d.getRoot();
  return {
    engine: "@gltf-transform/core 4.5.1 · NodeIO",
    bytes: bytes.length,
    vertices: info.vertices,
    instancedVertices: info.instancedVertices,
    meshes: info.meshes,
    skins: info.skins,
    pixels: info.pixels,
    scenes: r.listScenes().map((s, i) => s.getName() || `场景 ${i + 1}`),
    geometryBytes: r
      .listAccessors()
      .reduce((s, a) => s + (a.getArray()?.byteLength ?? 0), 0),
    rootExtras: JSON.stringify(r.getExtras(), null, 2),
    nodes: r.listNodes().map((n, index) => ({
      index,
      name: n.getName(),
      mesh: n.getMesh()?.getName() ?? "",
      children: n.listChildren().length,
      translation: n.getTranslation(),
      extras: JSON.stringify(n.getExtras(), null, 2),
    })),
    materials: r.listMaterials().map((m, index) => ({
      index,
      name: m.getName(),
      color:
        "#" +
        ColorUtils.factorToHex(m.getBaseColorFactor())
          .toString(16)
          .padStart(6, "0"),
      factor: m.getBaseColorFactor(),
      opacity: String(m.getBaseColorFactor()[3]),
      metallic: String(m.getMetallicFactor()),
      roughness: String(m.getRoughnessFactor()),
      alphaMode: m.getAlphaMode(),
      doubleSided: m.getDoubleSided(),
      extras: JSON.stringify(m.getExtras(), null, 2),
      texture:
        m.getBaseColorTexture()?.getName() ??
        (m.getBaseColorTexture() ? "内嵌贴图" : "无底色贴图"),
    })),
    images: r.listTextures().map((t, i) => ({
      name: t.getName() || `图像 ${i + 1}`,
      bytes: t.getImage()?.byteLength ?? 0,
      mime: t.getMimeType(),
      hash: hash(t.getImage() ?? new Uint8Array()),
    })),
    animations: r.listAnimations().map((a, i) => ({
      name: a.getName() || `动画 ${i + 1}`,
      duration: Math.max(
        0,
        ...a.listSamplers().map((s) => {
          const x = s.getInput();
          return x ? x.getScalar(x.getCount() - 1) : 0;
        }),
      ),
    })),
  };
}
export async function processAsset(bytes: Uint8Array, raw: Edits) {
  const edits = editsValue(raw, true),
    d = await readDocument(bytes),
    r = d.getRoot(),
    before = invariant(d);
  for (const [k, e] of Object.entries(edits.nodes)) {
    const n = r.listNodes()[Number(k)];
    if (!n) throw Error("修订节点已不存在。");
    if (e.name !== undefined) n.setName(e.name);
    if (e.extras !== undefined) n.setExtras(jsonObject(e.extras));
  }
  for (const [k, e] of Object.entries(edits.materials)) {
    const m = r.listMaterials()[Number(k)];
    if (!m) throw Error("修订材质已不存在。");
    if (e.name !== undefined) m.setName(e.name);
    const factor = m.getBaseColorFactor();
    if (e.color !== undefined) {
      const rgb = ColorUtils.hexToFactor(
        Number.parseInt(e.color.slice(1), 16),
        [0, 0, 0] as [number, number, number],
      );
      factor.splice(0, 3, ...rgb);
    }
    if (e.opacity !== undefined) factor[3] = Number(e.opacity);
    if (e.color !== undefined || e.opacity !== undefined)
      m.setBaseColorFactor(factor);
    if (e.metallic !== undefined) m.setMetallicFactor(Number(e.metallic));
    if (e.roughness !== undefined) m.setRoughnessFactor(Number(e.roughness));
    if (e.alphaMode !== undefined) m.setAlphaMode(e.alphaMode);
    if (e.doubleSided !== undefined) m.setDoubleSided(e.doubleSided);
    if (e.extras !== undefined) m.setExtras(jsonObject(e.extras));
  }
  if (edits.rootExtras !== null) r.setExtras(jsonObject(edits.rootExtras));
  const expected = editable(d),
    output = await io.writeBinary(d),
    again = await readDocument(output);
  if (
    !preserved(JSON.parse(before), JSON.parse(invariant(again))) ||
    editable(again) !== expected
  )
    throw Error("原生回读保全检查失败，未生成结果。");
  return { bytes: output, inspection: await inspect(output) };
}
let sample: Uint8Array | undefined;
export async function sampleAsset() {
  if (sample) return sample.slice();
  const d = new Document(),
    b = d.createBuffer(),
    scene = d.createScene("Material study / 01");
  d.getRoot().setDefaultScene(scene);
  d.getRoot().setExtras({
    collection: "Material study",
    author: "Floatboat",
    license: "MIT",
  });
  const tex = d
    .createTexture("Sandstone grain")
    .setMimeType("image/png")
    .setImage(
      Buffer.from(
        "iVBORw0KGgoAAAANSUhEUgAAACAAAAAgCAYAAABzenr0AAAFD0lEQVR4nE3XZbImNwyFYe9/LclMYBguM/MdCGchTj2uelPfD1d329LREVh2j7O9d/Pg0y/z9nR7Xh19ml9vj+fOuxfzePv1fL4+nNZ/ezibT1cH868vV3PrzQ/z8vDjPN19Ox8u9pb8/fnu/HJztOaMx8v9NXbfv5zn++8XPhyY3+9P583J1nr/8/lyDkZPdt7MP54ulpH9jz+vd4YOP/+6FIBdHHxYxqwzZgA92nq1ZP/5drPk7s52FtG/v14vp2B4hxkhjrFJb2y//XEx/HZ3skABMkKZAfNIAKCIBJm9Dz+tJ0BzoiQynozCsPbv99vJBjzkOMJ77+aGCQQoWqDIG0oMYvn74/lKi1CboyNa1nwjQ59XvBdixHlsHp50NeCRZW/wWugIyolvioDylIJvAwkR8c6LcmvA8aQjtb6rKWRFA5aUGGQGo8JLkICBBAEh5I1oEGaYUcTo8KICNMiSESERQAA+OcWJGBmhhw13EDTBa+8mGY+xvAK6Pv78fxWTEzFy5pAhy1Py1oVaLWS4XYEw4wh7DvkxCQxbiowwIL9qotRkSASsIWWU63A4VKjpiVqep2+ezgBEsGIpt+V/syh5B4gsA97J8pg3yNNBmD6vI4UoOfZEploawiZMAHkifxQZxhZrbGs6hZdhRhlTHzAQjQAD4dFjmEGpFUnFy6FhUpEwwiC2lAjkFWBgvMK+RtJuMRhmlLHm6hme5Dlm3ntj2M/Y56VJ4aoHWEOkrSUiQEQM+QgHTFf06oj04LaLpJIc/dWIeF375Wk5Zbw9zuvacD0AQeToM1q90GWsDksWLkeLTjW0zgKTGAIB5rstCKQGZR054MIKiOfIiVBNBzEkEDJPBk5Fh9Tmlh/t7zxpn0sJJV4qVIYVDcAKFwA93plHVBSkpQ6KlG+6Bpz6CJxRz7elACADDBHgBI32sbQwzlDRM6TQvIgkRwYJkWhHcJIcmRUBYaWMMSKMBuqbdwCwB9oeFyEgyJGVgvoBI3VJuAxXY0jxXCGuPiDfPAHeYUOYoG9CeQzQOpKMIY9kEapWrDHAUG0cBjscSY8jgzGCJkoHQYYZBAS87kXeeydhzakGJcf0au2dqvUARei9PjMw4lFhosg4ASFjjBKSQt4JR5YOwtakJAPddjzpIM45cpt3jdWIeKdQABOwKFxdxazXYKoLRkSAbIXFkfZ5HZMegx3f5jzp1/4HIco88OzgEErGkejGU13kEUIdNgiRk4r2PrIiUArrE+zAQmLtAhM8bvvITdXddpImQBGNOEN0gSNeLwDeqdr9D0HDuyESgwdCTxAoYUXEGE+qgy6f3Rs7xm1T60apNIS6s6MeIXod2R1Wg3CXRgQ6wcwpJANJBoSX8foBgnlDhsHSR6a9rgkhyimD53XVdRgF1qWEMKVy7xswMgAYq0DJlRLvDHan5DlPfeeMyNWUVifsL6deLwI86rxmuL5Npms8sNIGTHQYqwa62nn2J9RPijRzynO0v4HWs7uoMg7cWtdoTzLYAzAYJItAnY4cx3hMvjRXhORFZpggWP4BFwXkukYBBtSvWf+JRQg58rzkbThSzLFuVdUMuUWgm3D/AxYLbyejp6JCBtDmzYYRQ14RqUPaEd2UWoehftra605YUXXXQwYQoY7SruddwVLu+O6HhGxXtG5HDMPvBxZW36sIecp7qTAJMPbegZDZ3AkVF7kOrG5C1c3m2a8mkEUOVjvMTvoP5PNfHflUQ2MAAAAASUVORK5CYII=",
        "base64",
      ),
    );
  const clay = d
      .createMaterial("Terracotta glaze")
      .setBaseColorFactor([0.49, 0.16, 0.08, 1])
      .setRoughnessFactor(0.34)
      .setMetallicFactor(0),
    chalk = d
      .createMaterial("Chalk ceramic")
      .setBaseColorFactor([0.88, 0.86, 0.8, 1])
      .setRoughnessFactor(0.72)
      .setMetallicFactor(0),
    stone = d
      .createMaterial("Speckled pedestal")
      .setBaseColorFactor([0.55, 0.5, 0.41, 1])
      .setRoughnessFactor(0.88)
      .setMetallicFactor(0)
      .setBaseColorTexture(tex);
  const create = (
    name: string,
    g: BufferGeometry,
    mat: typeof clay,
    xyz: [number, number, number],
  ) => {
    const p = d.createPrimitive();
    for (const [name, semantic] of [
      ["position", "POSITION"],
      ["normal", "NORMAL"],
      ["uv", "TEXCOORD_0"],
    ]) {
      const a = g.getAttribute(name);
      if (a)
        p.setAttribute(
          semantic,
          d
            .createAccessor()
            .setType(a.itemSize === 2 ? "VEC2" : "VEC3")
            .setArray(new Float32Array(a.array))
            .setBuffer(b),
        );
    }
    const index = g.getIndex();
    if (index)
      p.setIndices(
        d
          .createAccessor()
          .setType("SCALAR")
          .setArray(new Uint16Array(index.array))
          .setBuffer(b),
      );
    p.setMaterial(mat);
    const mesh = d.createMesh(name).addPrimitive(p),
      node = d.createNode(name).setMesh(mesh).setTranslation(xyz);
    scene.addChild(node);
    g.dispose();
  };
  create("Display plinth", new BoxGeometry(3, 0.18, 2), stone, [0, 0, 0]);
  create(
    "Glazed vessel",
    new CylinderGeometry(0.38, 0.48, 1.35, 32),
    clay,
    [-0.63, 0.76, 0],
  );
  create(
    "Porcelain sphere",
    new SphereGeometry(0.45, 24, 16),
    chalk,
    [0.55, 0.54, 0.15],
  );
  create(
    "Material swatch",
    new BoxGeometry(0.55, 0.1, 0.5),
    clay,
    [0.7, 0.15, -0.6],
  );
  sample = await io.writeBinary(d);
  await inspect(sample);
  return sample.slice();
}
