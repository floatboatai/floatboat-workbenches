import { isRecord } from "./project.ts";
import { MAX_FILE } from "./asset.ts";
export interface GlbInfo {
  vertices: number;
  instancedVertices: number;
  meshes: number;
  nodes: number;
  materials: number;
  images: number;
  skins: number;
  animations: number;
  pixels: number;
  json: Record<string, unknown>;
  binary: Uint8Array;
}
const keys = (o: Record<string, unknown>, allowed: string[], name: string) => {
  if (Object.keys(o).some((k) => !allowed.includes(k)))
    throw Error(name + "含有此版本未支持字段。");
  if(o.name!==undefined&&(typeof o.name!=="string"||o.name.length>10000))throw Error(name+"的名称需要10000字符以内的文本。");
  if (o.extras !== undefined && !isRecord(o.extras))
    throw Error(name + "的extras需要JSON对象。");
  if (
    o.extensions !== undefined &&
    (!isRecord(o.extensions) || Object.keys(o.extensions).length)
  )
    throw Error("请先导出无扩展的普通GLB。");
};
export function inspectGlb(bytes: Uint8Array): GlbInfo {
  if (bytes.length < 28 || bytes.length > MAX_FILE)
    throw Error("模型需为1.4MB以内的完整GLB。");
  const h = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  if (
    h.getUint32(0, true) !== 0x46546c67 ||
    h.getUint32(4, true) !== 2 ||
    h.getUint32(8, true) !== bytes.length ||
    h.getUint32(16, true) !== 0x4e4f534a
  )
    throw Error("仅支持GLB2.0。");
  const len = h.getUint32(12, true);
  if (len % 4 || len > 400000 || 20 + len + 8 > bytes.length)
    throw Error("GLB JSON块无效。");
  const j: unknown = JSON.parse(
    new TextDecoder("utf-8", { fatal: true }).decode(bytes.slice(20, 20 + len)),
  );
  if (!isRecord(j)) throw Error("模型结构无效。");
  keys(
    j,
    [
      "asset",
      "scene",
      "scenes",
      "nodes",
      "meshes",
      "materials",
      "textures",
      "images",
      "samplers",
      "buffers",
      "bufferViews",
      "accessors",
      "skins",
      "animations",
      "extensionsUsed",
      "extensionsRequired",
      "extensions",
      "extras",
    ],
    "模型",
  );
  for (const k of ["extensionsUsed", "extensionsRequired"])
    if (
      j[k] !== undefined &&
      (!Array.isArray(j[k]) || (j[k] as unknown[]).length)
    )
      throw Error("压缩和扩展模型暂不支持，请导出普通GLB。");
  if (!isRecord(j.asset) || j.asset.version !== "2.0")
    throw Error("模型版本无效。");
  keys(
    j.asset,
    ["version", "generator", "copyright", "minVersion"],
    "资产信息",
  );
  const pos = 20 + len;
  if (
    h.getUint32(pos + 4, true) !== 0x004e4942 ||
    pos + 8 + h.getUint32(pos, true) !== bytes.length
  )
    throw Error("GLB二进制块无效。");
  const binary = bytes.slice(pos + 8),
    raw = new DataView(binary.buffer, binary.byteOffset, binary.byteLength);
  const list = (name: string, max: number) => {
    const a = j[name] ?? [];
    if (!Array.isArray(a) || a.length > max || a.some((x) => !isRecord(x)))
      throw Error(name + "结构无效或超过预算。");
    return a as Record<string, unknown>[];
  };
  const buffers = list("buffers", 1),
    views = list("bufferViews", 4000),
    accessors = list("accessors", 4000),
    meshes = list("meshes", 64),
    nodes = list("nodes", 256),
    materials = list("materials", 128),
    images = list("images", 32),
    textures = list("textures", 64),
    samplers = list("samplers", 64),
    skins = list("skins", 16),
    animations = list("animations", 64),
    scenes = list("scenes", 16);
  if (
    buffers.length !== 1 ||
    buffers[0].uri !== undefined ||
    !Number.isInteger(buffers[0].byteLength) ||
    Number(buffers[0].byteLength) > binary.length ||
    Number(buffers[0].byteLength) < 1
  )
    throw Error("仅支持自包含二进制模型。");
  keys(buffers[0], ["byteLength"], "缓冲区");
  for (const v of views) {
    keys(
      v,
      ["buffer", "byteOffset", "byteLength", "byteStride", "target"],
      "缓冲视图",
    );
    if (
      v.buffer !== 0 ||
      !Number.isInteger(v.byteOffset ?? 0) ||
      !Number.isInteger(v.byteLength) ||
      Number(v.byteOffset ?? 0) < 0 ||
      Number(v.byteOffset ?? 0) % 4 !== 0 ||
      (v.byteStride !== undefined &&
        (!Number.isInteger(v.byteStride) ||
          Number(v.byteStride) < 4 ||
          Number(v.byteStride) > 252 ||
          Number(v.byteStride) % 4 !== 0)) ||
      (v.target !== undefined && ![34962, 34963].includes(Number(v.target))) ||
      Number(v.byteLength) < 1 ||
      Number(v.byteOffset ?? 0) + Number(v.byteLength) >
        Number(buffers[0].byteLength)
    )
      throw Error("模型缓冲区越界。");
  }
  const widths: Record<number, number> = {
      5120: 1,
      5121: 1,
      5122: 2,
      5123: 2,
      5125: 4,
      5126: 4,
    },
    lanes: Record<string, number> = {
      SCALAR: 1,
      VEC2: 2,
      VEC3: 3,
      VEC4: 4,
      MAT4: 16,
    };
  let components = 0;
  const value = (index: number, row: number, lane: number) => {
    const a = accessors[index],
      v = views[Number(a.bufferView)],
      type = Number(a.componentType),
      width = widths[type],
      n = lanes[String(a.type)],
      offset =
        Number(v.byteOffset ?? 0) +
        Number(a.byteOffset ?? 0) +
        row * Number(v.byteStride ?? width * n) +
        lane * width;
    let x =
      type === 5126
        ? raw.getFloat32(offset, true)
        : type === 5125
          ? raw.getUint32(offset, true)
          : type === 5123
            ? raw.getUint16(offset, true)
            : type === 5122
              ? raw.getInt16(offset, true)
              : type === 5121
                ? raw.getUint8(offset)
                : raw.getInt8(offset);
    if (a.normalized) {
      if (type === 5120) x = Math.max(x / 127, -1);
      if (type === 5121) x /= 255;
      if (type === 5122) x = Math.max(x / 32767, -1);
      if (type === 5123) x /= 65535;
    }
    return x;
  };
  for (const a of accessors) {
    keys(
      a,
      [
        "bufferView",
        "byteOffset",
        "componentType",
        "normalized",
        "count",
        "type",
        "max",
        "min",
        "name",
        "extras",
        "extensions",
      ],
      "访问器",
    );
    const v = views[Number(a.bufferView)],
      width = widths[Number(a.componentType)],
      n = lanes[String(a.type)],
      count = Number(a.count);
    if (
      !Number.isInteger(a.bufferView) ||
      !v ||
      !width ||
      !n ||
      !Number.isInteger(a.count) ||
      count < 1 ||
      count > 200000 ||
      (Number(a.componentType) === 5126 && a.normalized === true)
    )
      throw Error("访问器类型或数量不支持。");
    const local = Number(a.byteOffset ?? 0),
      stride = Number(v.byteStride ?? width * n);
    if (
      !Number.isSafeInteger(local) ||
      local < 0 ||
      local % width ||
      !Number.isSafeInteger(stride) ||
      stride < width * n ||
      stride > 252 ||
      stride % width ||
      local + (count - 1) * stride + width * n > Number(v.byteLength)
    )
      throw Error("访问器超出缓冲区。");
    components += count * n;
    if (components > 1_000_000) throw Error("模型访问器总量超过预算。");
    if (a.normalized !== undefined && typeof a.normalized !== "boolean")
      throw Error("normalized标志无效。");
    for (const field of ["min", "max"])
      if (
        a[field] !== undefined &&
        (!Array.isArray(a[field]) ||
          (a[field] as unknown[]).length !== n ||
          (a[field] as unknown[]).some(
            (x) => typeof x !== "number" || !Number.isFinite(x),
          ))
      )
        throw Error("访问器范围无效。");
  }
  for (let ai = 0; ai < accessors.length; ai++) {
    const a = accessors[ai];
    if (a.componentType === 5126)
      for (let i = 0; i < Number(a.count); i++)
        for (let k = 0; k < lanes[String(a.type)]; k++) {
          const v = value(ai, i, k);
          if (!Number.isFinite(v) || Math.abs(v) > 1e8)
            throw Error("模型包含非有限或超大数据。");
        }
  }
  let vertices = 0;
  const counts: number[] = [];
  for (const m of meshes) {
    keys(m, ["name", "primitives", "extras", "extensions"], "网格");
    if (
      !Array.isArray(m.primitives) ||
      m.primitives.length < 1 ||
      m.primitives.length > 32
    )
      throw Error("网格图元无效。");
    let total = 0;
    for (const q of m.primitives) {
      if (!isRecord(q)) throw Error("图元无效。");
      keys(
        q,
        ["attributes", "indices", "material", "mode", "extras", "extensions"],
        "图元",
      );
      if (!isRecord(q.attributes) || (q.mode !== undefined && q.mode !== 4))
        throw Error("仅支持无Morph的三角网格。");
      if (
        Object.keys(q.attributes).some(
          (k) =>
            ![
              "POSITION",
              "NORMAL",
              "TANGENT",
              "TEXCOORD_0",
              "TEXCOORD_1",
              "COLOR_0",
              "JOINTS_0",
              "WEIGHTS_0",
            ].includes(k),
        )
      )
        throw Error("存在未支持的顶点属性。");
      const ix = Number(q.attributes.POSITION),
        a = accessors[ix];
      if (
        !Number.isInteger(q.attributes.POSITION) ||
        !a ||
        a.type !== "VEC3" ||
        a.componentType !== 5126
      )
        throw Error("位置需要浮点三维数据。");
      const count = Number(a.count);
      let minimum = [Infinity, Infinity, Infinity],
        maximum = [-Infinity, -Infinity, -Infinity];
      for (let i = 0; i < count; i++)
        for (let k = 0; k < 3; k++) {
          const v = value(ix, i, k);
          minimum[k] = Math.min(minimum[k], v);
          maximum[k] = Math.max(maximum[k], v);
        }
      if (maximum.every((v, k) => v - minimum[k] < 1e-9))
        throw Error("网格顶点全部重合，无法检查。");
      for (const attr of Object.values(q.attributes))
        if (
          !Number.isInteger(attr) ||
          !accessors[Number(attr)] ||
          accessors[Number(attr)].count !== count
        )
          throw Error("顶点属性长度不一致。");
      for (const [semantic, index] of Object.entries(q.attributes)) {
        const attr = accessors[Number(index)],
          float = attr.componentType === 5126,
          normalized =
            [5121, 5123].includes(Number(attr.componentType)) &&
            attr.normalized === true;
        if (
          (semantic === "NORMAL" && (attr.type !== "VEC3" || !float)) ||
          (semantic === "TANGENT" && (attr.type !== "VEC4" || !float)) ||
          (semantic.startsWith("TEXCOORD_") &&
            (attr.type !== "VEC2" || (!float && !normalized))) ||
          (semantic === "COLOR_0" &&
            (!["VEC3", "VEC4"].includes(String(attr.type)) ||
              (!float && !normalized))) ||
          (semantic === "JOINTS_0" &&
            (attr.type !== "VEC4" ||
              ![5121, 5123].includes(Number(attr.componentType)) ||
              attr.normalized === true)) ||
          (semantic === "WEIGHTS_0" &&
            (attr.type !== "VEC4" || (!float && !normalized)))
        )
          throw Error("顶点属性类型不符合glTF规范。");
      }
      if (q.indices !== undefined) {
        const a = accessors[Number(q.indices)];
        if (
          !Number.isInteger(q.indices) ||
          !a ||
          a.type !== "SCALAR" ||
          ![5121, 5123, 5125].includes(Number(a.componentType)) ||
          Number(a.count) % 3 ||
          a.normalized === true
        )
          throw Error("三角索引无效。");
        for (let k = 0; k < Number(a.count); k++)
          if (value(Number(q.indices), k, 0) >= count)
            throw Error("三角索引越界。");
      } else if (count % 3) throw Error("非索引三角图元不完整。");
      const triangles =
          q.indices === undefined
            ? count
            : Number(accessors[Number(q.indices)].count),
        point = (i: number) =>
          q.indices === undefined ? i : value(Number(q.indices), i, 0);
      let surface = false;
      for (let t = 0; t < triangles && !surface; t += 3) {
        const ids = [point(t), point(t + 1), point(t + 2)],
          u = [0, 1, 2].map((k) => value(ix, ids[1], k) - value(ix, ids[0], k)),
          v = [0, 1, 2].map((k) => value(ix, ids[2], k) - value(ix, ids[0], k));
        surface =
          Math.hypot(
            u[1] * v[2] - u[2] * v[1],
            u[2] * v[0] - u[0] * v[2],
            u[0] * v[1] - u[1] * v[0],
          ) > 1e-16;
      }
      if (!surface) throw Error("三角网格全部退化，无法检查表面。");
      if (
        q.material !== undefined &&
        (!Number.isInteger(q.material) || !materials[Number(q.material)])
      )
        throw Error("材质引用无效。");
      total += count;
    }
    vertices += total;
    counts.push(total);
  }
  let instancedVertices = 0;
  const parent = new Map<number, number>();
  const finiteVector = (v: unknown, n: number) =>
    Array.isArray(v) &&
    v.length === n &&
    v.every(
      (x) => typeof x === "number" && Number.isFinite(x) && Math.abs(x) <= 1e6,
    );
  nodes.forEach((n, ni) => {
    keys(
      n,
      [
        "name",
        "children",
        "mesh",
        "skin",
        "matrix",
        "translation",
        "rotation",
        "scale",
        "extras",
        "extensions",
      ],
      "节点",
    );
    if (n.mesh !== undefined) {
      if (!Number.isInteger(n.mesh) || counts[Number(n.mesh)] === undefined)
        throw Error("节点网格引用无效。");
      instancedVertices += counts[Number(n.mesh)];
    }
    if (
      n.skin !== undefined &&
      (!Number.isInteger(n.skin) ||
        !skins[Number(n.skin)] ||
        n.mesh === undefined)
    )
      throw Error("骨架引用无效。");
    if (
      n.matrix !== undefined &&
      ["translation", "rotation", "scale"].some((k) => n[k] !== undefined)
    )
      throw Error("矩阵与TRS不能同时存在。");
    for (const [k, size] of Object.entries({
      matrix: 16,
      translation: 3,
      rotation: 4,
      scale: 3,
    }))
      if (n[k] !== undefined && !finiteVector(n[k], size))
        throw Error("节点变换无效。");
    if (
      n.rotation !== undefined &&
      Math.abs(Math.hypot(...(n.rotation as number[])) - 1) > 0.01
    )
      throw Error("旋转四元数未归一化。");
    if (n.children !== undefined) {
      if (
        !Array.isArray(n.children) ||
        new Set(n.children).size !== n.children.length
      )
        throw Error("节点子项无效。");
      for (const ch of n.children) {
        if (
          !Number.isInteger(ch) ||
          !nodes[Number(ch)] ||
          parent.has(Number(ch))
        )
          throw Error("节点重复父级或索引无效。");
        parent.set(Number(ch), ni);
      }
    }
  });
  if (vertices < 1 || vertices > 50000 || instancedVertices > 50000)
    throw Error("模型最多50000个有效/实例顶点。");
  nodes.forEach((_, start) => {
    let i = start;
    const seen = new Set<number>();
    while (parent.has(i)) {
      if (seen.has(i) || seen.size > 64) throw Error("节点循环或层级过深。");
      seen.add(i);
      i = parent.get(i)!;
    }
  });
  for (const s of scenes) {
    keys(s, ["name", "nodes", "extras", "extensions"], "场景");
    if (
      !Array.isArray(s.nodes) ||
      new Set(s.nodes).size!==s.nodes.length ||
      s.nodes.some(
        (n) =>
          !Number.isInteger(n) || !nodes[Number(n)] || parent.has(Number(n)),
      )
    )
      throw Error("场景根节点无效。");
  }
  if (
    !scenes.length ||
    !Number.isInteger(j.scene ?? 0) ||
    !scenes[Number(j.scene ?? 0)]
  )
    throw Error("模型缺少默认场景。");
  for (const s of skins) {
    keys(
      s,
      [
        "name",
        "joints",
        "inverseBindMatrices",
        "skeleton",
        "extras",
        "extensions",
      ],
      "骨架",
    );
    if (
      !Array.isArray(s.joints) ||
      !s.joints.length ||
      s.joints.length > 256 ||
      new Set(s.joints).size !== s.joints.length ||
      s.joints.some((n) => !Number.isInteger(n) || !nodes[Number(n)])
    )
      throw Error("骨架关节无效。");
    if (s.inverseBindMatrices !== undefined) {
      const a = accessors[Number(s.inverseBindMatrices)];
      if (
        !Number.isInteger(s.inverseBindMatrices) ||
        !a ||
        a.type !== "MAT4" ||
        a.componentType !== 5126 ||
        a.count !== s.joints.length
      )
        throw Error("骨架逆矩阵无效。");
    }
    if (
      s.skeleton !== undefined &&
      (!Number.isInteger(s.skeleton) || !nodes[Number(s.skeleton)])
    )
      throw Error("骨架根节点无效。");
  }
  for (const n of nodes) {
    if (n.skin === undefined) continue;
    const s = skins[Number(n.skin)],
      m = meshes[Number(n.mesh)];
    for (const p of m.primitives as Record<string, unknown>[]) {
      const a = p.attributes as Record<string, unknown>,
        ji = Number(a.JOINTS_0),
        wi = Number(a.WEIGHTS_0),
        ja = accessors[ji],
        wa = accessors[wi];
      if (
        !ja ||
        !wa ||
        ja.type !== "VEC4" ||
        wa.type !== "VEC4" ||
        ![5121, 5123].includes(Number(ja.componentType)) ||
        ja.normalized
      )
        throw Error("蒙皮权重/关节格式无效。");
      for (let r = 0; r < Number(ja.count); r++) {
        let sum = 0;
        for (let k = 0; k < 4; k++) {
          const joint = value(ji, r, k),
            weight = value(wi, r, k);
          if (
            joint >= Number((s.joints as unknown[]).length) ||
            weight < 0 ||
            weight > 1
          )
            throw Error("蒙皮索引或权重无效。");
          sum += weight;
        }
        if (Math.abs(sum - 1) > 0.01) throw Error("蒙皮权重未归一化。");
      }
    }
  }
  for (const a of animations) {
    keys(a, ["name", "samplers", "channels", "extras", "extensions"], "动画");
    if (
      !Array.isArray(a.samplers) ||
      !Array.isArray(a.channels) ||
      a.samplers.length > 1024 ||
      a.channels.length > 1024
    )
      throw Error("动画数量超限。");
    for (const s of a.samplers) {
      if (!isRecord(s)) throw Error("动画采样无效。");
      keys(
        s,
        ["input", "output", "interpolation", "extras", "extensions"],
        "动画采样",
      );
      const input = accessors[Number(s.input)],
        output = accessors[Number(s.output)];
      if (
        !Number.isInteger(s.input) ||
        !Number.isInteger(s.output) ||
        !input ||
        !output ||
        input.type !== "SCALAR" ||
        input.componentType !== 5126 ||
        output.componentType !== 5126 ||
        !["LINEAR", "STEP", "CUBICSPLINE"].includes(
          String(s.interpolation ?? "LINEAR"),
        )
      )
        throw Error("动画采样格式无效。");
      let previous = -1;
      for (let i = 0; i < Number(input.count); i++) {
        const t = value(Number(s.input), i, 0);
        if (t < 0 || t > 3600 || t <= previous) throw Error("动画时间无效。");
        previous = t;
      }
    }
    for (const c of a.channels) {
      if (!isRecord(c) || !isRecord(c.target)) throw Error("动画通道无效。");
      keys(c, ["sampler", "target", "extras", "extensions"], "动画通道");
      keys(c.target, ["node", "path", "extras", "extensions"], "动画目标");
      if (
        !Number.isInteger(c.sampler) ||
        !a.samplers[Number(c.sampler)] ||
        !Number.isInteger(c.target.node) ||
        !nodes[Number(c.target.node)] ||
        !["translation", "rotation", "scale"].includes(String(c.target.path))
      )
        throw Error("动画目标不支持。");
      const s = a.samplers[Number(c.sampler)] as Record<string, unknown>,
        input = accessors[Number(s.input)],
        output = accessors[Number(s.output)],
        mult = s.interpolation === "CUBICSPLINE" ? 3 : 1;
      if (
        output.count !== Number(input.count) * mult ||
        output.type !== (c.target.path === "rotation" ? "VEC4" : "VEC3")
      )
        throw Error("动画输出长度无效。");
    }
  }
  for (const m of materials) {
    keys(
      m,
      [
        "name",
        "pbrMetallicRoughness",
        "normalTexture",
        "occlusionTexture",
        "emissiveTexture",
        "emissiveFactor",
        "alphaMode",
        "alphaCutoff",
        "doubleSided",
        "extras",
        "extensions",
      ],
      "材质",
    );
    if (m.pbrMetallicRoughness !== undefined) {
      if (!isRecord(m.pbrMetallicRoughness)) throw Error("PBR参数无效。");
      keys(
        m.pbrMetallicRoughness,
        [
          "baseColorFactor",
          "baseColorTexture",
          "metallicFactor",
          "roughnessFactor",
          "metallicRoughnessTexture",
        ],
        "PBR参数",
      );
    }
    for (const info of [
      isRecord(m.pbrMetallicRoughness)
        ? m.pbrMetallicRoughness.baseColorTexture
        : undefined,
      isRecord(m.pbrMetallicRoughness)
        ? m.pbrMetallicRoughness.metallicRoughnessTexture
        : undefined,
      m.normalTexture,
      m.occlusionTexture,
      m.emissiveTexture,
    ])
      if (info !== undefined) {
        if (
          !isRecord(info) ||
          !Number.isInteger(info.index) ||
          !textures[Number(info.index)]
        )
          throw Error("材质贴图引用无效。");
        keys(info, ["index", "texCoord", "scale", "strength"], "材质贴图");
        if (
          info.texCoord !== undefined &&
          ![0, 1].includes(Number(info.texCoord))
        )
          throw Error("只支持UV0/UV1贴图。");
        if (
          info.scale !== undefined &&
          (typeof info.scale !== "number" ||
            !Number.isFinite(info.scale) ||
            Math.abs(info.scale) > 100)
        )
          throw Error("法线强度无效。");
        if (
          info.strength !== undefined &&
          (typeof info.strength !== "number" ||
            info.strength < 0 ||
            info.strength > 1)
        )
          throw Error("遮蔽强度无效。");
      }
  }

  for (const m of materials) {
    const p = isRecord(m.pbrMetallicRoughness) ? m.pbrMetallicRoughness : {};
    for (const [v, n] of [
      [p.baseColorFactor, 4],
      [m.emissiveFactor, 3],
    ] as [unknown, number][])
      if (
        v !== undefined &&
        (!Array.isArray(v) ||
          v.length !== n ||
          v.some(
            (x) =>
              typeof x !== "number" || !Number.isFinite(x) || x < 0 || x > 1,
          ))
      )
        throw Error("材质颜色因子无效。");
    for (const v of [p.metallicFactor, p.roughnessFactor, m.alphaCutoff])
      if (
        v !== undefined &&
        (typeof v !== "number" || !Number.isFinite(v) || v < 0 || v > 1)
      )
        throw Error("PBR数值超出0–1。");
    if (
      m.alphaMode !== undefined &&
      !["OPAQUE", "MASK", "BLEND"].includes(String(m.alphaMode))
    )
      throw Error("材质透明模式无效。");
    if (m.doubleSided !== undefined && typeof m.doubleSided !== "boolean")
      throw Error("双面标志无效。");
  }
  for (const t of textures) {
    keys(t, ["sampler", "source"], "贴图");
    if (
      !Number.isInteger(t.source) ||
      !images[Number(t.source)] ||
      (t.sampler !== undefined &&
        (!Number.isInteger(t.sampler) || !samplers[Number(t.sampler)]))
    )
      throw Error("贴图引用无效。");
  }
  for (const s of samplers) {
    keys(s, ["magFilter", "minFilter", "wrapS", "wrapT"], "采样器");
    for (const k of ["wrapS", "wrapT"])
      if (s[k] !== undefined && ![33071, 33648, 10497].includes(Number(s[k])))
        throw Error("贴图平铺模式无效。");
    if (
      (s.magFilter !== undefined &&
        ![9728, 9729].includes(Number(s.magFilter))) ||
      (s.minFilter !== undefined &&
        ![9728, 9729, 9984, 9985, 9986, 9987].includes(Number(s.minFilter)))
    )
      throw Error("贴图过滤模式无效。");
  }
  let pixels = 0;
  const imagePixels: number[] = [];
  for (const im of images) {
    keys(
      im,
      ["name", "bufferView", "mimeType", "extras", "extensions"],
      "图像",
    );
    if (
      !Number.isInteger(im.bufferView) ||
      !views[Number(im.bufferView)] ||
      !["image/png", "image/jpeg"].includes(String(im.mimeType))
    )
      throw Error("只支持内嵌PNG/JPEG。");
    const v = views[Number(im.bufferView)],
      b = binary.slice(
        Number(v.byteOffset ?? 0),
        Number(v.byteOffset ?? 0) + Number(v.byteLength),
      );
    const dim = imageDimensions(b, String(im.mimeType));
    pixels += dim.width * dim.height;
    imagePixels.push(dim.width * dim.height);
    if (pixels > 8388608) throw Error("贴图总像素超过8MP。");
  }
  const allocatedPixels = textures.reduce(
    (sum, t) => sum + imagePixels[Number(t.source)],
    0,
  );
  if (allocatedPixels > 8388608) throw Error("重复贴图的总像素超过8MP。");
  return {
    vertices,
    instancedVertices,
    meshes: meshes.length,
    nodes: nodes.length,
    materials: materials.length,
    images: images.length,
    skins: skins.length,
    animations: animations.length,
    pixels,
    json: j,
    binary,
  };
}
export function imageDimensions(b: Uint8Array, mime: string) {
  let w = 0,
    h = 0;
  if (
    mime === "image/png" &&
    b.length >= 33 &&
    [137, 80, 78, 71, 13, 10, 26, 10].every((n, i) => b[i] === n)
  ) {
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
