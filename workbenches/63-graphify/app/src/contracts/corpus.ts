// ABOUTME: 资料集文件分类、路径规范化与容量；浏览器选择文件夹和服务端抽取共用同一规则。

import { sha256 } from "./hash.ts";

export type SourceKind = "code" | "document" | "text" | "config";
export type SourceFile = { path: string; text: string };
export type CorpusFile = {
  path: string;
  hash: string;
  bytes: number;
  lines: number;
  kind: SourceKind;
  language: string;
};
export type SkippedFile = { path: string; reason: string };

export const LIMITS = {
  files: 3000,
  fileBytes: 4 * 1024 * 1024,
  totalBytes: 48 * 1024 * 1024,
  pathLength: 400,
};

const LANGUAGES: Record<string, [SourceKind, string]> = {
  py: ["code", "python"],
  pyi: ["code", "python"],
  js: ["code", "javascript"],
  mjs: ["code", "javascript"],
  cjs: ["code", "javascript"],
  jsx: ["code", "javascript"],
  ts: ["code", "typescript"],
  mts: ["code", "typescript"],
  cts: ["code", "typescript"],
  tsx: ["code", "typescript"],
  vue: ["code", "javascript"],
  svelte: ["code", "javascript"],
  go: ["code", "go"],
  rs: ["code", "rust"],
  java: ["code", "java"],
  kt: ["code", "kotlin"],
  kts: ["code", "kotlin"],
  scala: ["code", "scala"],
  swift: ["code", "swift"],
  cs: ["code", "csharp"],
  c: ["code", "c"],
  h: ["code", "c"],
  cc: ["code", "cpp"],
  cpp: ["code", "cpp"],
  cxx: ["code", "cpp"],
  hpp: ["code", "cpp"],
  php: ["code", "php"],
  rb: ["code", "ruby"],
  lua: ["code", "lua"],
  dart: ["code", "dart"],
  sh: ["code", "shell"],
  bash: ["code", "shell"],
  zsh: ["code", "shell"],
  sql: ["code", "sql"],
  md: ["document", "markdown"],
  markdown: ["document", "markdown"],
  mdx: ["document", "markdown"],
  txt: ["text", "text"],
  text: ["text", "text"],
  rst: ["text", "rst"],
  org: ["text", "org"],
  adoc: ["text", "asciidoc"],
  tex: ["text", "latex"],
  csv: ["text", "csv"],
  json: ["config", "json"],
  jsonc: ["config", "json"],
  yaml: ["config", "yaml"],
  yml: ["config", "yaml"],
  toml: ["config", "toml"],
  ini: ["config", "ini"],
  cfg: ["config", "ini"],
  xml: ["config", "xml"],
  html: ["config", "html"],
  htm: ["config", "html"],
  css: ["config", "css"],
  scss: ["config", "css"],
};
const BARE: Record<string, [SourceKind, string]> = {
  readme: ["text", "text"],
  license: ["text", "text"],
  changelog: ["text", "text"],
  dockerfile: ["config", "docker"],
  makefile: ["config", "make"],
};
const IGNORED_DIRS = new Set([
  ".git", ".hg", ".svn", "node_modules", "bower_components", "dist", "build", "out", ".next",
  ".nuxt", ".turbo", ".cache", "coverage", "__pycache__", ".pytest_cache", ".mypy_cache",
  ".venv", "venv", "env", "target", ".idea", ".vscode", ".gradle", "vendor", ".local", ".DS_Store",
]);
const LOCKFILES = new Set([
  "package-lock.json", "pnpm-lock.yaml", "yarn.lock", "poetry.lock", "cargo.lock", "pipfile.lock",
  "composer.lock", "gemfile.lock", "go.sum", "uv.lock",
]);

export function normalizePath(raw: string): string {
  const parts = raw.replace(/\\/g, "/").split("/").filter((p) => p && p !== ".");
  if (!parts.length || parts.some((p) => p === ".." || p.length > 255))
    throw new Error(`文件路径无效：${raw.slice(0, 80)}`);
  const path = parts.join("/");
  if (path.length > LIMITS.pathLength) throw new Error(`文件路径过长：${path.slice(0, 80)}…`);
  return path;
}

export function extension(path: string) {
  const base = path.split("/").pop() ?? path;
  const dot = base.lastIndexOf(".");
  return dot > 0 ? base.slice(dot + 1).toLowerCase() : "";
}

/** 路径阶段（读取内容之前）判断：返回分类或跳过原因。 */
export function classifyPath(path: string): { kind: SourceKind; language: string } | { skip: string } {
  const parts = path.split("/");
  const dir = parts.slice(0, -1).find((p) => IGNORED_DIRS.has(p));
  if (dir) return { skip: `依赖或构建目录 ${dir}` };
  const base = (parts.at(-1) ?? "").toLowerCase();
  if (LOCKFILES.has(base)) return { skip: "依赖锁文件" };
  if (/\.min\.(js|css)$/.test(base) || /\.map$/.test(base)) return { skip: "压缩或映射文件" };
  if (base.startsWith(".") && !/\.(md|txt)$/.test(base)) return { skip: "隐藏文件" };
  const ext = extension(path);
  const hit = ext ? LANGUAGES[ext] : BARE[base];
  if (!hit) return { skip: ext ? `不支持的 .${ext} 文件` : "无扩展名" };
  return { kind: hit[0], language: hit[1] };
}

export const isIgnoredDirectory = (name: string) => IGNORED_DIRS.has(name);

/** 内容阶段判断：二进制与压缩代码在读取后排除。 */
export function contentProblem(text: string): string | null {
  const head = text.slice(0, 8192);
  if (head.includes("\u0000")) return "二进制内容";
  let control = 0;
  for (let i = 0; i < head.length; i++) {
    const c = head.charCodeAt(i);
    if (c < 9 || (c > 13 && c < 32)) control++;
  }
  if (head.length && control / head.length > 0.1) return "二进制内容";
  if (!text.trim()) return "空文件";
  const lines = text.split("\n");
  if (text.length > 20000 && text.length / lines.length > 600) return "单行过长（疑似压缩代码）";
  return null;
}

export function lineCount(text: string) {
  let n = 1;
  for (let i = 0; i < text.length; i++) if (text.charCodeAt(i) === 10) n++;
  return text.endsWith("\n") ? n - 1 : n;
}

export function utf8Bytes(text: string) {
  return new TextEncoder().encode(text).length;
}

export function corpusFileValue(value: unknown): CorpusFile {
  const v = value as Record<string, unknown>;
  if (
    typeof v !== "object" || v === null ||
    typeof v.path !== "string" || typeof v.hash !== "string" || !/^[0-9a-f]{64}$/.test(v.hash) ||
    typeof v.bytes !== "number" || !Number.isInteger(v.bytes) || v.bytes < 0 ||
    typeof v.lines !== "number" || !Number.isInteger(v.lines) || v.lines < 0 ||
    !["code", "document", "text", "config"].includes(String(v.kind)) ||
    typeof v.language !== "string" || v.language.length > 40
  )
    throw new Error("资料清单格式无效。");
  return {
    path: normalizePath(v.path),
    hash: v.hash,
    bytes: v.bytes,
    lines: v.lines,
    kind: v.kind as SourceKind,
    language: v.language,
  };
}

export function corpusEntry(path: string, text: string): CorpusFile {
  const c = classifyPath(path);
  if ("skip" in c) throw new Error(`${path}：${c.skip}`);
  return { path, hash: sha256(text), bytes: utf8Bytes(text), lines: lineCount(text), kind: c.kind, language: c.language };
}
