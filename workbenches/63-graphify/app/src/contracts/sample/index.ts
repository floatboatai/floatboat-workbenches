// ABOUTME: 示例资料集的图谱与工作对象；浏览器与服务端用同一抽取器得到同一内容地址。

import { extractCorpus } from "../extract/index.ts";
import { corpusEntry } from "../corpus.ts";
import { sha256 } from "../hash.ts";
import { emptyProject, refFor, type MapProject } from "../map.ts";
import type { Graph } from "../graph.ts";
import { SAMPLE_NAME, sampleFiles } from "./corpus.ts";

export { SAMPLE_NAME, sampleFiles };

let cached: { graph: Graph; project: MapProject; texts: Map<string, string> } | null = null;

export function sample() {
  if (cached) return cached;
  const { graph } = extractCorpus(sampleFiles);
  const corpus = sampleFiles.map((f) => corpusEntry(f.path, f.text));
  const project: MapProject = {
    ...emptyProject(),
    corpus,
    graph: refFor(graph),
    selected: "replenish_policy_reorderpolicy",
    from: "replenish_jobs_nightly_run",
    to: "concept_安全库存",
    ignoreDirection: true,
    notes: {
      replenish_policy_reorderpolicy: "建议量的核心入口。交期缺失时改用品类默认交期（见周会纪要），需要确认审批界面已显示该标注。",
      concept_安全库存: "ADR-0003 的公式在 safety_stock 中实现；促销隔离可能让预测误差偏低，待数据组回测。",
    },
  };
  cached = { graph, project, texts: new Map(sampleFiles.map((f) => [sha256(f.text), f.text])) };
  return cached;
}
