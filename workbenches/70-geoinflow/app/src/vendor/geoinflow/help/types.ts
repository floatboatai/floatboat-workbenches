export const HELP_REVIEWED_AT = '2026-10-05';
export const helpSections = [
  { id: 'start', title: '快速入门', icon: 'globe', summary: '接入网站，确认数据，再开始分析。' },
  { id: 'metrics', title: '指标词典', icon: 'bars', summary: '查阅计算方法、数据来源与统计边界。' },
  {
    id: 'config',
    title: '配置指南',
    icon: 'settings',
    summary: '浏览采集、服务器日志、策略与权限。',
  },
  {
    id: 'crawlers',
    title: '全球蜘蛛目录',
    icon: 'bot',
    summary: '了解用途、身份核验和访问处理建议。',
  },
  { id: 'faq', title: '常见问题', icon: 'help', summary: '按现象定位原因，检查接入和策略。' },
] as const;
export type HelpSection = (typeof helpSections)[number]['id'];
export interface HelpSource {
  label: string;
  url: string;
}
export interface HelpBlock {
  title: string;
  paragraphs: string[];
  code?: { label: string; text: string; filename: string };
}
export interface HelpArticle {
  id: string;
  section: Exclude<HelpSection, 'crawlers'>;
  title: string;
  summary: string;
  keywords: string[];
  blocks: HelpBlock[];
  sources: HelpSource[];
  related: string[];
  reviewedAt: string;
  setupGuide?: boolean;
}
export type CrawlerPurpose =
  | '训练'
  | 'AI 搜索'
  | '用户触发'
  | '传统搜索'
  | '广告'
  | 'SEO 工具'
  | '研究数据'
  | '链接预览'
  | '通用抓取';
export interface Crawler {
  id: string;
  name: string;
  vendor: string;
  aliases: string[];
  purposes: CrawlerPurpose[];
  kind: 'crawler' | 'control';
  evidence: 'operator' | 'observed' | 'pending' | 'inactive';
  summary: string;
  // Examples are copied from official documentation. An absent example is explicit.
  ua?: string;
  token: string;
  robotsToken?: string;
  feeds: HelpSource[];
  verification: string;
  robots: string;
  advice: string;
  sources: HelpSource[];
  reviewedAt: string;
}
