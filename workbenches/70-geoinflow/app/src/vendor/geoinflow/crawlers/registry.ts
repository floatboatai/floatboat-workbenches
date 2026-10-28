import { getPublishedCatalog } from './published.ts';
import { crawlerMetadata } from './catalog-metadata.ts';

/** Canonical crawler identity and recognition policy; safe to import in clients. */
export type CrawlerType = 'training' | 'search' | 'user' | 'traditional_search' | 'other';
export const CRAWLER_REGISTRY_VERSION = 'crawler-registry-v2';
export type CrawlerRegistryStatus = 'active' | 'pending' | 'inactive';

export const crawlerPlatformIds = [
  'openai',
  'anthropic',
  'perplexity',
  'kimi',
  'tencent',
  'bytedance',
  'google',
  'baidu',
  'microsoft',
  'apple',
  'amazon',
  'mistral',
  'duckduckgo',
  'common-crawl',
  'ai2',
  'sogou',
  '360',
  'yandex',
  'naver',
  'seznam',
  'qwant',
  'mojeek',
  'meta',
  'ahrefs',
  'semrush',
  'majestic',
  'petal',
] as const;
export type CrawlerPlatformId = string;

function http<const Id extends string>(
  id: Id,
  name: string,
  platformId: CrawlerPlatformId,
  vendor: string,
  type: CrawlerType,
  options: {
    family?: string;
    parentId?: string;
    aiEligible?: boolean;
    status?: CrawlerRegistryStatus;
    controllable?: boolean;
    robotsToken?: string | null;
  } = {},
) {
  const metadata = crawlerMetadata.find(entry => entry.name === name);
  return {
    id,
    name,
    platformId,
    vendor,
    type,
    kind: 'http_crawler' as const,
    uaSelector: name,
    family: options.family || id,
    parentId: options.parentId || null,
    aiEligible: options.aiEligible ?? ['training', 'search', 'user'].includes(type),
    status: options.status || 'active',
    control: { remote: options.controllable === true, nginx: options.controllable === true },
    robotsToken:
      options.robotsToken !== undefined
        ? options.robotsToken
        : metadata?.evidence === 'operator'
          ? (metadata.robotsToken ?? null)
          : null,
  };
}
function purpose<const Id extends string>(
  id: Id,
  name: string,
  platformId: CrawlerPlatformId,
  vendor: string,
  type: CrawlerType,
) {
  return {
    id,
    name,
    platformId,
    vendor,
    type,
    kind: 'robots_purpose' as const,
    uaSelector: null,
    family: id,
    parentId: null,
    aiEligible: false,
    status: 'active' as const,
    control: { remote: false, nginx: false },
    robotsToken: name,
  };
}

