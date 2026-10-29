// ABOUTME: 内置示例工作流（仅用 ComfyUI 核心节点）：以 API 提示词描述，按当前节点定义生成画布图。

import { widgetLayout, type NodeDefs } from "./comfy.ts";
import { fromApiPrompt, type ApiPrompt } from "./convert.ts";
import type { UiWorkflow } from "./workflow.ts";

export interface TemplateInfo {
  id: string;
  title: string;
  summary: string;
  prompt: ApiPrompt;
  groups?: { title: string; nodes: string[]; color: string }[];
}

const POSITIVE = "a cozy wooden cabin in a snowy pine forest at dusk, warm light glowing in the windows, soft volumetric fog, highly detailed, photographic";
const NEGATIVE = "blurry, low quality, watermark, text, oversaturated";
const node = (class_type: string, inputs: Record<string, unknown>, title?: string) => ({
  class_type,
  inputs,
  ...(title ? { _meta: { title } } : {}),
});
const sampler = (model: unknown, positive: unknown, negative: unknown, latent: unknown, extra: Record<string, unknown> = {}) =>
  node("KSampler", {
    seed: 156680208700286, steps: 25, cfg: 7, sampler_name: "dpmpp_2m", scheduler: "karras", denoise: 1,
    model, positive, negative, latent_image: latent, ...extra,
  });

const txt2img: ApiPrompt = {
  "4": node("CheckpointLoaderSimple", { ckpt_name: "sd_xl_base_1.0.safetensors" }),
  "6": node("CLIPTextEncode", { text: POSITIVE, clip: ["4", 1] }, "正向提示词"),
  "7": node("CLIPTextEncode", { text: NEGATIVE, clip: ["4", 1] }, "反向提示词"),
  "5": node("EmptyLatentImage", { width: 1024, height: 1024, batch_size: 1 }),
  "3": sampler(["4", 0], ["6", 0], ["7", 0], ["5", 0]),
  "8": node("VAEDecode", { samples: ["3", 0], vae: ["4", 2] }),
  "9": node("SaveImage", { filename_prefix: "cabin", images: ["8", 0] }),
};

const img2img: ApiPrompt = {
  "4": node("CheckpointLoaderSimple", { ckpt_name: "sd_xl_base_1.0.safetensors" }),
  "6": node("CLIPTextEncode", { text: "the same cabin in autumn, golden leaves, late afternoon sun, photographic", clip: ["4", 1] }, "正向提示词"),
  "7": node("CLIPTextEncode", { text: NEGATIVE, clip: ["4", 1] }, "反向提示词"),
  "10": node("LoadImage", { image: "example.png" }),
  "11": node("VAEEncode", { pixels: ["10", 0], vae: ["4", 2] }),
  "3": sampler(["4", 0], ["6", 0], ["7", 0], ["11", 0], { denoise: 0.6 }),
  "8": node("VAEDecode", { samples: ["3", 0], vae: ["4", 2] }),
  "9": node("SaveImage", { filename_prefix: "img2img", images: ["8", 0] }),
};

const upscale: ApiPrompt = {
  "10": node("LoadImage", { image: "example.png" }),
  "12": node("UpscaleModelLoader", { model_name: "RealESRGAN_x4plus.pth" }),
  "13": node("ImageUpscaleWithModel", { upscale_model: ["12", 0], image: ["10", 0] }),
  "14": node("ImageScaleBy", { upscale_method: "lanczos", scale_by: 0.5, image: ["13", 0] }, "缩放回 2×"),
  "9": node("SaveImage", { filename_prefix: "upscaled", images: ["14", 0] }),
  "15": node("PreviewImage", { images: ["10", 0] }, "原图"),
};

const lora: ApiPrompt = {
  "4": node("CheckpointLoaderSimple", { ckpt_name: "sd_xl_base_1.0.safetensors" }),
  "16": node("LoraLoader", { lora_name: "add-detail-xl.safetensors", strength_model: 0.8, strength_clip: 0.8, model: ["4", 0], clip: ["4", 1] }),
  "6": node("CLIPTextEncode", { text: POSITIVE, clip: ["16", 1] }, "正向提示词"),
  "7": node("CLIPTextEncode", { text: NEGATIVE, clip: ["16", 1] }, "反向提示词"),
  "5": node("EmptyLatentImage", { width: 1024, height: 1024, batch_size: 1 }),
  "3": sampler(["16", 0], ["6", 0], ["7", 0], ["5", 0]),
  "8": node("VAEDecode", { samples: ["3", 0], vae: ["4", 2] }),
  "9": node("SaveImage", { filename_prefix: "lora", images: ["8", 0] }),
};

