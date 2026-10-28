import { createHash, randomUUID } from "node:crypto";
import { readFile, writeFile, rename, unlink } from "node:fs/promises";
import type { WorkbenchServer } from "../../sdk/runtime.mjs";
import { isRecord, boundedText } from "../contracts/project.ts";
import {
  identifier,
  integer,
  indexValue,
  CHUNK,
  MAX_PDF,
  type DocumentIndex,
  type DocumentRef,
} from "../contracts/reader.ts";
export const digest = (value: Uint8Array) =>
  createHash("sha256").update(value).digest("hex");
function serviceUrl(): string {
  const value = new URL(
    process.env.PAGEINDEX_SERVICE_URL ?? "http://127.0.0.1:8784",
  );
  if (
    value.username ||
    value.password ||
    value.search ||
    value.hash ||
    (value.protocol !== "https:" &&
      !(
        value.protocol === "http:" &&
        ["127.0.0.1", "localhost", "[::1]"].includes(value.hostname)
      ))
  )
    throw new Error("PageIndex服务地址需为本机HTTP或远程HTTPS。");
  return value.href.replace(/\/$/, "");
}
async function service(path: string, input?: unknown): Promise<Response> {
  let response: Response;
  try {
    response = await fetch(serviceUrl() + path, {
      method: input === undefined ? "GET" : "POST",
      redirect: "error",
      headers: { "content-type": "application/json" },
      body: input === undefined ? undefined : JSON.stringify(input),
      signal: AbortSignal.timeout(path === "/health" ? 3000 : 90000),
    });
  } catch {
    throw new Error("PageIndex解析服务未连接或请求超时，请启动服务后重试。");
  }
  if (!response.ok) {
    await response.body?.cancel();
    throw new Error(
      `PDF处理未完成（服务状态${response.status}），请检查文档或稍后重试。`,
    );
  }
  return response;
}
async function bounded(response: Response, max: number): Promise<Uint8Array> {
  if (!response.body) throw new Error("服务未返回内容。");
  const reader = response.body.getReader(),
    parts: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.length;
      if (size > max) throw new Error("服务响应超过容量。");
      parts.push(value);
    }
  } catch (e) {
    await reader.cancel().catch(() => {});
    throw e;
  }
  return Buffer.concat(parts);
}
export function createDocuments(app: WorkbenchServer) {
  const db = app.database,
    path = (name: string, write = false) =>
      app.resources.path("documents", name, write ? "write" : undefined);
  const pending = new Map<string, Promise<DocumentIndex>>();
  function get(id: string): DocumentIndex {
    const row = db
      .prepare("SELECT payload FROM reader_documents WHERE id=?")
      .get(identifier(id));
    if (!row) throw new Error("文档索引尚未完成，请重新上传原PDF。");
    return indexValue(JSON.parse(String(row.payload)));
  }
  const read = async (id: string) =>
    readFile(await path(`${identifier(id)}.pdf`));
  async function build(id: string, name: string, bytes: Uint8Array) {
    if (
      digest(bytes) !== identifier(id) ||
      !Buffer.from(bytes).subarray(0, 5).equals(Buffer.from("%PDF-"))
    )
      throw new Error("PDF内容校验失败。");
    const found = db
      .prepare("SELECT id FROM reader_documents WHERE id=?")
      .get(id);
    if (found) {
      const old = get(id);
      if (digest(await read(id)) !== id)
        throw new Error("已保存原文件损坏，请检查数据目录。");
      return old;
    }
    const response: unknown = JSON.parse(
      new TextDecoder().decode(
        await bounded(
          await service("/index", {
            pdf: Buffer.from(bytes).toString("base64"),
          }),
          1800000,
        ),
      ),
    );
    if (
      !isRecord(response) ||
      response.engine !== "pageindex" ||
      response.sha256 !== id ||
      !Array.isArray(response.pages)
    )
      throw new Error("解析结果与上传文档不一致。");
    const value = indexValue({
      source: { id, name, bytes: bytes.length, pages: response.pages.length },
      engineVersion: response.version,
      index: response.index,
      pages: response.pages,
    });
    const temp = await path(`${id}.${randomUUID()}.tmp`, true);
    try {
      await writeFile(temp, bytes, { flag: "wx" });
      await rename(temp, await path(`${id}.pdf`, true));
    } finally {
      await unlink(temp).catch(() => {});
    }
    db.prepare(
      "INSERT OR IGNORE INTO reader_documents(id,payload,created_at) VALUES(?,?,?)",
    ).run(id, JSON.stringify(value), new Date().toISOString());
    return get(id);
  }
  return {
    get,
    read,
    async health() {
      const r: unknown = JSON.parse(
        new TextDecoder().decode(
          await bounded(await service("/health"), 10000),
        ),
      );
      if (!isRecord(r) || r.service !== "floatboat-pageindex")
        throw new Error("解析服务身份不匹配。");
      return { available: true, version: r.version };
    },
    async chunk(id: string, index: number, raw: unknown) {
      identifier(id);
      integer(index, 0, Math.ceil(MAX_PDF / CHUNK) - 1);
      if (typeof raw !== "string" || raw.length > Math.ceil(CHUNK / 3) * 4)
        throw new Error("PDF分块超过容量。");
      const bytes = Buffer.from(raw, "base64");
      if (
        !bytes.length ||
        bytes.length > CHUNK ||
        bytes.toString("base64") !== raw
      )
        throw new Error("PDF分块编码无效。");
      if (!db.prepare("SELECT id FROM reader_documents WHERE id=?").get(id))
        await writeFile(await path(`${id}.${index}.part`, true), bytes);
      return { ok: true };
    },
    async finish(id: string, input: unknown) {
      identifier(id);
      if (!isRecord(input)) throw new Error("文件信息无效。");
      const bytes = integer(input.bytes, 1, MAX_PDF),
        name = boundedText(input.name, 180);
      if (db.prepare("SELECT id FROM reader_documents WHERE id=?").get(id)) {
        const known = get(id);
        if (known.source.bytes !== bytes || digest(await read(id)) !== id)
          throw new Error("已存文档与上传信息不一致。");
        return known;
      }
      if (pending.has(id)) return pending.get(id)!;
      const task = (async () => {
        const parts: Buffer[] = [];
        for (let i = 0; i < Math.ceil(bytes / CHUNK); i++) {
          const part = await readFile(await path(`${id}.${i}.part`));
          if (part.length !== Math.min(CHUNK, bytes - i * CHUNK))
            throw new Error("PDF尚未完整上传。");
          parts.push(part);
        }
        const result = await build(id, name, Buffer.concat(parts));
        await Promise.all(
          parts.map((_, i) =>
            path(`${id}.${i}.part`, true).then((p) =>
              unlink(p).catch(() => {}),
            ),
          ),
        );
        return result;
      })();
      pending.set(id, task);
      try {
        return await task;
      } finally {
        pending.delete(id);
      }
    },
    async sample() {
      const bytes = await readFile(
        await app.resources.path("samples", "handbook.pdf"),
      );
      return build(digest(bytes), "Harbor Workshop Handbook.pdf", bytes);
    },
    async verify(ref: DocumentRef | null) {
      if (!ref) return;
      const stored = get(ref.id);
      if (
        stored.source.bytes !== ref.bytes ||
        stored.source.pages !== ref.pages ||
        digest(await read(ref.id)) !== ref.id
      )
        throw new Error("项目原文件缺失或不匹配，请导入完整项目。");
    },
    async render(id: string, page: number) {
      const doc = get(id);
      integer(page, 1, doc.source.pages);
      return bounded(
        await service("/render", {
          pdf: (await read(id)).toString("base64"),
          page,
        }),
        5000000,
      );
    },
  };
}
