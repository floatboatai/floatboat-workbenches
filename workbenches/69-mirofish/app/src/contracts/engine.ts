// ABOUTME: 本地群体推演引擎：有界信任意见动力学＋推荐流＋事件注入，可复现种子，输出 MiroFish 原生动作格式。
import { fingerprint, rng, round3, type Rng } from "./random.ts";
import { clamp, type Agent, type Platform, type RunSummary, type SimInput } from "./scenario.ts";
import type { Action } from "./simulation.ts";

export const ENGINE_VERSION = "mirofish-local-1";
export type RoundMetric = {
  round: number;
  time: string;
  mean: number;
  sd: number;
  support: number;
  neutral: number;
  oppose: number;
  polarization: number;
  posts: number;
  comments: number;
  likes: number;
  reposts: number;
  active: number;
  byType: Record<string, number>;
};
export type AgentStat = {
  id: number;
  name: string;
  type: string;
  start: number;
  end: number;
  posts: number;
  received: number;
  followers: number;
};
export type EventLog = {
  round: number;
  id: string;
  title: string;
  affected: number;
  before: number;
  after: number;
};
export type SimResult = {
  kind: "local" | "import";
  engine: string;
  fingerprint: string;
  stanceKind: "model" | "lexicon";
  actions: Action[];
  /** Stance of the acting agent when the action happened (model) or lexicon estimate (import). */
  actionStance: number[];
  rounds: RoundMetric[];
  /** trajectories[i][r]: stance of agents[i] after round r (r=0 is the initial state). */
  trajectories: number[][];
  agents: AgentStat[];
  events: EventLog[];
  truncated: boolean;
};
const MAX_ACTIONS = 80_000;

type Post = {
  id: number;
  platform: Platform;
  author: number;
  round: number;
  stance: number;
  content: string;
  likes: number;
  dislikes: number;
  reposts: number;
  comments: number;
};

function hourMultiplier(h: number) {
  if (h <= 5) return 0.05;
  if (h <= 8) return 0.4;
  if (h <= 18) return 0.7;
  if (h <= 22) return 1.5;
  return 0.5;
}
function clock(start: string, minutes: number) {
  const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/.exec(start);
  const base = m ? Date.UTC(+m[1], +m[2] - 1, +m[3], +m[4], +m[5]) : Date.UTC(2027, 2, 1, 8);
  const d = new Date(base + minutes * 60_000);
  return { iso: d.toISOString().slice(0, 19), hour: d.getUTCHours() };
}

