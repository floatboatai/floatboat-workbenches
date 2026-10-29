// ABOUTME: GitHub渠道（channels/github.py）的匿名公开REST移植：仓库+README、Issue/PR+评论、仓库搜索。

import { isRecord } from "../../contracts/project.ts";
import { ReachError, BAD_INPUT, NOT_FOUND, RATE_LIMITED, UPSTREAM_BROKEN, makeItem, type ReachItem } from "./result.ts";
import { decodeText, expectOk, type FetchOptions, type FetchResult } from "./net.ts";

export type Get = (url: string, o?: FetchOptions) => Promise<FetchResult>;
const API = "https://api.github.com";
const TARGET = /^(?:https?:\/\/(?:www\.)?github\.com\/)?([\w.-]+)\/([\w.-]+?)(?:\.git)?(?:\/(?:issues|pull)\/(\d+))?\/?(?:[?#].*)?$/;
export const README_MAX_CHARS = 50_000;

export function parseTarget(target: string) {
  const m = TARGET.exec(String(target).trim());
  if (!m) throw new ReachError(BAD_INPUT, "请输入 owner/repo，或 github.com 仓库 / Issue / PR 链接");
  return { owner: m[1], repo: m[2], number: m[3] ? Number(m[3]) : null };
}

async function api(get: Get, path: string, timeoutMs: number, accept = "application/vnd.github+json") {
  // Anonymous public REST only; no gh CLI, environment token or saved config is read.
  const r = await get(API + path, {
    headers: { accept, "x-github-api-version": "2022-11-28" },
    timeoutMs,
    maxBytes: 2 * 1024 * 1024,
  });
  if (r.status === 429 || (r.status === 403 && (r.headers["x-ratelimit-remaining"] === "0" || r.headers["retry-after"])))
    throw new ReachError(RATE_LIMITED, "GitHub API 访问限额（未登录每小时60次）");
  if (r.status === 403) throw new ReachError(UPSTREAM_BROKEN, "GitHub API 拒绝了这次请求（HTTP 403），没有限额证据");
  return expectOk(r, "GitHub 来源");
}
const obj = (v: unknown): Record<string, unknown> => (isRecord(v) ? v : {});
const str = (v: unknown) => (typeof v === "string" ? v : null);

export function repoItem(repo: Record<string, unknown>, readme: string | null = null): ReachItem {
  return makeItem({
    title: repo.full_name,
    url: repo.html_url,
    author: obj(repo.owner).login,
    published_at: repo.created_at,
    text: readme ?? repo.description,
    raw: {
      description: repo.description ?? null,
      stargazers_count: repo.stargazers_count ?? null,
      forks_count: repo.forks_count ?? null,
      language: repo.language ?? null,
      topics: repo.topics ?? null,
      pushed_at: repo.pushed_at ?? null,
      open_issues_count: repo.open_issues_count ?? null,
      archived: repo.archived ?? null,
      license: str(obj(repo.license).spdx_id),
    },
  });
}

export function issueItem(issue: Record<string, unknown>, comments: unknown[]): ReachItem {
  const parts = [str(issue.body) ?? ""];
  for (const c of comments) parts.push(`\n@${str(obj(obj(c).user).login) ?? ""}: ${str(obj(c).body) ?? ""}`);
  return makeItem({
    title: issue.title,
    url: issue.html_url,
    author: obj(issue.user).login,
    published_at: issue.created_at,
    text: parts.join("\n").trim(),
    raw: {
      state: issue.state ?? null,
      labels: Array.isArray(issue.labels) ? issue.labels.map((l) => str(obj(l).name)) : [],
      comments: issue.comments ?? null,
      is_pull_request: "pull_request" in issue,
    },
  });
}

export async function githubRead(get: Get, target: string, timeoutMs = 24000): Promise<ReachItem[]> {
  const { owner, repo, number } = parseTarget(target);
  const base = `/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}`;
  if (number === null) {
    const info = obj(JSON.parse(decodeText((await api(get, base, timeoutMs / 2)).body, null)));
    let readme: string | null = null;
    try {
      const r = await api(get, base + "/readme", timeoutMs / 2, "application/vnd.github.raw");
      readme = decodeText(r.body, "utf-8").slice(0, README_MAX_CHARS);
    } catch (e) {
      if (!(e instanceof ReachError) || e.code !== NOT_FOUND) throw e;
    }
    return [repoItem(info, readme)];
  }
  const issue = obj(JSON.parse(decodeText((await api(get, `${base}/issues/${number}`, timeoutMs / 2)).body, null)));
  const comments: unknown = JSON.parse(
    decodeText((await api(get, `${base}/issues/${number}/comments?per_page=50`, timeoutMs / 2)).body, null),
  );
  return [issueItem(issue, Array.isArray(comments) ? comments : [])];
}

export async function githubSearch(get: Get, query: string, limit = 5, timeoutMs = 24000): Promise<ReachItem[]> {
  if (!query.trim()) throw new ReachError(BAD_INPUT, "请输入搜索关键词");
  const path = "/search/repositories?" + new URLSearchParams({ q: query, per_page: String(limit) });
  const data = obj(JSON.parse(decodeText((await api(get, path, timeoutMs)).body, null)));
  const items = Array.isArray(data.items) ? data.items : [];
  return items.slice(0, limit).map((r) => repoItem(obj(r)));
}
