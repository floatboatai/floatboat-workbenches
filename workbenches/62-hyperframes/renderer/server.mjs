import { createJobWriter } from "./storage.mjs";
import { createServer } from "node:http";
import {
  mkdir,
  readFile,
  writeFile,
  rename,
  readdir,
  stat,
} from "node:fs/promises";
import { createReadStream, existsSync } from "node:fs";
import { spawn, execFileSync } from "node:child_process";
import { resolve, join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { movieValue, composition } from "../app/src/contracts/movie.ts";
const root = resolve(
  process.env.HYPERFRAMES_RENDER_DATA ??
    join(dirname(fileURLToPath(import.meta.url)), ".local/jobs"),
);
const cli = resolve(
  dirname(fileURLToPath(import.meta.url)),
  "node_modules/hyperframes/bin/hyperframes.mjs",
);
await mkdir(root, { recursive: true });
const jobs = new Map(),
  children = new Map();
const save = createJobWriter(root);
for (const name of await readdir(root)) {
  if (!name.endsWith(".json")) continue;
  try {
    const j = JSON.parse(await readFile(join(root, name), "utf8"));
    if (["running", "queued"].includes(j.state)) {
      j.state = "interrupted";
      j.error = "渲染进程曾中断；请核对输入后创建新任务。";
      await save(j);
    }
    jobs.set(j.id, j);
  } catch {}
}
function publicJob(j) {
  return {
    id: j.id,
    state: j.state,
    createdAt: j.createdAt,
    error: j.error ?? "",
  };
}
function ready() {
  try {
    execFileSync("ffmpeg", ["-version"], { stdio: "ignore", timeout: 3000 });
    return existsSync(cli);
  } catch {
    return false;
  }
}
async function render(j) {
  if (j.state !== "queued") return;
  const folder = join(root, j.id);
  await mkdir(folder, { recursive: true });
  await writeFile(join(folder, "index.html"), composition(j.movie));
  if (j.state !== "queued") return;
  j.state = "running";
  await save(j);
  if (j.state !== "running") return;
  const p = spawn(
    process.execPath,
    [
      cli,
      "render",
      folder,
      "--output",
      join(folder, "output.mp4"),
      "--fps",
      "24",
      "--workers",
      "1",
      "--quality",
      "draft",
      "--no-browser-gpu",
    ],
    {
      cwd: folder,
      env: { ...process.env, HYPERFRAMES_NO_TELEMETRY: "1", DO_NOT_TRACK: "1" },
      detached: process.platform !== "win32",
      stdio: ["ignore", "pipe", "pipe"],
    },
  );
  children.set(j.id, p);
  let tail = "";
  const collect = (b) => {
    tail = (tail + b.toString()).slice(-12000);
  };
  p.stdout.on("data", collect);
  p.stderr.on("data", collect);
  const stop = () => {
    try {
      process.kill(process.platform === "win32" ? p.pid : -p.pid, "SIGTERM");
    } catch {}
  };
  const timer = setTimeout(stop, 180000);
  p.on("error", async () => {
    clearTimeout(timer);
    children.delete(j.id);
    if (j.state !== "cancelled") {
      j.state = "failed";
      j.error = "渲染器未能启动，请检查Node、Chrome和FFmpeg。";
      await save(j);
    }
  });
  p.on("exit", async (code) => {
    clearTimeout(timer);
    children.delete(j.id);
    await writeFile(join(folder, "render.log"), tail);
    if (j.state === "cancelled") return;
    j.state =
      code === 0 && existsSync(join(folder, "output.mp4"))
        ? "completed"
        : "failed";
    j.error =
      j.state === "failed"
        ? "HyperFrames渲染未完成，请查看renderer数据目录中的render.log。"
        : "";
    await save(j);
  });
}
const response = (res, status, data) => {
  const b = JSON.stringify(data);
  res.writeHead(status, {
    "content-type": "application/json",
    "content-length": Buffer.byteLength(b),
  });
  res.end(b);
};
createServer(async (req, res) => {
  try {
    if (req.headers.origin) {
      response(res, 403, {
        error: "Browser access is disabled; use the workbench server.",
      });
      return;
    }
    if (
      process.env.HYPERFRAMES_RENDERER_TOKEN &&
      req.headers.authorization !==
        `Bearer ${process.env.HYPERFRAMES_RENDERER_TOKEN}`
    ) {
      response(res, 401, { error: "Unauthorized" });
      return;
    }
    const url = new URL(req.url, "http://localhost");
    if (req.method === "GET" && url.pathname === "/health") {
      response(res, 200, {
        ready: ready(),
        engine: "hyperframes",
        version: "0.8.210",
      });
      return;
    }
    if (req.method === "POST" && url.pathname === "/jobs") {
      let data = "";
      for await (const chunk of req) {
        data += chunk;
        if (Buffer.byteLength(data) > 2000000)
          throw new Error("Request too large");
      }
      const v = JSON.parse(data);
      if (typeof v.id !== "string" || !/^[0-9a-f-]{36}$/.test(v.id))
        throw new Error("Invalid id");
      const movie = movieValue(v.movie),
        old = jobs.get(v.id);
      if (old) {
        response(
          res,
          JSON.stringify(old.movie) === JSON.stringify(movie) ? 200 : 409,
          publicJob(old),
        );
        return;
      }
      if (!ready()) {
        response(res, 503, { error: "Renderer not ready" });
        return;
      }
      if (
        [...jobs.values()].filter((j) =>
          ["running", "queued"].includes(j.state),
        ).length >= 2
      ) {
        response(res, 429, { error: "Renderer busy" });
        return;
      }
      const j = {
        id: v.id,
        movie,
        state: "queued",
        createdAt: new Date().toISOString(),
        error: "",
      };
      jobs.set(j.id, j);
      await save(j);
      response(res, 202, publicJob(j));
      void render(j).catch(async () => {
        j.state = "failed";
        j.error = "渲染准备失败";
        await save(j);
      });
      return;
    }
    const match = /^\/jobs\/([0-9a-f-]{36})(?:\/(video|cancel))?$/.exec(
      url.pathname,
    );
    const j = match && jobs.get(match[1]);
    if (!j) {
      response(res, 404, { error: "Not found" });
      return;
    }
    if (req.method === "POST" && match[2] === "cancel") {
      if (["queued", "running", "interrupted"].includes(j.state)) {
        j.state = "cancelled";
        await save(j);
        const p = children.get(j.id);
        if (p) {
          try {
            process.kill(
              process.platform === "win32" ? p.pid : -p.pid,
              "SIGTERM",
            );
          } catch {}
        }
      }
      response(res, 200, publicJob(j));
      return;
    }
    if (req.method === "GET" && match[2] === "video") {
      if (j.state !== "completed") {
        response(res, 409, { error: "Video not ready" });
        return;
      }
      const file = join(root, j.id, "output.mp4"),
        s = await stat(file);
      res.writeHead(200, {
        "content-type": "video/mp4",
        "content-length": s.size,
      });
      createReadStream(file).pipe(res);
      return;
    }
    if (req.method === "GET" && !match[2]) {
      response(res, 200, publicJob(j));
      return;
    }
    response(res, 405, { error: "Method not allowed" });
  } catch (e) {
    response(res, 400, {
      error: e instanceof Error ? e.message : "Invalid request",
    });
  }
}).listen(Number(process.env.PORT ?? 8782), "127.0.0.1", () =>
  console.log(
    "HyperFrames renderer http://127.0.0.1:" + (process.env.PORT ?? 8782),
  ),
);
