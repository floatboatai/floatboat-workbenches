import {
  ACTIVE_CRAWLER_IDS,
  type CrawlerHttpBotId,
  type CrawlerRegistryEntry,
  type CrawlerType,
  crawlerRegistry,
  getCrawlerRegistry,
} from '../crawlers/registry.ts';

export const BOT_TYPES = ['训练', '搜索', '用户触发', '传统搜索', '其他'] as const;
export const MATCHER_VERSION = 'crawler-token-v1';
export interface BotRule {
  name: string;
  vendor: string;
  type: string;
  pattern: string;
  matchMode?: 'token' | 'literal';
  crawlerId?: string;
  aiEligible?: boolean;
}
export interface BotClassification extends BotRule {
  recognition?: 'unknown' | 'ambiguous';
  candidateIds?: CrawlerHttpBotId[];
}

// Exact original records and ordering are the migration compatibility contract.
export const LEGACY_BOT_RULES: BotRule[] = [
  { name: 'GPTBot', vendor: 'OpenAI', type: '训练', pattern: 'GPTBot' },
  { name: 'OAI-SearchBot', vendor: 'OpenAI', type: '搜索', pattern: 'OAI-SearchBot' },
  { name: 'ChatGPT-User', vendor: 'OpenAI', type: '用户触发', pattern: 'ChatGPT-User' },
  { name: 'ClaudeBot', vendor: 'Anthropic', type: '训练', pattern: 'ClaudeBot' },
  { name: 'Claude-SearchBot', vendor: 'Anthropic', type: '搜索', pattern: 'Claude-SearchBot' },
  { name: 'Claude-User', vendor: 'Anthropic', type: '用户触发', pattern: 'Claude-User' },
  { name: 'PerplexityBot', vendor: 'Perplexity', type: '搜索', pattern: 'PerplexityBot' },
  { name: 'Perplexity-User', vendor: 'Perplexity', type: '用户触发', pattern: 'Perplexity-User' },
  { name: 'Bytespider', vendor: '字节跳动', type: '训练', pattern: 'Bytespider' },
  { name: 'Googlebot', vendor: 'Google', type: '传统搜索', pattern: 'Googlebot' },
  { name: 'Baiduspider', vendor: '百度', type: '传统搜索', pattern: 'Baiduspider' },
  { name: 'bingbot', vendor: 'Microsoft', type: '传统搜索', pattern: 'bingbot' },
  { name: 'Applebot', vendor: 'Apple', type: '传统搜索', pattern: 'Applebot' },
];

const typeLabels: Record<CrawlerType, (typeof BOT_TYPES)[number]> = {
  training: '训练',
  search: '搜索',
  user: '用户触发',
  traditional_search: '传统搜索',
  other: '其他',
};

export const ALL_BOT_RULES: BotRule[] = crawlerRegistry
  .filter(entry => entry.kind === 'http_crawler' && entry.status === 'active')
  .map(entry => ({
    name: entry.name,
    vendor: entry.vendor,
    type: typeLabels[entry.type],
    pattern: entry.uaSelector!,
    matchMode: 'token',
    crawlerId: entry.id,
    aiEligible: entry.aiEligible,
  }));
export const BOT_RULES: BotRule[] = ACTIVE_CRAWLER_IDS.map(id => {
  const rule = ALL_BOT_RULES.find(entry => entry.crawlerId === id);
  if (!rule) throw new Error(`Missing active crawler rule: ${id}`);
  return { ...rule };
});

type HttpCrawler = CrawlerRegistryEntry & { kind: 'http_crawler'; uaSelector: string };
const ruleCache = new WeakMap<object, BotRule[]>();
export function getBotRules(entries: readonly CrawlerRegistryEntry[] = getCrawlerRegistry()): BotRule[] {
  let rules = ruleCache.get(entries);
  if (!rules) {
    rules = entries.filter(entry => entry.kind === 'http_crawler' && entry.status === 'active')
      .map(entry => ({ name: entry.name, vendor: entry.vendor, type: typeLabels[entry.type],
        pattern: entry.uaSelector!, matchMode: 'token', crawlerId: entry.id, aiEligible: entry.aiEligible }));
    ruleCache.set(entries, rules);
  }
  return rules;
}
/** Only internally issued IDs and canonical tokens establish a current official identity. */
export function officialCrawlerForRule(rule: Partial<BotRule>, entries: readonly CrawlerRegistryEntry[] = getCrawlerRegistry()): HttpCrawler | undefined {
  if (!rule.crawlerId || rule.matchMode !== 'token') return undefined;
  return entries.find(
    (entry): entry is HttpCrawler =>
      entry.kind === 'http_crawler' &&
      entry.status === 'active' &&
      entry.id === rule.crawlerId &&
      entry.name === rule.name &&
      entry.uaSelector === rule.pattern,
  );
}

