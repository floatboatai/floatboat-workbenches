// ABOUTME: 内置 ComfyUI 核心节点定义快照（接口元数据，不含代码）的解析入口。

import { normaliseDefs, type NodeDefs } from "./comfy.ts";
import { CORE_OBJECT_INFO_JSON, CORE_SNAPSHOT_META } from "./core-nodes-data.ts";

let cache: NodeDefs | null = null;
export function coreDefs(): NodeDefs {
  cache ??= normaliseDefs(JSON.parse(CORE_OBJECT_INFO_JSON));
  return cache;
}
export const coreSnapshotMeta = CORE_SNAPSHOT_META;
