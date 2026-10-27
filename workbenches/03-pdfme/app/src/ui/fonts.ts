import type { Font } from "@pdfme/common";
import fontUrl from "../assets/noto-sans-sc.otf?url";
let pending: Promise<Font> | undefined;
export function loadFont(): Promise<Font> {
  return (pending ??= fetch(fontUrl)
    .then(async (response) => {
      if (!response.ok) throw new Error("中文字体加载失败，请刷新重试。");
      return {
        NotoSansSC: { data: await response.arrayBuffer(), fallback: true },
      };
    })
    .catch((error) => {
      pending = undefined;
      throw error;
    }));
}
