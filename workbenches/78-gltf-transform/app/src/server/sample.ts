import { Document, type Material, type Mesh } from "@gltf-transform/core";
import {
  BoxGeometry,
  CapsuleGeometry,
  CylinderGeometry,
  SphereGeometry,
  TorusGeometry,
  type BufferGeometry,
} from "three";
import { eulerToQuat } from "../contracts/transform.ts";
import { encodeJpeg, encodePng } from "./images.ts";
import { writeDocument } from "./model.ts";

/** Deterministic PRNG so the generated demo has a stable content hash. */
function random(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function valueNoise(size: number, cells: number, rand: () => number) {
  const grid = Array.from({ length: (cells + 1) * (cells + 1) }, rand);
  const at = (x: number, y: number) =>
    grid[(y % cells) * (cells + 1) + (x % cells)];
  const out = new Float32Array(size * size);
  for (let y = 0; y < size; y++)
    for (let x = 0; x < size; x++) {
      const gx = (x / size) * cells,
        gy = (y / size) * cells,
        x0 = Math.floor(gx),
        y0 = Math.floor(gy),
        fx = gx - x0,
        fy = gy - y0,
        sx = fx * fx * (3 - 2 * fx),
        sy = fy * fy * (3 - 2 * fy),
        a = at(x0, y0) + (at(x0 + 1, y0) - at(x0, y0)) * sx,
        b = at(x0, y0 + 1) + (at(x0 + 1, y0 + 1) - at(x0, y0 + 1)) * sx;
      out[y * size + x] = a + (b - a) * sy;
    }
  return out;
}
/** Cast-concrete albedo: layered noise, aggregate speckles and form-work seams. */
function concreteTexture(size = 1024) {
  const rand = random(7),
    coarse = valueNoise(size, 8, rand),
    fine = valueNoise(size, 64, rand),
    data = new Uint8Array(size * size * 4);
  for (let i = 0; i < size * size; i++) {
    const x = i % size,
      seam = x % 256 < 3 ? -18 : 0,
      speck = rand() > 0.985 ? -40 * rand() : 0,
      v = 150 + coarse[i] * 34 + fine[i] * 22 + seam + speck;
    data[i * 4] = Math.max(0, Math.min(255, v + 4));
    data[i * 4 + 1] = Math.max(0, Math.min(255, v + 2));
    data[i * 4 + 2] = Math.max(0, Math.min(255, v - 3));
    data[i * 4 + 3] = 255;
  }
  return encodeJpeg(size, size, data);
}
/** Blade composite: off-white laminate streaks with a red tip band. */
function bladeTexture(size = 512) {
  const rand = random(11),
    streak = valueNoise(size, 32, rand),
    data = new Uint8Array(size * size * 4);
  for (let y = 0; y < size; y++)
    for (let x = 0; x < size; x++) {
      const i = y * size + x,
        tip = y < size * 0.12,
        v = 232 + streak[(x % size) * size + ((y * 3) % size)] * 16;
      data[i * 4] = tip ? 196 : v;
      data[i * 4 + 1] = tip ? 44 + streak[i] * 10 : v;
      data[i * 4 + 2] = tip ? 38 : v - 4;
      data[i * 4 + 3] = 255;
    }
  return encodePng(size, size, data);
}

let sample: Uint8Array | undefined;
/**
 * Generated in-repo demo (MIT): a coastal wind turbine with six materials, two
 * textures, two baked animations, and the redundancy a real export pipeline leaves
 * behind — duplicate blade meshes, an unused spare part, a duplicated paint material,
 * unwelded fence posts and dense keyframes — so every optimisation pass has work to do.
 */
export async function sampleAsset() {
  if (sample) return sample.slice();
  const d = new Document(),
    buffer = d.createBuffer(),
    root = d.getRoot();
  d.getRoot().getAsset().generator = "Floatboat glTF workbench demo";
  root.setExtras({
    project: "Coastal wind farm · T-07",
    deliverable: "Real-time review model",
    license: "MIT (generated)",
  });
  const scene = d.createScene("Wind turbine T-07");
  root.setDefaultScene(scene);
  const concrete = d
      .createTexture("Cast concrete")
      .setMimeType("image/jpeg")
      .setImage(concreteTexture())
      .setURI("cast-concrete.jpg"),
    laminate = d
      .createTexture("Blade laminate")
      .setMimeType("image/png")
      .setImage(bladeTexture())
      .setURI("blade-laminate.png");
  const mat = (name: string, rgb: [number, number, number], rough: number, metal = 0) =>
    d
      .createMaterial(name)
      .setBaseColorFactor([...rgb, 1])
      .setRoughnessFactor(rough)
      .setMetallicFactor(metal);
  const paint = mat("Tower white", [0.86, 0.87, 0.85], 0.42),
    paintCopy = mat("Tower white", [0.86, 0.87, 0.85], 0.42),
    signal = mat("Signal red", [0.62, 0.07, 0.05], 0.38),
    steel = mat("Galvanized steel", [0.62, 0.64, 0.66], 0.36, 0.85),
    hubMetal = mat("Hub cast iron", [0.33, 0.35, 0.37], 0.5, 0.7),
    blade = mat("Blade composite", [1, 1, 1], 0.55).setBaseColorTexture(laminate),
    base = mat("Foundation concrete", [1, 1, 1], 0.92).setBaseColorTexture(concrete);
  mat("Unused primer", [0.5, 0.45, 0.4], 0.8);

  const primitive = (g: BufferGeometry, material: Material) => {
    const p = d.createPrimitive().setMaterial(material);
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
            .setBuffer(buffer),
        );
    }
    const index = g.getIndex();
    if (index)
      p.setIndices(
        d
          .createAccessor()
          .setType("SCALAR")
          .setArray(new Uint16Array(index.array))
          .setBuffer(buffer),
      );
    return p;
  };
  const mesh = (name: string, g: BufferGeometry, material: Material, indexed = true) => {
    const geometry = indexed ? g : g.toNonIndexed();
    const m = d.createMesh(name).addPrimitive(primitive(geometry, material));
    g.dispose();
    geometry.dispose();
    return m;
  };
  const node = (name: string, m: Mesh | null, t: [number, number, number], r?: [number, number, number]) => {
    const n = d.createNode(name).setTranslation(t);
    if (m) n.setMesh(m);
    if (r) n.setRotation(eulerToQuat(r));
    return n;
  };

  const turbine = node("Turbine T-07", null, [0, 0, 0]);
  scene.addChild(turbine);
  turbine.addChild(
    node("Foundation", mesh("Foundation", new CylinderGeometry(2.2, 2.45, 0.5, 64, 1), base), [0, 0.25, 0]),
  );
  turbine.addChild(
    node("Tower", mesh("Tower", new CylinderGeometry(0.3, 0.46, 9, 96, 48), paint), [0, 5, 0]),
  );
  turbine.addChild(
    node("Signal band", mesh("Signal band", new CylinderGeometry(0.352, 0.36, 0.45, 96, 1, true), signal), [0, 7.4, 0]),
  );
  turbine.addChild(
    node("Access door", mesh("Access door", new BoxGeometry(0.06, 0.95, 0.5), hubMetal), [0.44, 1.05, 0]),
  );
  const nacelle = node("Nacelle", null, [0, 9.55, 0]);
  turbine.addChild(nacelle);
  nacelle.addChild(
    node("Nacelle housing", mesh("Nacelle housing", new CapsuleGeometry(0.42, 1.5, 12, 32), paintCopy), [0.15, 0, 0], [0, 0, 90]),
  );
  const rotor = node("Rotor", null, [1.28, 0, 0]);
  nacelle.addChild(rotor);
  rotor.addChild(
    node("Hub", mesh("Hub", new SphereGeometry(0.34, 96, 64), hubMetal), [0, 0, 0]),
  );
  const bladeShape = () => {
    const g = new BoxGeometry(0.07, 3.6, 0.34, 1, 24, 4);
    g.translate(0, 2.05, 0);
    const pos = g.getAttribute("position");
    for (let i = 0; i < pos.count; i++) {
      const t = (pos.getY(i) - 0.25) / 3.6,
        taper = 1 - 0.68 * t;
      pos.setZ(i, pos.getZ(i) * taper + 0.05 * Math.sin(t * Math.PI));
      pos.setX(i, pos.getX(i) * (1 - 0.5 * t));
    }
    g.computeVertexNormals();
    return g;
  };
  ["Blade A", "Blade B", "Blade C"].forEach((name, i) =>
    rotor.addChild(node(name, mesh(name, bladeShape(), blade, false), [0.12, 0, 0], [i * 120, 0, 0])),
  );
  mesh("Spare blade (unused)", bladeShape(), blade, false);
  const fence = node("Service fence", null, [0, 0.5, 0]);
  turbine.addChild(fence);
  for (let i = 0; i < 16; i++) {
    const a = (i / 16) * Math.PI * 2;
    fence.addChild(
      node(
        `Fence post ${String(i + 1).padStart(2, "0")}`,
        mesh(`Fence post ${i + 1}`, new CylinderGeometry(0.035, 0.035, 0.9, 12, 1), steel, false),
        [Math.cos(a) * 2.05, 0.45, Math.sin(a) * 2.05],
      ),
    );
  }
  fence.addChild(
    node("Fence rail", mesh("Fence rail", new TorusGeometry(2.05, 0.022, 8, 96), steel), [0, 0.86, 0], [90, 0, 0]),
  );

  // Baked at 30 fps the way DCC exports usually arrive; resample removes the redundancy.
  const keys = (seconds: number) =>
    new Float32Array(Array.from({ length: seconds * 30 + 1 }, (_, i) => i / 30));
  const spinTimes = keys(4),
    spin = new Float32Array(spinTimes.length * 4);
  spinTimes.forEach((t, i) => spin.set(eulerToQuat([-(t / 4) * 360, 0, 0]), i * 4));
  const yawTimes = keys(6),
    yaw = new Float32Array(yawTimes.length * 4);
  yawTimes.forEach((t, i) => {
    const deg =
      t < 1 ? 0 : t < 3 ? ((t - 1) / 2) * 28 : t < 4 ? 28 : ((6 - t) / 2) * 28;
    yaw.set(eulerToQuat([0, deg, 0]), i * 4);
  });
  const clip = (name: string, target: typeof rotor, times: Float32Array, values: Float32Array) => {
    const sampler = d
      .createAnimationSampler()
      .setInterpolation("LINEAR")
      .setInput(d.createAccessor().setType("SCALAR").setArray(times).setBuffer(buffer))
      .setOutput(d.createAccessor().setType("VEC4").setArray(values).setBuffer(buffer));
    d.createAnimation(name)
      .addSampler(sampler)
      .addChannel(
        d
          .createAnimationChannel()
          .setSampler(sampler)
          .setTargetNode(target)
          .setTargetPath("rotation"),
      );
  };
  clip("Rotor spin", rotor, spinTimes, spin);
  clip("Yaw sweep", nacelle, yawTimes, yaw);
  sample = await writeDocument(d);
  return sample.slice();
}