type Voice = { topic: string; pos: string[]; neg: string[] };
const fill = (t: string, map: Record<string, string>) => t.replace(/\{(\w+)\}/g, (_, k) => map[k] ?? "");
const BANDS: Record<string, string[]> = {
  "2": [
    "{topic}早该推进了，{pos}是实打实的好处。",
    "支持{topic}。{pos}这件事，大家等了很多年。",
    "说句公道话，{topic}对{pos}有帮助，细节可以边做边调。",
    "身边不少人担心{neg}，但我看了方案，配套是有的，支持先干起来。",
  ],
  "1": [
    "{topic}方向我认可，但希望{neg}方面的配套能跟上。",
    "看了方案，{pos}的改善值得期待，先试试看。",
    "原则上支持{topic}，过渡期能再长一点就更好了。",
  ],
  "0": [
    "{topic}到底会怎样，{pos}和{neg}都得看实际执行。",
    "还在观望，想先看看{neg}的具体数据。",
    "有没有人说说{topic}对自己的影响大不大？",
    "两边说的都有道理，关键是{neg}怎么解决。",
  ],
  "-1": [
    "不是反对{topic}，是担心{neg}没人兜底。",
    "{neg}的问题不解决，{topic}很难让人放心。",
    "方案写得很好，可{neg}这一块说得太含糊了。",
  ],
  "-2": [
    "反对这种一刀切的{topic}，{neg}谁来负责？",
    "{topic}这么搞，{neg}首当其冲，坚决反对。",
    "联名反对{topic}！{neg}的损失已经看得见了。",
    "又是拍脑袋的决定，{neg}根本没有算进去。",
  ],
};
const OFFICIAL: Record<string, string[]> = {
  pos: [
    "关于{topic}：将同步推进{pos}相关配套措施，欢迎市民通过热线反馈意见。",
    "{topic}试行方案已吸收各方意见，{pos}相关安排将分阶段落实。",
  ],
  mid: [
    "针对{neg}的集中关切，我们正在研究豁免与过渡安排，最终以正式公告为准。",
    "{topic}仍处于征求意见阶段，请以官方渠道发布的信息为准。",
  ],
  neg: [
    "{topic}的实施时间将根据评估结果审慎研究，{neg}问题需先行解决。",
  ],
};
const REPLY = {
  agree: ["同意，{pos}确实是关键。", "说到点子上了。", "+1，希望有关部门能看到。", "我身边也是这个情况。"],
  disagree: ["不太认同，{neg}也得算进去。", "这个说法太片面了。", "数据从哪来的？别带节奏。", "站着说话不腰疼，{neg}你考虑过吗？"],
};
function band(s: number) {
  return s > 0.5 ? "2" : s > 0.15 ? "1" : s >= -0.15 ? "0" : s >= -0.5 ? "-1" : "-2";
}
function compose(r: Rng, agent: Agent, stance: number, voice: Voice, recentEvent: string) {
  const own = agent.topics.length ? agent.topics : [];
  const posOwn = own.filter((t) => voice.pos.includes(t)),
    negOwn = own.filter((t) => voice.neg.includes(t));
  const map = {
    topic: voice.topic,
    pos: r.pick(posOwn.length ? posOwn : voice.pos),
    neg: r.pick(negOwn.length ? negOwn : voice.neg),
    name: agent.name,
  };
  let body: string;
  if (agent.type === "政府机构") {
    body = `【${agent.name}】` + fill(r.pick(stance > 0.2 ? OFFICIAL.pos : stance < -0.3 ? OFFICIAL.neg : OFFICIAL.mid), map);
  } else if (agent.type === "媒体") {
    const quote = fill(r.pick(BANDS[band(stance * 0.8 + r.normal() * 0.35)]), map);
    body = `#${voice.topic}# 记者走访发现，有受访者表示：“${quote}”`;
  } else if (agent.type === "学术机构") {
    body = `【研究简报】从测算看，${map.pos}有望改善，但${map.neg}存在不确定性。${stance >= 0 ? "建议按期试行并公开评估数据。" : "建议先补充评估再定实施时间。"}`;
  } else {
    body = fill(r.pick(BANDS[band(stance)]), map);
    if (agent.type === "社会组织" || agent.type === "企业") body = `代表${agent.name.replace(/·.*$/, "")}说两句：` + body;
  }
  if (recentEvent && r.chance(0.35)) body = `看到“${recentEvent}”，` + body;
  return body;
}

export function stats(values: number[]) {
  const n = values.length || 1;
  const mean = values.reduce((a, b) => a + b, 0) / n;
  const sd = Math.sqrt(values.reduce((a, b) => a + (b - mean) ** 2, 0) / n);
  const support = values.filter((v) => v > 0.2).length / n;
  const oppose = values.filter((v) => v < -0.2).length / n;
  return {
    mean: round3(mean),
    sd: round3(sd),
    support: round3(support),
    oppose: round3(oppose),
    neutral: round3(1 - support - oppose),
    polarization: round3(4 * support * oppose),
  };
}

