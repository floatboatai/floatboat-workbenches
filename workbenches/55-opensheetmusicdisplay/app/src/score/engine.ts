import type { OpenSheetMusicDisplay } from "opensheetmusicdisplay";
import type { ScoreProject } from "../contracts/domain";
let pending: Promise<typeof import("opensheetmusicdisplay")> | undefined;
export function loadEngine() {
  return (pending ??= import("opensheetmusicdisplay").catch((error) => {
    pending = undefined;
    throw error;
  }));
}
export function configure(
  engine: OpenSheetMusicDisplay,
  settings: Pick<ScoreProject, "partId" | "layout" | "zoom">,
) {
  engine.setOptions({
    pageFormat: settings.layout === "page" ? "A4_P" : "Endless",
    autoResize: false,
    drawTitle: true,
    drawComposer: true,
    drawMeasureNumbers: true,
  });
  engine.Zoom = settings.zoom;
  for (const instrument of engine.Sheet.Instruments)
    instrument.Visible =
      !settings.partId || instrument.IdString === settings.partId;
}
export async function trialRender(xml: string): Promise<void> {
  const { OpenSheetMusicDisplay } = await loadEngine();
  const container = document.createElement("div");
  container.style.cssText =
    "position:fixed;left:-10000px;top:0;width:860px;visibility:hidden;pointer-events:none";
  document.body.append(container);
  const engine = new OpenSheetMusicDisplay(container, {
    backend: "svg",
    autoResize: false,
    pageFormat: "A4_P",
  });
  try {
    engine.setLogLevel("error");
    await engine.load(xml);
    engine.render();
    if (!container.querySelector("svg path"))
      throw new Error("乐谱没有可显示的音符。");
  } finally {
    engine.clear();
    container.remove();
  }
}
export function serializeScore(container: HTMLElement): string {
  const pages = Array.from(container.querySelectorAll("svg"));
  if (!pages.length) throw new Error("请等待乐谱渲染完成。");
  const ns = "http://www.w3.org/2000/svg";
  const output = document.createElementNS(ns, "svg");
  output.setAttribute("xmlns", ns);
  output.setAttribute("role", "img");
  output.setAttribute("aria-label", "Reviewed music score");
  let height = 0,
    width = 0;
  for (const page of pages) {
    const box = page.viewBox.baseVal;
    const w = box.width || Number.parseFloat(page.getAttribute("width") || "0"),
      h = box.height || Number.parseFloat(page.getAttribute("height") || "0");
    if (!w || !h) throw new Error("乐谱页面尺寸无效。");
    const copy = page.cloneNode(true) as SVGSVGElement;
    copy.setAttribute("x", "0");
    copy.setAttribute("y", String(height));
    copy.setAttribute("width", String(w));
    copy.setAttribute("height", String(h));
    copy.setAttribute("viewBox", `${box.x} ${box.y} ${w} ${h}`);
    copy.style.fontFamily = "Times New Roman, serif";
    copy.style.color = "#111";
    copy.style.backgroundColor = "white";
    output.append(copy);
    height += h + 24;
    width = Math.max(width, w);
  }
  output.setAttribute("width", String(width));
  output.setAttribute("height", String(height - 24));
  output.setAttribute("viewBox", `0 0 ${width} ${height - 24}`);
  const background = document.createElementNS(ns, "rect");
  background.setAttribute("width", "100%");
  background.setAttribute("height", "100%");
  background.setAttribute("fill", "#ffffff");
  output.prepend(background);
  return new XMLSerializer().serializeToString(output);
}