export const crawlerRegistry = [
  http('gptbot', 'GPTBot', 'openai', 'OpenAI', 'training', { controllable: true }),
  http('oai-searchbot', 'OAI-SearchBot', 'openai', 'OpenAI', 'search', { controllable: true }),
  http('chatgpt-user', 'ChatGPT-User', 'openai', 'OpenAI', 'user', { controllable: true }),
  http('oai-adsbot', 'OAI-AdsBot', 'openai', 'OpenAI', 'other'),
  http('claudebot', 'ClaudeBot', 'anthropic', 'Anthropic', 'training', { controllable: true }),
  http('claude-searchbot', 'Claude-SearchBot', 'anthropic', 'Anthropic', 'search', {
    controllable: true,
  }),
  http('claude-user', 'Claude-User', 'anthropic', 'Anthropic', 'user', { controllable: true }),
  http('perplexitybot', 'PerplexityBot', 'perplexity', 'Perplexity', 'search', {
    controllable: true,
  }),
  http('perplexity-user', 'Perplexity-User', 'perplexity', 'Perplexity', 'user', {
    controllable: true,
  }),
  http('kimibot', 'KimiBot', 'kimi', 'Kimi', 'training'),
  http('kimi-searchbot', 'Kimi-SearchBot', 'kimi', 'Kimi', 'search'),
  http('kimi-user', 'Kimi-User', 'kimi', 'Kimi', 'user'),
  http('hyspider', 'HySpider', 'tencent', 'Tencent', 'training'),
  http('amazonbot', 'Amazonbot', 'amazon', 'Amazon', 'training'),
  http('amzn-searchbot', 'Amzn-SearchBot', 'amazon', 'Amazon', 'search'),
  http('amzn-user', 'Amzn-User', 'amazon', 'Amazon', 'user'),
  http('mistralai-user', 'MistralAI-User', 'mistral', 'Mistral AI', 'user'),
  http('mistralai-index', 'MistralAI-Index', 'mistral', 'Mistral AI', 'search'),
  http('mistralai-training', 'MistralAI-Training', 'mistral', 'Mistral AI', 'training'),
  http('googlebot', 'Googlebot', 'google', 'Google', 'traditional_search', { controllable: true }),
  http('googlebot-image', 'Googlebot-Image', 'google', 'Google', 'traditional_search', {
    family: 'googlebot',
    parentId: 'googlebot',
  }),
  http('googlebot-video', 'Googlebot-Video', 'google', 'Google', 'traditional_search', {
    family: 'googlebot',
    parentId: 'googlebot',
  }),
  http('googleother', 'GoogleOther', 'google', 'Google', 'other'),
  http('googleother-image', 'GoogleOther-Image', 'google', 'Google', 'other', {
    family: 'googleother',
    parentId: 'googleother',
  }),
  http('googleother-video', 'GoogleOther-Video', 'google', 'Google', 'other', {
    family: 'googleother',
    parentId: 'googleother',
  }),
  http('storebot-google', 'Storebot-Google', 'google', 'Google', 'traditional_search'),
  http('google-inspectiontool', 'Google-InspectionTool', 'google', 'Google', 'user', {
    aiEligible: false,
  }),
  http('google-cloudvertexbot', 'Google-CloudVertexBot', 'google', 'Google', 'other'),
  purpose('google-extended', 'Google-Extended', 'google', 'Google', 'training'),
  purpose('googlebot-news', 'Googlebot-News', 'google', 'Google', 'traditional_search'),
  http('applebot', 'Applebot', 'apple', 'Apple', 'traditional_search', { controllable: true }),
  purpose('applebot-extended', 'Applebot-Extended', 'apple', 'Apple', 'training'),
  http('bingbot', 'bingbot', 'microsoft', 'Microsoft', 'traditional_search', {
    controllable: true,
  }),
  http('duckduckbot', 'DuckDuckBot', 'duckduckgo', 'DuckDuckGo', 'traditional_search'),
  http('duckassistbot', 'DuckAssistBot', 'duckduckgo', 'DuckDuckGo', 'search'),
  http('ccbot', 'CCBot', 'common-crawl', 'Common Crawl', 'other'),
  http('ai2bot', 'AI2Bot', 'ai2', 'Ai2', 'training'),
  http('baiduspider', 'Baiduspider', 'baidu', '百度', 'traditional_search', { controllable: true }),
  http('baiduspider-render', 'Baiduspider-render', 'baidu', '百度', 'traditional_search', {
    family: 'baiduspider',
    parentId: 'baiduspider',
  }),
  http('sogou-web-spider', 'Sogou web spider', 'sogou', '搜狗', 'traditional_search'),
  http('sogou-inst-spider', 'Sogou inst spider', 'sogou', '搜狗', 'traditional_search'),
  http('360spider', '360Spider', '360', '360', 'traditional_search'),
  http('yandexbot', 'YandexBot', 'yandex', 'Yandex', 'traditional_search'),
  http('yeti', 'Yeti', 'naver', 'Naver', 'traditional_search'),
  http('ads-naver', 'Ads-Naver', 'naver', 'Naver', 'other'),
  http('blueno', 'Blueno', 'naver', 'Naver', 'other'),
  http('seznambot', 'SeznamBot', 'seznam', 'Seznam', 'traditional_search'),
  http('freshbot', 'FreshBot', 'seznam', 'Seznam', 'traditional_search'),
  http('qwantbot', 'Qwantbot', 'qwant', 'Qwant', 'traditional_search'),
  http('qwantbot-news', 'Qwantbot-news', 'qwant', 'Qwant', 'traditional_search', {
    family: 'qwantbot',
    parentId: 'qwantbot',
  }),
  http('mojeekbot', 'MojeekBot', 'mojeek', 'Mojeek', 'traditional_search'),
  http('meta-externalagent', 'Meta-ExternalAgent', 'meta', 'Meta', 'training', {
    robotsToken: null,
  }),
  http('meta-externalfetcher', 'Meta-ExternalFetcher', 'meta', 'Meta', 'user', {
    robotsToken: null,
  }),
  http('facebookbot', 'FacebookBot', 'meta', 'Meta', 'training', { robotsToken: null }),
  http('bytespider', 'Bytespider', 'bytedance', '字节跳动', 'training', { controllable: true }),
  http('ahrefsbot', 'AhrefsBot', 'ahrefs', 'Ahrefs', 'other'),
  http('ahrefssiteaudit', 'AhrefsSiteAudit', 'ahrefs', 'Ahrefs', 'other'),
  http('semrushbot', 'SemrushBot', 'semrush', 'Semrush', 'other'),
  http('siteauditbot', 'SiteAuditBot', 'semrush', 'Semrush', 'other'),
  http('mj12bot', 'MJ12bot', 'majestic', 'Majestic', 'other'),
  http('petalbot', 'PetalBot', 'petal', 'Petal Search', 'traditional_search', {
    status: 'pending',
    robotsToken: null,
  }),
] as const;

