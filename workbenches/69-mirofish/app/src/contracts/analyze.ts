// ABOUTME: 导入的 MiroFish 原生动作分析：精确的活动统计与透明的词典立场估计，产出与本地推演同形的结果。
import { lexiconScore } from "./lexicon.ts";
import { fingerprint, round3 } from "./random.ts";
import { clamp } from "./scenario.ts";
import type { Action } from "./simulation.ts";
import { stats, type RoundMetric, type SimResult } from "./engine.ts";

/** Imported MiroFish actions: activity is exact; stance is a transparent lexicon estimate per author. */
export function analyzeActions(actions: Action[]): SimResult {
  // Native agent ids are shared by the Twitter and Reddit logs of one simulation.
  const byId = new Map<number, { id: number; name: string; i: number }>();
  for (const a of actions)
    if (!byId.has(a.agent_id)) byId.set(a.agent_id, { id: a.agent_id, name: a.agent_name || "角色 " + a.agent_id, i: byId.size });
  const list = [...byId.values()];
  const est = list.map(() => 0);
  const seen = list.map(() => false);
  const stat = list.map(() => ({ posts: 0, received: 0 }));
  const sorted = actions.map((a, i) => [a, i] as const).sort((x, y) => x[0].round_num - y[0].round_num || x[1] - y[1]).map(([a]) => a);
  const maxRound = sorted.reduce((m, a) => Math.max(m, a.round_num), 0);
  const trajectories = list.map(() => [0]);
  const rounds: RoundMetric[] = [];
  const actionStance: number[] = [];
  const pushRound = (round: number, counts: { posts: number; comments: number; likes: number; reposts: number; active: Set<number> }) => {
    const values = est.filter((_, i) => seen[i]);
    rounds.push({ round, time: "", ...stats(values.length ? values : [0]), posts: counts.posts, comments: counts.comments, likes: counts.likes, reposts: counts.reposts, active: counts.active.size, byType: {} });
  };
  pushRound(0, { posts: 0, comments: 0, likes: 0, reposts: 0, active: new Set() });
  let cursor = 0;
  for (let round = 1; round <= Math.max(1, maxRound); round++) {
    const counts = { posts: 0, comments: 0, likes: 0, reposts: 0, active: new Set<number>() };
    let time = "";
    while (cursor < sorted.length && sorted[cursor].round_num <= round) {
      const a = sorted[cursor++];
      const who = byId.get(a.agent_id)!;
      counts.active.add(who.i);
      time = a.timestamp || time;
      const text = ["content", "quote_content", "text"].map((k) => a.action_args[k]).find((v) => typeof v === "string") as string | undefined;
      if (text) {
        const { score, hits } = lexiconScore(text);
        if (hits) est[who.i] = clamp(est[who.i] * 0.6 + score * 1.5 * 0.4);
        seen[who.i] = true;
      }
      if (/POST$/.test(a.action_type) && a.action_type.startsWith("CREATE")) {
        counts.posts++;
        stat[who.i].posts++;
      } else if (/COMMENT|QUOTE/.test(a.action_type)) counts.comments++;
      else if (/LIKE/.test(a.action_type)) counts.likes++;
      else if (/REPOST/.test(a.action_type)) counts.reposts++;
      actionStance.push(round3(est[who.i]));
    }
    list.forEach((_, i) => trajectories[i].push(round3(est[i])));
    pushRound(round, counts);
    rounds[rounds.length - 1].time = time;
  }
  const result: SimResult = {
    kind: "import",
    engine: "mirofish-native",
    fingerprint: "",
    stanceKind: "lexicon",
    actions: sorted,
    actionStance,
    rounds,
    trajectories,
    agents: list.map((x, i) => ({ id: x.id, name: x.name, type: "", start: 0, end: round3(est[i]), posts: stat[i].posts, received: stat[i].received, followers: 0 })),
    events: [],
    truncated: false,
  };
  result.fingerprint = fingerprint(JSON.stringify(sorted));
  return result;
}
