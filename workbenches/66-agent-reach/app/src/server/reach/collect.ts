// ABOUTME: 采集调度：校验渠道/动作，调用对应渠道，统一封装为 Agent-Reach schema_version:1 信封。

import { ReachError, BAD_INPUT, classify, envelope, type Attempt, type ReachItem } from "./result.ts";
import { fetchPublic } from "./net.ts";
import { githubRead, githubSearch, type Get } from "./github.ts";
import { v2exHot, v2exNode, v2exRead } from "./v2ex.ts";
import { webRead, directRead, exaSearch } from "./web.ts";
import type { Query } from "../../contracts/research.ts";
import { CHANNELS } from "../../contracts/channels.ts";

export const UPSTREAM_COMMIT = "14c213405669414492bda0f8d52cc6531d062c45";

type Run = (get: Get, query: string, attempts: Attempt[]) => Promise<{ backend: string; items: ReachItem[] }>;
const one = (backend: string, f: (get: Get, q: string) => Promise<ReachItem[]>): Run => async (get, q) => ({ backend, items: await f(get, q) });
const runners: Record<string, Record<string, Run>> = {
  github: {
    read: one("github-public-api", (g, q) => githubRead(g, q)),
    search: one("github-public-api", (g, q) => githubSearch(g, q)),
  },
  web: {
    read: (g, q, a) => webRead(g, q, a),
    fetch: one("direct-readability", (g, q) => directRead(g, q)),
    search: one("exa", (g, q) => exaSearch(g, q)),
  },
  v2ex: {
    hot: one("v2ex-api", (g) => v2exHot(g)),
    node: one("v2ex-api", (g, q) => v2exNode(g, q.trim())),
    read: one("v2ex-api", (g, q) => v2exRead(g, q)),
  },
};

export function validateQuery(input: Query) {
  const allowed = CHANNELS.find((c) => c.id === input.channel)?.actions.find((a) => a.id === input.action);
  if (!allowed || !runners[input.channel]?.[input.action])
    throw new ReachError(BAD_INPUT, "请选择已接入的公开渠道和动作");
  if (allowed.needsQuery && !input.query.trim()) throw new ReachError(BAD_INPUT, "请填写查询词或链接");
}

export async function collect(input: Query, get: Get = fetchPublic) {
  const start = Date.now(),
    attempts: Attempt[] = [];
  try {
    validateQuery(input);
    const { backend, items } = await runners[input.channel][input.action](get, input.query, attempts);
    return envelope({ channel: input.channel, action: input.action, backend, items, attempts, elapsedMs: Date.now() - start });
  } catch (e) {
    return envelope({ channel: input.channel, action: input.action, error: classify(e), attempts, elapsedMs: Date.now() - start });
  }
}
