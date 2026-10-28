import { validateModel, type ModelDocument } from "../contracts/model";
import {
  loadGlb,
  rigFor,
  bindModel,
  exportGlb,
  dispose,
  clipsFor,
} from "./native";
import { readSource, readBytes, upload } from "./files";
import { inspectGlb } from "../contracts/glb";
export async function bindSnapshot(d: ModelDocument) {
  validateModel(d);
  if (!d.source) throw Error("请先载入模型。");
  const [model, rig] = await Promise.all([
    readSource(d.source).then(loadGlb),
    readBytes("/api/assets/human-rig.glb").then(loadGlb),
  ]);
  let result: ReturnType<typeof bindModel> | undefined;
  try {
    result = bindModel(model, rigFor(rig, d), d);
    const bytes = await exportGlb(result.group);
    const info = inspectGlb(bytes, "bound");
    if (!info.skins) throw Error("绑定结果没有骨架。");
    const ref = await upload(
      bytes,
      ("bound-" + d.source.name).slice(0, 160),
      "bound",
    );
    return {
      ref,
      vertices: result.vertices,
      influenced: result.influenced,
      bones: result.bones,
    };
  } finally {
    dispose(model.scene);
    dispose(rig.scene);
    if (result) dispose(result.group);
  }
}
export async function exportSnapshot(d: ModelDocument) {
  if (!d.bound) throw Error("请先完成绑定。");
  const [model, library] = await Promise.all([
    readSource(d.bound).then(loadGlb),
    readBytes("/api/assets/human-animations.glb").then(loadGlb),
  ]);
  try {
    const clip = clipsFor(library, d.scale).find((c) => c.name === d.clip);
    if (!clip) throw Error("当前动作不在动作库内。");
    return await exportGlb(model.scene, [clip]);
  } finally {
    dispose(model.scene);
    dispose(library.scene);
  }
}
