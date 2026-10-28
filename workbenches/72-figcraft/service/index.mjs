import { createServer } from "node:http";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { mkdtemp, readFile, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { unzipSync } from "fflate";
import { fileURLToPath } from "node:url";
const exec = promisify(execFile),
  binary = process.env.FIGCRAFT_CLI || "figcraft-cli";
export function unpack(file) {
  if (
    typeof file !== "string" ||
    file.length > 800000 ||
    !/^[A-Za-z0-9+/]+={0,2}$/.test(file)
  )
    throw new Error("设计文件编码或容量无效。");
  const bytes = Buffer.from(file, "base64");
  const zip = unzipSync(bytes, {
    filter: (e) => {
      if (e.originalSize > 3000000) throw new Error("设计展开内容过大。");
      return e.name === "document.json";
    },
  });
  if (!zip["document.json"]) throw new Error("缺少FigCraft原生文档。");
  const doc = JSON.parse(new TextDecoder().decode(zip["document.json"]));
  if (
    doc.format !== "figcraft" ||
    doc.version !== 1 ||
    !doc.nodes ||
    typeof doc.nodes !== "object" ||
    !Array.isArray(doc.pages)
  )
    throw new Error("FigCraft文档格式无效。");
  const nodes = Object.values(doc.nodes);
  if (nodes.length > 1200 || doc.pages.length > 30)
    throw new Error("设计超过1200图层或30页。");
  for (const n of nodes)
    if (
      typeof n.id !== "number" ||
      typeof n.name !== "string" ||
      !Number.isFinite(n.width) ||
      !Number.isFinite(n.height) ||
      n.width > 6000 ||
      n.height > 6000
    )
      throw new Error("图层尺寸无效或过大。");
  return { bytes, doc };
}
export function commands(action, doc) {
  if (!action || typeof action !== "object") throw new Error("编辑请求无效。");
  const id = Number(action.id),
    node = doc.nodes[String(id)];
  if (action.kind === "rename") {
    if (
      !node ||
      typeof action.name !== "string" ||
      !action.name.trim() ||
      action.name.length > 100
    )
      throw new Error("图层名称无效。");
    return [{ command: "node.set", params: { ids: [id], name: action.name } }];
  }
  if (action.kind === "text") {
    if (
      !node ||
      node.type !== "text" ||
      typeof action.text !== "string" ||
      action.text.length > 4000
    )
      throw new Error("文字内容无效。");
    return [
      { command: "node.set", params: { ids: [id], characters: action.text } },
    ];
  }
  if (action.kind === "fill") {
    if (
      !node ||
      typeof action.color !== "string" ||
      !/^#[0-9a-f]{6}$/i.test(action.color)
    )
      throw new Error("填色无效。");
    return [{ command: "node.set", params: { ids: [id], fill: action.color } }];
  }
  if (action.kind === "status") {
    if (!node || !["none", "readyForDev", "completed"].includes(action.status))
      throw new Error("交付状态无效。");
    return [
      { command: "node.set", params: { ids: [id], devStatus: action.status } },
    ];
  }
  throw new Error("不支持的编辑操作。");
}
export async function execute(input) {
  const version = await exec(binary, ["--version"], {
    timeout: 5000,
    maxBuffer: 10000,
  });
  if (!version.stdout.includes("0.11.2"))
    throw new Error("需要FigCraft CLI 0.11.2。");
  const { bytes, doc } = unpack(input.file);
  const dir = await mkdtemp(join(tmpdir(), "figcraft-workbench-"));
  const source = join(dir, "source.figcraft"),
    out = join(dir, "edited.figcraft");
  const flags = [
    "--automation-read-root",
    dir,
    "--automation-write-root",
    dir,
    "--no-system-fonts",
  ];
  try {
    await writeFile(source, bytes);
    let current = source;
    if (input.action) {
      await writeFile(
        join(dir, "commands.json"),
        JSON.stringify(commands(input.action, doc)),
      );
      const result = await exec(
        binary,
        [
          "run",
          join(dir, "commands.json"),
          "--in",
          source,
          "--out",
          out,
          ...flags,
        ],
        { timeout: 20000, maxBuffer: 3000000 },
      );
      const lines = result.stdout
        .trim()
        .split("\n")
        .map((x) => JSON.parse(x));
      if (lines.some((x) => x.ok === false))
        throw new Error("原生引擎拒绝修改。");
      current = out;
    }
    const file = await readFile(current);
    if (file.length > 600000) throw new Error("设计文件超过600KB。");
    const actual = unpack(file.toString("base64")).doc;
    const pages = actual.pages
      .map((id) => actual.nodes[String(id)])
      .filter(Boolean);
    const frames = pages.flatMap((p) =>
      (p.children || [])
        .map((id) => actual.nodes[String(id)])
        .filter(
          (n) => n && ["frame", "component", "component_set"].includes(n.type),
        )
        .map((n) => ({
          id: n.id,
          name: n.name,
          page: p.id,
          width: n.width,
          height: n.height,
          status: typeof n.dev_status === "string" ? n.dev_status : "none",
        })),
    );
    if (!frames.length) throw new Error("文档中没有可审阅画板。");
    const selected =
      frames.find((x) => x.id === Number(input.frameId)) ?? frames[0];
    const descendants = [];
    const seen = new Set();
    function walk(id, depth) {
      if (seen.has(id) || depth > 40) throw new Error("图层层级无效。");
      seen.add(id);
      const n = actual.nodes[String(id)];
      if (!n) return;
      descendants.push({
        id: n.id,
        name: n.name,
        type: n.type,
        text: n.characters ?? "",
        depth,
        width: n.width,
        height: n.height,
      });
      for (const child of n.children || []) walk(child, depth + 1);
    }
    walk(selected.id, 0);
    const image = join(dir, "frame.png");
    await exec(
      binary,
      [
        "export",
        current,
        "--node",
        String(selected.id),
        "-o",
        image,
        "--format",
        "png",
        "--scale",
        String(Math.min(1, 1200 / Math.max(selected.width, selected.height))),
        ...flags,
      ],
      { timeout: 20000, maxBuffer: 2000000 },
    );
    const png = await readFile(image);
    if (png.length > 1500000) throw new Error("渲染结果过大。");
    let artifact;
    if (input.export) {
      if (!["svg", "png", "pdf", "fig"].includes(input.export))
        throw new Error("导出格式无效。");
      const dest = join(dir, "export." + input.export);
      await exec(
        binary,
        [
          "export",
          current,
          "--node",
          String(selected.id),
          "-o",
          dest,
          "--format",
          input.export,
          ...flags,
        ],
        { timeout: 20000, maxBuffer: 2000000 },
      );
      const content = await readFile(dest);
      if (content.length > 2000000) throw new Error("导出结果超过2MB。");
      artifact = { format: input.export, data: content.toString("base64") };
    }
    return {
      file: file.toString("base64"),
      name: actual.name,
      frames,
      selectedId: selected.id,
      layers: descendants,
      image: png.toString("base64"),
      width: selected.width,
      height: selected.height,
      engine: "figcraft-cli 0.11.2",
      ...(artifact ? { artifact } : {}),
    };
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}
let active = 0;
export function server() {
  return createServer(async (req, res) => {
    res.setHeader("content-type", "application/json");
    if (req.method === "GET" && req.url === "/health") {
      try {
        const x = await exec(binary, ["--version"], {
          timeout: 5000,
          maxBuffer: 10000,
        });
        res.end(
          JSON.stringify({
            available: x.stdout.includes("0.11.2"),
            engine: x.stdout.trim(),
          }),
        );
      } catch {
        res.statusCode = 503;
        res.end(
          JSON.stringify({
            available: false,
            error: "请安装FigCraft CLI 0.11.2并配置FIGCRAFT_CLI。",
          }),
        );
      }
      return;
    }
    if (req.method !== "POST" || req.url !== "/render") {
      res.statusCode = 404;
      res.end("{}");
      return;
    }
    if (
      process.env.FIGCRAFT_SERVICE_TOKEN &&
      req.headers.authorization !==
        "Bearer " + process.env.FIGCRAFT_SERVICE_TOKEN
    ) {
      res.statusCode = 401;
      res.end(JSON.stringify({ error: "认证失败" }));
      return;
    }
    if (active >= 2) {
      res.statusCode = 429;
      res.end(JSON.stringify({ error: "渲染队列繁忙，请稍后重试。" }));
      return;
    }
    active++;
    try {
      const chunks = [];
      let size = 0;
      for await (const chunk of req) {
        size += chunk.length;
        if (size > 1100000) throw new Error("请求过大。");
        chunks.push(chunk);
      }
      const input = JSON.parse(Buffer.concat(chunks).toString());
      res.end(JSON.stringify(await execute(input)));
    } catch (e) {
      res.statusCode = 400;
      res.end(
        JSON.stringify({
          error:
            e.code === "ENOENT"
              ? "FigCraft CLI不可用，请检查服务设置。"
              : e.killed
                ? "渲染超时，原文件已保留。"
                : String(e.message).slice(0, 250),
        }),
      );
    } finally {
      active--;
    }
  });
}
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const s = server();
  s.listen(Number(process.env.PORT || 8796), "127.0.0.1", () =>
    console.log(
      "FigCraft service: http://127.0.0.1:" + (process.env.PORT || 8796),
    ),
  );
}
