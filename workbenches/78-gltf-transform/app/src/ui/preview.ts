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
export function dataUri(bytes: Uint8Array, mime: string) {
  return "data:" + mime + ";base64," + base64(bytes);
}
interface ParserInternals {
  json: unknown;
  plugins: Record<string, { loadTexture?: (i: number) => unknown }>;
  textureLoader: unknown;
  getDependency(type: string, index: number): Promise<unknown>;
  loadTextureImage(i: number, source: number, loader: unknown): Promise<T.Texture | null>;
  loadImageSource: (source: number, loader: unknown) => Promise<T.Texture>;
}
const placeholder = () => {
  const t = new T.DataTexture(new Uint8Array([168, 168, 160, 255]), 1, 1);
  t.needsUpdate = true;
  return t;
};
/**
 * The page CSP allows data: images but not blob:. Embedded PNG/JPEG/WebP/AVIF images
 * are decoded through data URIs; KTX2 has no transcoder here and previews as grey.
 */
export async function loadGlb(bytes: Uint8Array): Promise<GLTF> {
  const loader = new GLTFLoader();
  loader.register((raw) => {
    const parser = raw as unknown as ParserInternals,
      cache = new Map<number, Promise<T.Texture>>();
    parser.loadImageSource = (index: number) => {
      const hit = cache.get(index);
      if (hit) return hit.then((t) => t.clone());
      const promise = (async () => {
        const json = parser.json;
        const def =
          isRecord(json) && Array.isArray(json.images) ? json.images[index] : null;
        if (!isRecord(def) || typeof def.bufferView !== "number")
          throw Error("贴图需嵌入模型。");
        const mime = String(def.mimeType ?? "");
        if (mime === "image/ktx2") return placeholder();
        const buffer = await parser.getDependency("bufferView", def.bufferView);
        if (!(buffer instanceof ArrayBuffer)) throw Error("贴图缓冲区无效。");
        const image = new Image();
        image.src = dataUri(new Uint8Array(buffer), mime || "image/png");
        await image.decode();
        const texture = new T.Texture(image);
        texture.needsUpdate = true;
        texture.userData.mimeType = mime;
        return texture;
      })();
      cache.set(index, promise);
      return promise;
    };
    return {
      name: "WORKBENCH_embedded_images",
      beforeRoot: async () => {
        const basis = parser.plugins.KHR_texture_basisu;
        if (basis)
          basis.loadTexture = (i: number) => {
            const json = parser.json,
              def =
                isRecord(json) && Array.isArray(json.textures)
                  ? json.textures[i]
                  : null,
              ext =
                isRecord(def) && isRecord(def.extensions)
                  ? def.extensions.KHR_texture_basisu
                  : null;
            if (!isRecord(ext) || typeof ext.source !== "number") return null;
            return parser.loadTextureImage(i, ext.source, parser.textureLoader);
          };
      },
    };
  });
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
