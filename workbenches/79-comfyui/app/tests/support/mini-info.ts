// ABOUTME: 测试用的最小 /object_info（手写，字段形状同 ComfyUI），覆盖转换与校验所需的核心节点。

type Spec = [unknown, Record<string, unknown>?];
const node = (
  name: string,
  required: Record<string, Spec>,
  output: string[],
  extra: Record<string, unknown> = {},
  optional: Record<string, Spec> = {},
) => ({
  input: { required, ...(Object.keys(optional).length ? { optional } : {}) },
  input_order: { required: Object.keys(required), ...(Object.keys(optional).length ? { optional: Object.keys(optional) } : {}) },
  output,
  output_is_list: output.map(() => false),
  output_name: output,
  name,
  display_name: name,
  description: "",
  python_module: "nodes",
  category: "test",
  output_node: false,
  ...extra,
});

export const MINI_INFO: Record<string, unknown> = {
  CheckpointLoaderSimple: node("CheckpointLoaderSimple", { ckpt_name: [["sd_xl_base_1.0.safetensors", "v1-5-pruned-emaonly.safetensors"]] }, ["MODEL", "CLIP", "VAE"], { output_name: ["MODEL", "CLIP", "VAE"], category: "loaders" }),
  CLIPTextEncode: node("CLIPTextEncode", { text: ["STRING", { multiline: true, dynamicPrompts: true }], clip: ["CLIP"] }, ["CONDITIONING"], { category: "conditioning" }),
  EmptyLatentImage: node("EmptyLatentImage", { width: ["INT", { default: 512, min: 16, max: 16384, step: 8 }], height: ["INT", { default: 512, min: 16, max: 16384, step: 8 }], batch_size: ["INT", { default: 1, min: 1, max: 4096 }] }, ["LATENT"], { category: "latent" }),
  KSampler: node("KSampler", {
    model: ["MODEL"],
    seed: ["INT", { default: 0, min: 0, max: 18446744073709551615, control_after_generate: true }],
    steps: ["INT", { default: 20, min: 1, max: 10000 }],
    cfg: ["FLOAT", { default: 8, min: 0, max: 100, step: 0.1, round: 0.01 }],
    sampler_name: [["euler", "dpmpp_2m", "dpmpp_sde"]],
    scheduler: [["normal", "karras", "simple"]],
    positive: ["CONDITIONING"],
    negative: ["CONDITIONING"],
    latent_image: ["LATENT"],
    denoise: ["FLOAT", { default: 1, min: 0, max: 1, step: 0.01 }],
  }, ["LATENT"], { category: "sampling" }),
  VAEDecode: node("VAEDecode", { samples: ["LATENT"], vae: ["VAE"] }, ["IMAGE"], { category: "latent" }),
  VAEEncode: node("VAEEncode", { pixels: ["IMAGE"], vae: ["VAE"] }, ["LATENT"], { category: "latent" }),
  SaveImage: node("SaveImage", { images: ["IMAGE"], filename_prefix: ["STRING", { default: "ComfyUI" }] }, [], { output_node: true, category: "image" }),
  PreviewImage: node("PreviewImage", { images: ["IMAGE"] }, [], { output_node: true, category: "image" }),
  LoadImage: node("LoadImage", { image: [["example.png"], { image_upload: true }] }, ["IMAGE", "MASK"], { category: "image" }),
  LoraLoader: node("LoraLoader", { model: ["MODEL"], clip: ["CLIP"], lora_name: [["add-detail-xl.safetensors"]], strength_model: ["FLOAT", { default: 1, min: -100, max: 100, step: 0.01 }], strength_clip: ["FLOAT", { default: 1, min: -100, max: 100, step: 0.01 }] }, ["MODEL", "CLIP"], { category: "loaders" }),
  ImageScaleBy: node("ImageScaleBy", { image: ["IMAGE"], upscale_method: [["nearest-exact", "bilinear", "lanczos"]], scale_by: ["FLOAT", { default: 1, min: 0.01, max: 8, step: 0.01 }] }, ["IMAGE"], { category: "image" }),
  // newer COMBO encoding
  ModernCombo: node("ModernCombo", { mode: ["COMBO", { options: ["a", "b"], default: "b" }] }, ["STRING"], { category: "test" }),
};
