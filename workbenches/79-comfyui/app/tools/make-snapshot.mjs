// ABOUTME: 把 ComfyUI /object_info 的核心节点子集转成内置快照模块（只含接口元数据，不含代码）。
// 用法：node tools/make-snapshot.mjs <object_info.json> <commit-or-tag> [src/contracts/core-nodes-data.ts]
// 过滤规则：python_module 为 nodes 的全部节点，加上 KEEP_MODULES 里列出的 comfy_extras 模块。
import { readFileSync, writeFileSync } from "node:fs";

const [source, version, target = new URL("../src/contracts/core-nodes-data.ts", import.meta.url).pathname] = process.argv.slice(2);
if (!source || !version) throw new Error("usage: make-snapshot.mjs <object_info.json> <version> [target]");

const KEEP_MODULES = new Set([
  "nodes",
  "comfy_extras.nodes_post_processing",
  "comfy_extras.nodes_mask",
  "comfy_extras.nodes_upscale_model",
  "comfy_extras.nodes_custom_sampler",
  "comfy_extras.nodes_model_advanced",
  "comfy_extras.nodes_images",
  "comfy_extras.nodes_clip_sdxl",
  "comfy_extras.nodes_primitive",
  "comfy_extras.nodes_cond",
  "comfy_extras.nodes_latent",
  "comfy_extras.nodes_compositing",
  "comfy_extras.nodes_string",
  "comfy_extras.nodes_align_your_steps",
  "comfy_extras.nodes_sd3",
  "comfy_extras.nodes_controlnet",
]);
// File-backed combos are empty on a fresh install; give them example names so offline templates are complete.
const EXAMPLES = {
  ckpt_name: ["sd_xl_base_1.0.safetensors", "sd_xl_refiner_1.0.safetensors", "v1-5-pruned-emaonly.safetensors"],
  vae_name: ["sdxl_vae.safetensors", "vae-ft-mse-840000-ema-pruned.safetensors"],
  lora_name: ["add-detail-xl.safetensors", "lcm-lora-sdxl.safetensors"],
  control_net_name: ["control-lora-canny-rank256.safetensors", "control_v11p_sd15_canny.pth"],
  model_name: ["RealESRGAN_x4plus.pth", "4x-UltraSharp.pth"],
  unet_name: ["flux1-dev.safetensors"],
  clip_name: ["clip_l.safetensors", "t5xxl_fp16.safetensors"],
  clip_name1: ["clip_l.safetensors"],
  clip_name2: ["t5xxl_fp16.safetensors"],
  style_model_name: ["flux1-redux-dev.safetensors"],
  image: ["example.png"],
};

const info = JSON.parse(readFileSync(source, "utf8"));
const out = {};
for (const [name, def] of Object.entries(info)) {
  if (!KEEP_MODULES.has(def.python_module) || def.dev_only === true || def.api_node === true) continue;
  const copy = structuredClone(def);
  for (const key of ["price_badge", "search_aliases", "essentials_category", "dev_only", "api_node", "has_intermediate_output", "output_matchtypes", "is_input_list", "deprecated", "experimental"])
    if (copy[key] === null || copy[key] === false) delete copy[key];
  if (Array.isArray(copy.output_tooltips) && copy.output_tooltips.every((t) => !t)) delete copy.output_tooltips;
  if (!copy.description) delete copy.description;
  for (const group of ["required", "optional"]) {
    for (const [input, spec] of Object.entries(copy.input?.[group] ?? {})) {
      const example = EXAMPLES[input];
      if (!example || !Array.isArray(spec)) continue;
      if (Array.isArray(spec[0]) && spec[0].length === 0) spec[0] = example;
      else if (spec[0] === "COMBO" && spec[1] && Array.isArray(spec[1].options) && spec[1].options.length === 0) spec[1].options = example;
    }
  }
  out[name] = copy;
}
const json = JSON.stringify(out);
const module = `// ABOUTME: 自动生成：ComfyUI ${version} 核心节点的接口元数据快照（/object_info 子集），不含 ComfyUI 代码。
// 重新生成：node tools/make-snapshot.mjs <object_info.json> <version>
export const CORE_SNAPSHOT_META = { version: ${JSON.stringify(version)}, nodes: ${Object.keys(out).length} } as const;
export const CORE_OBJECT_INFO_JSON = ${JSON.stringify(json)};
`;
writeFileSync(target, module);
console.log(`wrote ${Object.keys(out).length} nodes, ${json.length} bytes -> ${target}`);
