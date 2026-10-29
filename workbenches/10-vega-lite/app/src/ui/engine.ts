// ABOUTME: 浏览器渲染引擎：编译 Vega-Lite、用 AST 解释器运行 Vega（无 eval），拦截所有外部资源，并导出 SVG/PNG/Vega 规格。
import { compile, type TopLevelSpec } from "vega-lite";
import { loader as createLoader, parse, View } from "vega";
import { expressionInterpreter } from "vega-interpreter";
import type { DatasetRef } from "../contracts/datasets";
import { prepareSpec, type PrepareOptions } from "../contracts/render-spec";

export interface RenderLog {
  warnings: string[];
  errors: string[];
}
export interface Rendered {
  view: View;
  vega: Record<string, unknown>;
  log: RenderLog;
}

const join = (args: unknown[]) =>
  args.map((item) => (item instanceof Error ? item.message : typeof item === "string" ? item : JSON.stringify(item))).join(" ");

function collector(log: RenderLog, prefix = "") {
  let level = 2;
  const api = {
    level(value?: number) {
      if (value === undefined) return level;
      level = value;
      return api;
    },
    error(...args: unknown[]) {
      log.errors.push(prefix + join(args));
      return api;
    },
    warn(...args: unknown[]) {
      if (log.warnings.length < 30) log.warnings.push(prefix + join(args));
      return api;
    },
    info() {
      return api;
    },
    debug() {
      return api;
    },
  };
  return api;
}

/** 所有网络、文件与链接访问都拒绝；只允许 data:image 内嵌图片。 */
function blockedLoader() {
  const safe = createLoader();
  const blocked = (uri: unknown) => new Error(`已阻止外部资源：${String(uri)}。请在数据窗导入该文件后按名称引用。`);
  safe.sanitize = async (uri: string, options?: { context?: string }) => {
    if (options?.context === "image" && /^data:image\//i.test(uri)) return { href: uri };
    throw blocked(uri);
  };
  safe.load = async (uri: string) => {
    throw blocked(uri);
  };
  safe.http = async (uri: string) => {
    throw blocked(uri);
  };
  safe.file = async (uri: string) => {
    throw blocked(uri);
  };
  return safe;
}

export async function renderChart(input: {
  spec: Record<string, unknown>;
  datasets: DatasetRef[];
  rows: Map<string, Record<string, unknown>[]>;
  size: PrepareOptions;
  container: HTMLElement;
}): Promise<Rendered> {
  const log: RenderLog = { warnings: [], errors: [] };
  const prepared = prepareSpec(input.spec, input.datasets, input.rows, input.size);
  const vega = compile(prepared as unknown as TopLevelSpec, { logger: collector(log) as never }).spec as unknown as Record<
    string,
    unknown
  >;
  const view = new View(parse(vega as never, undefined, { ast: true }), {
    expr: expressionInterpreter,
    renderer: "svg",
    container: input.container,
    hover: true,
    loader: blockedLoader() as never,
    logger: collector(log) as never,
  });
  try {
    await view.runAsync();
  } catch (error) {
    view.finalize();
    throw error;
  }
  return { view, vega, log };
}

const XML = '<?xml version="1.0" encoding="UTF-8"?>\n';
export async function svgOf(view: View): Promise<string> {
  const svg = await view.toSVG();
  return svg.startsWith("<?xml") ? svg : XML + svg;
}
/** 导出 PNG；超出浏览器画布上限时自动降低倍率。 */
export async function pngOf(view: View, scale: number): Promise<{ blob: Blob; scale: number; width: number; height: number }> {
  let factor = scale;
  for (;;) {
    const canvas = (await view.toCanvas(factor)) as unknown as HTMLCanvasElement;
    if (canvas.width * canvas.height <= 60_000_000 || factor <= 1) {
      const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/png"));
      if (!blob) throw new Error("浏览器无法生成 PNG，请改用 SVG。");
      return { blob, scale: factor, width: canvas.width, height: canvas.height };
    }
    factor = Math.max(1, Math.floor(factor / 2));
  }
}
