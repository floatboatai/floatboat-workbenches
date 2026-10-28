import { isRecord } from "../contracts/project";
import { restoreMontage, type Montage } from "../contracts/montage";
import { base64, unbase64, upload, videoBytes } from "./media";
export async function pack(
  title: string,
  data: Montage,
  draft: Record<string, unknown>,
) {
  const sources = new Map(
    data.shots.filter((s) => s.source).map((s) => [s.source!.id, s.source!]),
  );
  const assets = [];
  for (const source of sources.values())
    assets.push({ id: source.id, base64: base64(await videoBytes(source.id)) });
  return new Blob(
    [
      JSON.stringify({
        format: "floatboat-openmontage-v1",
        title,
        data,
        draft,
        assets,
      }),
    ],
    { type: "application/json" },
  );
}
export async function unpack(file: File) {
  if (file.size > 85 * 1024 * 1024) throw new Error("工程文件超过85MB");
  const v: unknown = JSON.parse(await file.text());
  if (
    !isRecord(v) ||
    v.format !== "floatboat-openmontage-v1" ||
    typeof v.title !== "string" ||
    !Array.isArray(v.assets)
  )
    throw new Error("工程文件格式无效");
  const data = restoreMontage(v.data),
    sources = new Map(
      data.shots.filter((s) => s.source).map((s) => [s.source!.id, s.source!]),
    );
  if (v.assets.length !== sources.size) throw new Error("工程素材数量不完整");
  const seen = new Set<string>();
  for (const asset of v.assets) {
    if (
      !isRecord(asset) ||
      typeof asset.id !== "string" ||
      typeof asset.base64 !== "string"
    )
      throw new Error("素材格式无效");
    const source = sources.get(asset.id);
    if (!source || seen.has(asset.id))
      throw new Error("工程素材标识重复或未知");
    seen.add(asset.id);
    const bytes = unbase64(asset.base64);
    if (bytes.length !== source.bytes) throw new Error("工程素材大小不匹配");
    await upload(bytes, source, () => {});
  }
  return {
    title: v.title,
    data,
    draft: isRecord(v.draft) ? { ...v.draft } : {},
  };
}