const inpaint: ApiPrompt = {
  "4": node("CheckpointLoaderSimple", { ckpt_name: "sd_xl_base_1.0.safetensors" }),
  "6": node("CLIPTextEncode", { text: "a stone chimney with a thin line of smoke, photographic", clip: ["4", 1] }, "正向提示词"),
  "7": node("CLIPTextEncode", { text: NEGATIVE, clip: ["4", 1] }, "反向提示词"),
  "10": node("LoadImage", { image: "example.png" }, "原图（透明处为重绘区域）"),
  "17": node("VAEEncodeForInpaint", { pixels: ["10", 0], vae: ["4", 2], mask: ["10", 1], grow_mask_by: 6 }),
  "3": sampler(["4", 0], ["6", 0], ["7", 0], ["17", 0], { denoise: 1 }),
  "8": node("VAEDecode", { samples: ["3", 0], vae: ["4", 2] }),
  "9": node("SaveImage", { filename_prefix: "inpaint", images: ["8", 0] }),
};

const controlnet: ApiPrompt = {
  "4": node("CheckpointLoaderSimple", { ckpt_name: "sd_xl_base_1.0.safetensors" }),
  "6": node("CLIPTextEncode", { text: POSITIVE, clip: ["4", 1] }, "正向提示词"),
  "7": node("CLIPTextEncode", { text: NEGATIVE, clip: ["4", 1] }, "反向提示词"),
  "10": node("LoadImage", { image: "example.png" }, "控制图（边缘/深度）"),
  "18": node("ControlNetLoader", { control_net_name: "control-lora-canny-rank256.safetensors" }),
  "19": node("ControlNetApplyAdvanced", { strength: 0.8, start_percent: 0, end_percent: 1, positive: ["6", 0], negative: ["7", 0], control_net: ["18", 0], image: ["10", 0], vae: ["4", 2] }),
  "5": node("EmptyLatentImage", { width: 1024, height: 1024, batch_size: 1 }),
  "3": sampler(["4", 0], ["19", 0], ["19", 1], ["5", 0]),
  "8": node("VAEDecode", { samples: ["3", 0], vae: ["4", 2] }),
  "9": node("SaveImage", { filename_prefix: "controlnet", images: ["8", 0] }),
};

export const TEMPLATES: TemplateInfo[] = [
  {
    id: "txt2img", title: "文生图 · SDXL", summary: "检查点 → 两个 CLIP 文本编码 → KSampler → VAE 解码 → 保存图像。", prompt: txt2img,
    groups: [{ title: "提示词", nodes: ["6", "7"], color: "#5b8bd9" }, { title: "采样与输出", nodes: ["3", "8", "9"], color: "#d99a4e" }],
  },
  { id: "img2img", title: "图生图", summary: "载入一张图，编码后以 0.6 的重绘强度再采样。", prompt: img2img },
  { id: "upscale", title: "放大", summary: "放大模型放大 4×，再缩回 2× 并保存。", prompt: upscale },
  { id: "lora", title: "LoRA", summary: "在检查点后接入 LoRA 加载器，模型与 CLIP 同时受影响。", prompt: lora },
  { id: "inpaint", title: "局部重绘", summary: "用图片的透明区域作蒙版，VAE 编码重绘。", prompt: inpaint },
  { id: "controlnet", title: "ControlNet", summary: "控制图与 ControlNet 同时作用于正反向条件。", prompt: controlnet },
];

/** Replaces combo values missing from the connected server's lists with its first option. */
export function fitCombos(workflow: UiWorkflow, defs: NodeDefs): UiWorkflow {
  for (const n of workflow.nodes) {
    const def = defs[n.type];
    if (!def || !Array.isArray(n.widgets_values)) continue;
    widgetLayout(def).forEach((w, i) => {
      if (w.kind !== "combo" || !Array.isArray(n.widgets_values)) return;
      const options = w.input.options ?? [];
      if (options.length && !options.includes(String(n.widgets_values[i]))) n.widgets_values[i] = options[0];
    });
  }
  return workflow;
}

export function buildTemplate(id: string, defs: NodeDefs, authoritativeCombos = false): UiWorkflow {
  const t = TEMPLATES.find((x) => x.id === id) ?? TEMPLATES[0];
  const wf = fromApiPrompt(t.prompt, defs);
  for (const n of wf.nodes) {
    // ComfyUI's own default: seeds change after each run.
    if (Array.isArray(n.widgets_values)) n.widgets_values = n.widgets_values.map((v) => (v === "fixed" ? "randomize" : v));
  }
  for (const g of t.groups ?? []) {
    const members = wf.nodes.filter((n) => g.nodes.includes(String(n.id)));
    if (!members.length) continue;
    const x0 = Math.min(...members.map((n) => n.pos[0])) - 20,
      y0 = Math.min(...members.map((n) => n.pos[1])) - 70,
      x1 = Math.max(...members.map((n) => n.pos[0] + (n.size as [number, number])[0])) + 20,
      y1 = Math.max(...members.map((n) => n.pos[1] + (n.size as [number, number])[1])) + 20;
    wf.groups.push({ title: g.title, bounding: [x0, y0, x1 - x0, y1 - y0], color: g.color, font_size: 22, flags: {} });
  }
  return authoritativeCombos ? fitCombos(wf, defs) : wf;
}
