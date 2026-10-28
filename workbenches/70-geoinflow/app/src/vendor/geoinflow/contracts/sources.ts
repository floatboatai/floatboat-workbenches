import { getPublishedCatalog } from '../crawlers/published.ts';
import coverage from '../coverage.json' with { type: 'json' };
export const getAiReferralRules = () => (getPublishedCatalog()?.payload.referrals ?? coverage.referrals)
  .filter(rule => rule.enabled && rule.kind === 'ai');
export function referralForHost(host: string) {
  return getAiReferralRules().find(rule => host === rule.host || (rule.includeSubdomains && host.endsWith(`.${rule.host}`)));
}
export function referralPlatformName(rule: ReturnType<typeof getAiReferralRules>[number]) {
  const payload = getPublishedCatalog()?.payload;
  const fallback:Record<string,string>={openai:'ChatGPT',anthropic:'Claude',perplexity:'Perplexity',bytedance:'豆包',google:'Gemini',microsoft:'Copilot',baidu:'文心一言',kimi:'Kimi'};
  return (payload?.products ?? coverage.products).find(p=>p.id===rule.productId)?.name || fallback[rule.platformId] || (payload?.platforms ?? coverage.platforms).find(p=>p.id===rule.platformId)?.name || rule.platformId;
}
const traditionalPlatformHosts = { google: ['google.com','google.com.hk','google.cn'], microsoft: ['bing.com'], baidu: ['baidu.com'], sogou: ['sogou.com'], '360': ['so.com'], duckduckgo: ['duckduckgo.com'] };
export function platformSupportsReferralRatio(id: string) {
  return !Object.hasOwn(traditionalPlatformHosts, id) && getAiReferralRules().some(rule => rule.platformId === id);
}
export function platformForReferral(host: string) {
  const ai = referralForHost(host);
  if (ai) return { id: ai.platformId, ratio: platformSupportsReferralRatio(ai.platformId) };
  const traditional = Object.entries(traditionalPlatformHosts).find(([, hosts]) => hosts.some(domain => host === domain || host.endsWith(`.${domain}`)));
  return traditional ? { id: traditional[0], ratio: false } : undefined;
}
export function platformHasReferrals(id: string) {
  return Object.hasOwn(traditionalPlatformHosts, id) || getAiReferralRules().some(rule => rule.platformId === id);
}
export type EntrySource = {
  utmSource?: string | null;
  utmMedium?: string | null;
  utmCampaign?: string | null;
  referrer?: string | null;
};
type Channel = 'AI 搜索引荐' | '传统搜索' | '其他引荐' | '直接访问';
export const aiAliases = {
  chatgpt: 'chatgpt.com',
  openai: 'chat.openai.com',
  perplexity: 'perplexity.ai',
  claude: 'claude.ai',
  gemini: 'gemini.google.com',
  copilot: 'copilot.microsoft.com',
  doubao: 'doubao.com',
  kimi: 'kimi.com',
  'kimi.moonshot.cn': 'kimi.moonshot.cn',
  yiyan: 'yiyan.baidu.com',
  deepseek: 'deepseek.com',
};
export const searchAliases = {
  google: 'google.com',
  'google.com.hk': 'google.com.hk',
  'google.cn': 'google.cn',
  bing: 'bing.com',
  baidu: 'baidu.com',
  sogou: 'sogou.com',
  '360': 'so.com',
  so: 'so.com',
  duckduckgo: 'duckduckgo.com',
  yahoo: 'yahoo.com',
};
export const nonSearchMedia = new Set([
  'email',
  'e-mail',
  'newsletter',
  'sms',
  'social',
  'paid_social',
  'paid-social',
  'display',
  'affiliate',
  'push',
  'banner',
]);
const domains = (host: string, values: string[]) =>
  values.some(domain => host === domain || host.endsWith(`.${domain}`));
const domainChannel = (host: string): Channel =>
  referralForHost(host)
    ? 'AI 搜索引荐'
    : domains(host, Object.values(searchAliases))
      ? '传统搜索'
      : '其他引荐';

export function classifyEntrySource(entry: EntrySource): { source: string; channel: Channel } {
  const source = entry.utmSource?.trim() || '';
  const medium = entry.utmMedium?.trim().toLowerCase() || '';
  const normalized = source.toLowerCase();
  // Only explicit aliases and approved domains identify a platform. Unknown UTM values stay visible.
  const canonical =
    (getAiReferralRules().find(rule => rule.aliases.some(alias => alias.toLowerCase() === normalized))?.host || '') ||
    (Object.hasOwn(searchAliases, normalized) ? searchAliases[normalized as keyof typeof searchAliases] : '') ||
    source;
  if (source || medium)
    return {
      source: canonical || `UTM / ${medium}`,
      channel:
        nonSearchMedia.has(medium) || !source ? '其他引荐' : domainChannel(canonical.toLowerCase()),
    };
  // A campaign name alone carries no channel evidence; preserve it for inspection and use Referer.
  const referrer = entry.referrer?.trim().toLowerCase() || '';
  return referrer && referrer !== '直接访问'
    ? { source: referrer, channel: domainChannel(referrer) }
    : { source: '直接访问', channel: '直接访问' };
}

/** Display ownership comes from the original entry fields, including same-named raw values. */
export function classifyEntrySourceForDisplay(entry: EntrySource) {
  const attribution = classifyEntrySource(entry);
  const sourceLabel: 'direct' | undefined =
    !entry.utmSource?.trim() && !entry.utmMedium?.trim() && !entry.referrer?.trim()
      ? 'direct'
      : undefined;
  return { ...attribution, ...(sourceLabel ? { sourceLabel } : {}) };
}