export function simulate(input: SimInput): SimResult {
  const { params, agents } = input;
  const r = rng(params.seed + "|" + ENGINE_VERSION);
  const n = agents.length;
  const index = new Map(agents.map((a, i) => [a.id, i]));
  const stance = agents.map((a) => a.stance);
  const following = agents.map(() => new Set<number>());
  for (const [a, b] of input.edges) {
    const i = index.get(a);
    if (i !== undefined) following[i].add(b);
  }
  const maxInfluence = Math.max(0.1, ...agents.map((a) => a.influence));
  const voice: Voice = {
    topic: input.topic.trim() || "这项安排",
    pos: input.aspects.filter((a) => a.lean > 0).map((a) => a.label),
    neg: input.aspects.filter((a) => a.lean < 0).map((a) => a.label),
  };
  if (!voice.pos.length) voice.pos = ["长远影响"];
  if (!voice.neg.length) voice.neg = ["执行细节"];
  const platforms: Platform[] = params.platform === "parallel" ? ["twitter", "reddit"] : [params.platform];
  const posts: Post[] = [];
  const postById = new Map<number, Post>();
  const actions: Action[] = [];
  const actionStance: number[] = [];
  const stat = agents.map((a) => ({ posts: 0, received: 0, followers: 0, id: a.id }));
  for (const f of following) for (const b of f) {
    const j = index.get(b);
    if (j !== undefined) stat[j].followers++;
  }
  const trajectories = agents.map((a) => [round3(a.stance)]);
  const rounds: RoundMetric[] = [];
  const eventLog: EventLog[] = [];
  const typeMeans = () => {
    const sums: Record<string, [number, number]> = {};
    agents.forEach((a, i) => {
      const s = (sums[a.type] ??= [0, 0]);
      s[0] += stance[i];
      s[1]++;
    });
    return Object.fromEntries(Object.entries(sums).map(([k, [s, c]]) => [k, round3(s / c)]));
  };
  rounds.push({
    round: 0,
    time: clock(params.start, 0).iso,
    ...stats(stance),
    posts: 0,
    comments: 0,
    likes: 0,
    reposts: 0,
    active: 0,
    byType: typeMeans(),
  });
  let nextPost = 1;
  let truncated = false;
  let lastEvent = { title: "", round: -10 };
  const record = (i: number, round: number, minute: number, platform: Platform, type: string, args: Record<string, unknown>, result: unknown = null) => {
    if (actions.length >= MAX_ACTIONS) {
      truncated = true;
      return false;
    }
    actions.push({
      round_num: round,
      timestamp: clock(params.start, (round - 1) * params.minutesPerRound + minute).iso,
      platform,
      agent_id: agents[i].id,
      agent_name: agents[i].name,
      action_type: type,
      action_args: args,
      result,
      success: true,
    });
    actionStance.push(round3(stance[i]));
    return true;
  };
  const createPost = (i: number, round: number, minute: number, platform: Platform, content: string, boost = 0) => {
    const post: Post = { id: nextPost++, platform, author: i, round, stance: stance[i], content, likes: boost, dislikes: 0, reposts: 0, comments: 0 };
    if (!record(i, round, minute, platform, "CREATE_POST", { content }, { post_id: post.id })) return null;
    posts.push(post);
    postById.set(post.id, post);
    stat[i].posts++;
    return post;
  };

  for (let round = 1; round <= params.rounds && !truncated; round++) {
    const { hour } = clock(params.start, (round - 1) * params.minutesPerRound);
    const mult = hourMultiplier(hour);
    const counts = { posts: 0, comments: 0, likes: 0, reposts: 0, active: 0 };
    for (const ev of input.events.filter((e) => e.round === round)) {
      const before = stats(stance).mean;
      let affected = 0;
      agents.forEach((a, i) => {
        const hit = ev.target === "all" || ev.target === "type:" + a.type || ev.target === "entity:" + a.entityId;
        if (hit && r.chance(ev.reach)) {
          stance[i] = clamp(stance[i] + ev.push * (1 - a.stubbornness * 0.7));
          affected++;
        }
      });
      const author = ev.author === null ? undefined : index.get(ev.author);
      if (author !== undefined)
        for (const p of platforms)
          if (agents[author].platform === "both" || agents[author].platform === p) {
            createPost(author, round, 0, p, `【${ev.title}】${ev.text}`.slice(0, 600), 6);
            counts.posts++;
          }
      eventLog.push({ round, id: ev.id, title: ev.title, affected, before, after: stats(stance).mean });
      lastEvent = { title: ev.title, round };
    }
    const order = r.shuffle(agents.map((_, i) => i));
    for (const i of order) {
      const a = agents[i];
      const p = Math.min(0.95, a.activity * mult * (a.activeHours.includes(hour) ? 1 : 0.3));
      if (!r.chance(p)) continue;
      counts.active++;
      const minute = Math.min(params.minutesPerRound - 1, r.int(params.minutesPerRound));
      const usable = platforms.filter((pl) => a.platform === "both" || a.platform === pl);
      if (!usable.length) continue;
      const platform = r.pick(usable);
      // Recommendation feed: recency, popularity, follow relevance, echo-chamber bias.
      const feed = posts
        .filter((post) => post.platform === platform && post.author !== i && post.round >= round - 3)
        .map((post) => {
          const pop = post.likes + 2 * post.reposts + post.comments;
          const followed = following[i].has(agents[post.author].id);
          let score = 0.4 * (1 - (round - post.round) / 4) + 0.3 * (pop / (pop + 5)) + 0.3 * (followed ? 1 : 0.15);
          score *= 1 - (params.echoChamber * Math.abs(stance[i] - post.stance)) / 2;
          return { post, score: score + r.next() * 0.05 };
        })
        .sort((x, y) => y.score - x.score)
        .slice(0, params.feedSize)
        .map((x) => x.post);
      // Bounded-confidence (Deffuant) assimilation with a backfire term for distant views.
      for (const post of feed) {
        const d = post.stance - stance[i];
        const w = params.influenceRate * (0.2 + (0.8 * agents[post.author].influence) / maxInfluence) * (1 - a.stubbornness);
        if (Math.abs(d) < params.confidence) stance[i] += w * d;
        else if (Math.abs(d) > params.confidence + 0.5) stance[i] -= params.backfire * w * Math.sign(d) * 0.5;
      }
      stance[i] = clamp(stance[i] + r.normal() * params.noise);
      const close = feed.filter((post) => Math.abs(post.stance - stance[i]) < params.confidence);
      const far = feed.filter((post) => Math.abs(post.stance - stance[i]) >= params.confidence);
      const opts: Array<[string, number]> = [["post", a.activity * 0.45 * (1 + Math.abs(stance[i]))], ["idle", 0.12]];
      if (platform === "twitter") {
        if (close.length) opts.push(["like", 0.32], ["repost", 0.14]);
        if (feed.length) opts.push(["quote", 0.1]);
        if (close.some((post) => !following[i].has(agents[post.author].id))) opts.push(["follow", 0.06]);
      } else {
        if (feed.length) opts.push(["comment", 0.3]);
        if (close.length) opts.push(["like", 0.24]);
        if (far.length) opts.push(["dislike", 0.12]);
      }
      const total = opts.reduce((s, [, w]) => s + w, 0);
      let pickW = r.next() * total,
        choice = "idle";
      for (const [name, w] of opts) {
        if ((pickW -= w) <= 0) {
          choice = name;
          break;
        }
      }
      const event = round - lastEvent.round <= 3 ? lastEvent.title : "";
      const target = (pool: Post[]) => pool[r.int(pool.length)];
      if (choice === "post") {
        if (createPost(i, round, minute, platform, compose(r, a, stance[i], voice, event))) counts.posts++;
      } else if (choice === "like" || choice === "dislike") {
        const post = target(choice === "like" ? close : far);
        if (choice === "like") post.likes++;
        else post.dislikes++;
        stat[post.author].received++;
        if (record(i, round, minute, platform, choice === "like" ? "LIKE_POST" : "DISLIKE_POST", { post_id: post.id, post_author_name: agents[post.author].name, post_content: post.content.slice(0, 80) })) counts.likes++;
      } else if (choice === "repost") {
        const post = target(close);
        post.reposts++;
        stat[post.author].received++;
        if (record(i, round, minute, platform, "REPOST", { post_id: post.id, original_author_name: agents[post.author].name, original_content: post.content.slice(0, 80) })) counts.reposts++;
      } else if (choice === "comment" || choice === "quote") {
        const post = target(feed);
        const agree = Math.abs(post.stance - stance[i]) < params.confidence;
        const reply = fill(r.pick(agree ? REPLY.agree : REPLY.disagree), {
          pos: r.pick(voice.pos),
          neg: r.pick(voice.neg),
        });
        post.comments++;
        stat[post.author].received++;
        const ok =
          choice === "comment"
            ? record(i, round, minute, platform, "CREATE_COMMENT", { post_id: post.id, content: reply, post_author_name: agents[post.author].name })
            : record(i, round, minute, platform, "QUOTE_POST", { quoted_id: post.id, quote_content: reply, original_content: post.content.slice(0, 80) });
        if (ok) counts.comments++;
      } else if (choice === "follow") {
        const post = close.find((x) => !following[i].has(agents[x.author].id));
        if (post) {
          following[i].add(agents[post.author].id);
          stat[post.author].followers++;
          record(i, round, minute, platform, "FOLLOW", { followee_id: agents[post.author].id, followee_name: agents[post.author].name });
        }
      }
    }
    agents.forEach((_, i) => trajectories[i].push(round3(stance[i])));
    rounds.push({
      round,
      time: clock(params.start, round * params.minutesPerRound).iso,
      ...stats(stance),
      ...counts,
      byType: typeMeans(),
    });
  }
  const order = actions.map((a, i) => [a, i] as const).sort((x, y) => x[0].round_num - y[0].round_num || x[0].timestamp.localeCompare(y[0].timestamp) || x[1] - y[1]);
  const sortedActions = order.map(([a]) => a),
    sortedStance = order.map(([, i]) => actionStance[i]);
  const result: SimResult = {
    kind: "local",
    engine: ENGINE_VERSION,
    fingerprint: "",
    stanceKind: "model",
    actions: sortedActions,
    actionStance: sortedStance,
    rounds,
    trajectories,
    agents: agents.map((a, i) => ({
      id: a.id,
      name: a.name,
      type: a.type,
      start: round3(a.stance),
      end: round3(stance[i]),
      posts: stat[i].posts,
      received: stat[i].received,
      followers: stat[i].followers,
    })),
    events: eventLog,
    truncated,
  };
  result.fingerprint = fingerprint(JSON.stringify([result.actions, result.rounds, result.trajectories]));
  return result;
}

export function summarize(result: SimResult): RunSummary {
  const first = result.rounds[0],
    last = result.rounds[result.rounds.length - 1] ?? first;
  return {
    rounds: Math.max(0, result.rounds.length - 1),
    agents: result.agents.length,
    actions: result.actions.length,
    posts: result.actions.filter((a) => a.action_type === "CREATE_POST").length,
    startMean: first?.mean ?? 0,
    endMean: last?.mean ?? 0,
    endSupport: last?.support ?? 0,
    endNeutral: last?.neutral ?? 1,
    endOppose: last?.oppose ?? 0,
    polarization: last?.polarization ?? 0,
    stanceKind: result.stanceKind,
  };
}
export function robustness(input: SimInput, count = 5) {
  const seeds = Array.from({ length: count }, (_, k) => `${input.params.seed}·${k + 1}`);
  const runs = seeds.map((seed) => summarize(simulate({ ...input, params: { ...input.params, seed } })));
  return {
    seeds,
    endSupport: runs.map((s) => s.endSupport),
    endOppose: runs.map((s) => s.endOppose),
    endMean: runs.map((s) => s.endMean),
  };
}