function tokenMatches(ua: string, pattern: string) {
  if (!pattern) return false;
  const source = ua.toLowerCase();
  const needle = pattern.toLowerCase();
  let offset = source.indexOf(needle);
  while (offset !== -1) {
    const before = source[offset - 1];
    const after = source[offset + needle.length];
    if ((!before || /[\s;(,]/u.test(before)) && (!after || /[\s;),(/]/u.test(after))) return true;
    offset = source.indexOf(needle, offset + 1);
  }
  return false;
}

function unknown(candidateIds: CrawlerHttpBotId[] = []): BotClassification {
  return {
    name: '其他',
    vendor: '',
    type: '其他',
    pattern: '',
    aiEligible: false,
    recognition: candidateIds.length ? 'ambiguous' : 'unknown',
    candidateIds,
  };
}

function withoutDocumentationUrls(ua: string) {
  const runs = /[a-z0-9+.-]+/gi;
  const isUrlCharacter = (index: number) => index < ua.length && /[^\s<>"]/.test(ua[index]);
  const parts: string[] = [];
  let copiedThrough = 0;
  // Visit each possible scheme run once. Retrying a greedy scheme at every word
  // boundary makes long strings such as "a-a-a-..." take quadratic time.
  for (let run = runs.exec(ua); run; run = runs.exec(ua)) {
    const end = runs.lastIndex;
    let schemeStart = -1;
    let wwwStart = -1;
    for (let index = run.index; index < end; index++) {
      if (!/[a-z]/i.test(ua[index]) || (index > 0 && /\w/.test(ua[index - 1]))) continue;
      if (schemeStart < 0) schemeStart = index;
      if (
        wwwStart < 0 &&
        ua.slice(index, index + 4).toLowerCase() === 'www.' &&
        isUrlCharacter(index + 4)
      )
        wwwStart = index;
    }
    const hasScheme =
      schemeStart >= 0 && ua.slice(end, end + 3) === '://' && isUrlCharacter(end + 3);
    const start = hasScheme ? schemeStart : wwwStart;
    if (start < 0) continue;
    let urlEnd = hasScheme ? end + 3 : wwwStart + 4;
    while (isUrlCharacter(urlEnd)) urlEnd++;
    parts.push(ua.slice(copiedThrough, start), ' ');
    copiedThrough = urlEnd;
    runs.lastIndex = urlEnd;
  }
  return copiedThrough ? parts.join('') + ua.slice(copiedThrough) : ua;
}

export function classifyBot(ua: string, rules: readonly BotRule[] = getBotRules(), entries: readonly CrawlerRegistryEntry[] = getCrawlerRegistry()): BotClassification {
  // URLs are documentation references, separate from HTTP product tokens.
  const tokens = withoutDocumentationUrls(ua);
  const matches = rules.filter(rule =>
    rule.matchMode === 'token'
      ? tokenMatches(tokens, rule.pattern)
      : ua.toLowerCase().includes(rule.pattern.toLowerCase()),
  );
  if (!matches.length) return unknown();
  // Historical and explicit literal rules preserve the configured first-match ordering.
  if (matches[0].matchMode !== 'token') return matches[0];
  const candidates = matches.filter(rule => rule.matchMode === 'token');
  const identities = new Map(candidates.map(rule => [rule, officialCrawlerForRule(rule, entries)]));
  const specific = candidates.filter(rule => {
    const identity = identities.get(rule);
    return !identity || !candidates.some(other => identities.get(other)?.parentId === identity.id);
  });
  const unique = [
    ...new Map(
      specific.map(rule => [
        identities.get(rule)?.id || JSON.stringify([rule.name, rule.pattern, rule.type]),
        rule,
      ]),
    ).values(),
  ];
  if (unique.length === 1) return unique[0];
  const result = unknown(
    [
      ...new Set(
        unique.flatMap(rule => {
          const identity = identities.get(rule);
          return identity ? [identity.id] : [];
        }),
      ),
    ].sort(),
  );
  return { ...result, recognition: 'ambiguous' };
}
