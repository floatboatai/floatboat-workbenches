import * as T from "three";
import {
  GLTFLoader,
  type GLTF,
} from "three/examples/jsm/loaders/GLTFLoader.js";
import { GLTFExporter } from "three/examples/jsm/exporters/GLTFExporter.js";
import SkinningAlgorithm from "../vendor/solvers/SkinningAlgorithm.js";
import { AnimationUtility } from "../vendor/processes/animations-listing/AnimationUtility.js";
import type { ModelDocument } from "../contracts/model.ts";
import { isRecord } from "../contracts/project.ts";
export function base64(bytes: Uint8Array) {
  let s = "";
  for (let i = 0; i < bytes.length; i += 8192)
    s += String.fromCharCode(...bytes.subarray(i, i + 8192));
  return btoa(s);
}
export function unbase64(s: string) {
  return Uint8Array.from(atob(s), (c) => c.charCodeAt(0));
}
export async function loadGlb(bytes: Uint8Array): Promise<GLTF> {
  const loader = new GLTFLoader();
  loader.register((parser) => ({
    name: "WORKBENCH_embedded_images",
    loadTexture: async (index: number) => {
      const json: unknown = parser.json;
      if (
        !isRecord(json) ||
        !Array.isArray(json.textures) ||
        !Array.isArray(json.images)
      )
        throw Error("贴图数据缺失。");
      const tex = json.textures[index];
      if (!isRecord(tex) || typeof tex.source !== "number")
        throw Error("贴图引用无效。");
      const source = json.images[tex.source];
      if (
        !isRecord(source) ||
        source.uri !== undefined ||
        typeof source.bufferView !== "number" ||
        !["image/png", "image/jpeg"].includes(String(source.mimeType))
      )
        throw Error("只支持嵌入PNG/JPEG贴图。");
      const raw: unknown = await parser.getDependency(
        "bufferView",
        source.bufferView,
      );
      if (!(raw instanceof ArrayBuffer)) throw Error("贴图缓冲区无效。");
      const image = new Image();
      await new Promise<void>((resolve, reject) => {
        image.onload = () => resolve();
        image.onerror = () => reject(Error("贴图无法解码。"));
        image.src =
          "data:" + source.mimeType + ";base64," + base64(new Uint8Array(raw));
      });
      const texture = new T.Texture(image);
      texture.flipY = false;
      const sampler =
        Array.isArray(json.samplers) && typeof tex.sampler === "number"
          ? json.samplers[tex.sampler]
          : undefined;
      const wraps: Record<number, T.Wrapping> = {
        10497: T.RepeatWrapping,
        33071: T.ClampToEdgeWrapping,
        33648: T.MirroredRepeatWrapping,
      };
      const mins: Record<number, T.MinificationTextureFilter> = {
        9728: T.NearestFilter,
        9729: T.LinearFilter,
        9984: T.NearestMipmapNearestFilter,
        9985: T.LinearMipmapNearestFilter,
        9986: T.NearestMipmapLinearFilter,
        9987: T.LinearMipmapLinearFilter,
      };
      texture.wrapS = isRecord(sampler)
        ? (wraps[Number(sampler.wrapS)] ?? T.RepeatWrapping)
        : T.RepeatWrapping;
      texture.wrapT = isRecord(sampler)
        ? (wraps[Number(sampler.wrapT)] ?? T.RepeatWrapping)
        : T.RepeatWrapping;
      if (isRecord(sampler)) {
        texture.minFilter =
          mins[Number(sampler.minFilter)] ?? T.LinearMipmapLinearFilter;
        texture.magFilter =
          sampler.magFilter === 9728 ? T.NearestFilter : T.LinearFilter;
      }
      texture.needsUpdate = true;
      return texture;
    },
  }));
  return loader.parseAsync(bytes.slice().buffer, "");
}
export function bonesOf(root: T.Object3D) {
  const bones: T.Bone[] = [];
  root.traverse((o) => {
    if (o instanceof T.Bone) bones.push(o);
  });
  return bones;
}
export function rigFor(
  gltf: GLTF,
  d: Pick<ModelDocument, "scale" | "offsets">,
) {
  const rig = gltf.scene.clone(true);
  rig.updateMatrixWorld(true);
  const bones = bonesOf(rig);
  for (const b of bones) {
    const o = d.offsets[b.name] ?? { x: 0, y: 0, z: 0 };
    b.position.add(new T.Vector3(o.x, o.y, o.z)).multiplyScalar(d.scale);
  }
  rig.updateMatrixWorld(true);
  return rig;
}
export function normalizedModel(model: GLTF) {
  const scene = model.scene;
  scene.updateMatrixWorld(true);
  const box = new T.Box3().setFromObject(scene),
    size = box.getSize(new T.Vector3()),
    center = box.getCenter(new T.Vector3());
  if (!Number.isFinite(size.y) || size.y < 0.001) throw Error("模型高度过小。");
  const scale = 1.8295641520526261 / size.y;
  const matrix = new T.Matrix4()
    .makeScale(scale, scale, scale)
    .multiply(
      new T.Matrix4().makeTranslation(-center.x, -box.min.y, -center.z),
    );
  return { scene, matrix };
}
export function bindModel(model: GLTF, rig: T.Group, d: ModelDocument) {
  const all = bonesOf(rig);
  if (!all.length) throw Error("骨架缺失。");
  const root = all[0],
    solver = new SkinningAlgorithm(root, "human"),
    group = new T.Group();
  group.name = "Character";
  group.add(rig);
  group.updateMatrixWorld(true);
  const skeleton = new T.Skeleton(all);
  skeleton.calculateInverses();
  const { scene, matrix } = normalizedModel(model);
  let vertices = 0;
  const influenced = new Set<number>();
  scene.traverse((object) => {
    if (!(object instanceof T.Mesh)) return;
    const geometry = object.geometry
      .clone()
      .applyMatrix4(matrix.clone().multiply(object.matrixWorld));
    solver.set_geometry(geometry);
    const [indices, weights] = solver.calculate_indexes_and_weights();
    if (
      indices.length !== geometry.attributes.position.count * 4 ||
      weights.some((w) => !Number.isFinite(w))
    )
      throw Error("绑定结果无效。");
    for (let i = 0; i < indices.length; i++)
      if (weights[i] > 0) influenced.add(indices[i]);
    geometry.setAttribute("skinIndex", new T.Uint16BufferAttribute(indices, 4));
    geometry.setAttribute(
      "skinWeight",
      new T.Float32BufferAttribute(weights, 4),
    );
    const material = Array.isArray(object.material)
      ? object.material.map((m) => m.clone())
      : object.material.clone();
    const mesh = new T.SkinnedMesh(geometry, material);
    mesh.name = object.name || "CharacterMesh";
    mesh.bind(skeleton);
    mesh.frustumCulled = false;
    group.add(mesh);
    vertices += geometry.attributes.position.count;
  });
  group.updateMatrixWorld(true);
  return { group, vertices, influenced: influenced.size, bones: all.length };
}
export function clipsFor(gltf: GLTF, scale: number) {
  const clips = gltf.animations.map((clip) =>
    AnimationUtility.deep_clone_animation_clip(clip),
  );
  AnimationUtility.clean_track_data(clips, "pelvis");
  AnimationUtility.apply_skeleton_scale_to_position_keyframes(clips, scale);
  return clips;
}
export async function exportGlb(
  root: T.Object3D,
  clips: T.AnimationClip[] = [],
) {
  const data = await new GLTFExporter().parseAsync(root, {
    binary: true,
    animations: clips,
    onlyVisible: true,
  });
  if (!(data instanceof ArrayBuffer)) throw Error("GLB导出失败。");
  return new Uint8Array(data);
}
export function dispose(root: T.Object3D) {
  const textures = new Set<T.Texture>(),
    geometries = new Set<T.BufferGeometry>(),
    materials = new Set<T.Material>();
  root.traverse((o) => {
    if (o instanceof T.Mesh) {
      geometries.add(o.geometry);
      for (const m of Array.isArray(o.material) ? o.material : [o.material]) {
        materials.add(m);
        for (const value of Object.values(m))
          if (value instanceof T.Texture) textures.add(value);
      }
    }
  });
  textures.forEach((t) => t.dispose());
  materials.forEach((m) => m.dispose());
  geometries.forEach((g) => g.dispose());
}
