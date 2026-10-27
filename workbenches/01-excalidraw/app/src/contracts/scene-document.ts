import { emptyScene, record, sceneValue } from "./boards.ts";
export interface SceneDocument {
  scene: string;
}
export const seedScene: SceneDocument = { scene: emptyScene };
export function validateSceneDocument(value: unknown): SceneDocument {
  if (!record(value)) throw new Error("画布项目格式无效。");
  return { scene: sceneValue(value.scene) };
}
export function restoreSceneDraft(value: unknown): SceneDocument {
  if (
    !record(value) ||
    typeof value.scene !== "string" ||
    new TextEncoder().encode(value.scene).length > 16000000
  )
    throw new Error("画布恢复草稿格式或容量无效。");
  const parsed: unknown = JSON.parse(value.scene);
  if (
    !record(parsed) ||
    !Array.isArray(parsed.elements) ||
    parsed.elements.length > 10000 ||
    !parsed.elements.every(
      (item) => record(item) && typeof item.type === "string",
    ) ||
    (parsed.files !== undefined && !record(parsed.files))
  )
    throw new Error("画布恢复草稿结构无效。");
  return { scene: value.scene };
}