export interface CrawlerRegistryEntry {
  id: string;
  name: string;
  platformId: string;
  vendor: string;
  type: CrawlerType;
  kind: 'http_crawler' | 'robots_purpose' | 'signed_agent';
  uaSelector?: string | null;
  family: string;
  parentId?: string | null;
  aiEligible: boolean;
  status: CrawlerRegistryStatus;
  control: { remote: boolean; nginx: boolean };
  robotsToken?: string | null;
}
export type CrawlerBotId = string;
export type CrawlerHttpBotId = string;

/** Every operation reads the complete version bound at its entry point. */
export function getCrawlerRegistry(): readonly CrawlerRegistryEntry[] {
  return getPublishedCatalog()?.payload.identities ?? crawlerRegistry;
}
export const getCrawlerPlatformIds = (): string[] =>
  getPublishedCatalog()?.payload.platforms.map(platform => platform.id) ?? [...crawlerPlatformIds];
export const getActiveCrawlerIds = (): string[] => getCrawlerRegistry()
  .filter(entry => entry.kind !== 'robots_purpose' && entry.status === 'active')
  .map(entry => entry.id);
export const getCrawlerRobotsIds = (): string[] => getCrawlerRegistry()
  .filter(entry => entry.status === 'active' && entry.robotsToken !== null)
  .map(entry => entry.id);

// Existing policy targets stay fixed while recognition expands independently.
export const crawlerControllableBotIds = [
  'gptbot',
  'oai-searchbot',
  'chatgpt-user',
  'claudebot',
  'claude-searchbot',
  'claude-user',
  'perplexitybot',
  'perplexity-user',
  'bytespider',
  'googlebot',
  'baiduspider',
  'bingbot',
  'applebot',
] as const satisfies readonly CrawlerHttpBotId[];
export const INITIAL_CRAWLER_IDS = crawlerControllableBotIds;
export const ALL_HTTP_CRAWLER_IDS = crawlerRegistry
  .filter(entry => entry.kind === 'http_crawler' && entry.status === 'active')
  .map(entry => entry.id as CrawlerHttpBotId);

// Recognition follows the reviewed HTTP catalog; control targets remain independently scoped.
export const ACTIVE_CRAWLER_IDS: readonly CrawlerHttpBotId[] = ALL_HTTP_CRAWLER_IDS;
export const crawlerHttpBotIds = ACTIVE_CRAWLER_IDS;
export const crawlerBotIds = crawlerRegistry.map(entry => entry.id);
export const crawlerRobotsBotIds: readonly string[] = crawlerRegistry
  .filter(entry => entry.status === 'active' && entry.robotsToken !== null)
  .map(entry => entry.id);
