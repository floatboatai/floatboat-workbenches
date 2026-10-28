import * as T from "three";
import {
  GLTFLoader,
  type GLTF,
} from "three/examples/jsm/loaders/GLTFLoader.js";
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
