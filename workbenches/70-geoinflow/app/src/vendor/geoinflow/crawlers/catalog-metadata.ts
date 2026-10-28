import {
  type Crawler,
  type CrawlerPurpose,
  HELP_REVIEWED_AT,
  type HelpSource,
} from '../help/types.ts';

type Vendor = {
  name: string;
  sources: HelpSource[];
  verification: string;
  robots: string;
  advice?: string;
  evidence?: Crawler['evidence'];
};
type Entry = [
  name: string,
  purposes: CrawlerPurpose[],
  summary: string,
  options?: Partial<Crawler>,
];
const officialExamples: Record<string, string> = {
  'ChatGPT-User':
    'Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko); compatible; ChatGPT-User/1.0; +https://openai.com/bot',
  'OAI-AdsBot':
    'Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko); compatible; OAI-AdsBot/1.0; +https://openai.com/adsbot',
  PerplexityBot:
    'Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko; compatible; PerplexityBot/1.0; +https://perplexity.ai/perplexitybot)',
  'Perplexity-User':
    'Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko; compatible; Perplexity-User/1.0; +https://perplexity.ai/perplexity-user)',
  KimiBot:
    'Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko); compatible; KimiBot/1.0; +https://www.kimi.com/policies/kimi-crawlers',
  'Kimi-SearchBot':
    'Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko); compatible; Kimi-SearchBot/1.0; +https://www.kimi.com/policies/kimi-crawlers',
  'Kimi-User':
    'Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko); compatible; Kimi-User/1.0; +https://www.kimi.com/policies/kimi-crawlers',
  HySpider:
    'Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko); compatible; HySpider/1.0; +https://hy.tencent.com/polices/hy-crawlers',
  Amazonbot:
    'Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko; compatible; Amazonbot/0.1) Chrome/W.X.Y.Z Safari/537.36',
  'Amzn-User':
    'Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko; compatible; Amzn-User/0.1) Chrome/W.X.Y.Z Safari/537.36',
  'MistralAI-User':
    'Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko; compatible; MistralAI-User/1.0; +https://docs.mistral.ai/robots)',
  'MistralAI-Index':
    'Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko; compatible; MistralAI-Index/1.0; +https://docs.mistral.ai/robots)',
  'MistralAI-Training':
    'Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko; compatible; MistralAI-Training/1.0; +https://docs.mistral.ai/robots)',
  'Googlebot-Image': 'Googlebot-Image/1.0',
  'Googlebot-Video': 'Googlebot-Video/1.0',
  'GoogleOther-Image': 'GoogleOther-Image/1.0',
  'GoogleOther-Video': 'GoogleOther-Video/1.0',
  'Google-InspectionTool': 'Mozilla/5.0 (compatible; Google-InspectionTool/1.0)',
  Applebot:
    'Mozilla/5.0 (Device; OS_version) AppleWebKit/WebKit_version (KHTML, like Gecko)Version/Safari_version [Mobile/Mobile_version] Safari/WebKit_version (Applebot/Applebot_version; +http://www.apple.com/go/applebot)',
  DuckAssistBot: 'DuckAssistBot/1.2; (+http://duckduckgo.com/duckassistbot.html)',
};
const source = (label: string, url: string): HelpSource => ({ label, url });
const trainingAdvice =
  '按内容授权目标决定训练抓取；通过 robots 表达偏好，对敏感内容使用认证与源站/WAF。先检查用途与身份，再设置频率。';
const searchAdvice =
  '公开搜索内容通常需要保持可访问。核验身份后设置合理频率，对敏感路径单独保护，调整后检查搜索收录与日志。';
const userAdvice =
  '用户请求与训练抓取分别设置策略。检查是否支持 robots；保留合理的真实用户访问，对高成本路径限速并观察错误。';
function vendor(v: Vendor, entries: Entry[]): Crawler[] {
  return entries.map(([name, purposes, summary, options = {}]) => ({
    id: name.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
    name,
    vendor: v.name,
    aliases: [],
    purposes,
    kind: 'crawler',
    ua: officialExamples[name],
    evidence: v.evidence || 'operator',
    summary,
    token: name,
    robotsToken: name,
    feeds: [],
    verification: v.verification,
    robots: v.robots,
    advice:
      v.advice ||
      (purposes.includes('用户触发')
        ? userAdvice
        : purposes.includes('训练')
          ? trainingAdvice
          : searchAdvice),
    sources: v.sources,
    reviewedAt: HELP_REVIEWED_AT,
    ...options,
  }));
}
const officialRange =
  '将官方 CIDR 与 UA 一并核对，区分 IPv4/IPv6 和适用 crawler。保存公开来源与时间；过期或历史请求应复核对应时间范围。';
const noFeed =
  '本次已核实资料未提供可直接使用的固定 IP 范围。按官方说明与实际请求证据复核，避免依据整段云厂商 IP 放行。';
const googleCommon = source(
  'Google common crawlers IP 范围',
  'https://developers.google.com/static/crawling/ipranges/common-crawlers.json',
);
const claudeFeed = source('Anthropic 官方共享范围', 'https://claude.com/crawling/bots.json');
const cloudflare = source(
  'Cloudflare：AI bots 观察目录',
  'https://developers.cloudflare.com/ai-crawl-control/reference/bots/',
);

export const crawlerMetadata: Crawler[] = [
  ...vendor(
    {
      name: 'OpenAI',
      sources: [
        source('OpenAI：Overview of crawlers', 'https://developers.openai.com/api/docs/bots'),
      ],
      verification: officialRange,
      robots:
        'GPTBot、OAI-SearchBot 和 OAI-AdsBot 用途独立。ChatGPT-User 来自用户操作，可能忽略 robots.txt。',
    },
    [
      [
        'GPTBot',
        ['训练'],
        '用于改进模型的自动抓取。',
        {
          feeds: [source('GPTBot IP 范围', 'https://openai.com/gptbot.json')],
          ua: 'Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko); compatible; GPTBot/1.4; +https://openai.com/gptbot',
        },
      ],
      [
        'OAI-SearchBot',
        ['AI 搜索'],
        '用于 ChatGPT 搜索发现和展示网页。',
        { feeds: [source('OAI-SearchBot IP 范围', 'https://openai.com/searchbot.json')] },
      ],
      [
        'ChatGPT-User',
        ['用户触发'],
        '用户或 GPT 发起的页面访问。',
        { feeds: [source('ChatGPT-User IP 范围', 'https://openai.com/chatgpt-user.json')] },
      ],
      [
        'OAI-AdsBot',
        ['广告'],
        '检查广告落地页与广告内容。',
        { feeds: [source('OAI-AdsBot IP 范围', 'https://openai.com/adsbot.json')] },
      ],
    ],
  ),
  ...vendor(
    {
      name: 'Anthropic',
      sources: [
        source(
          'Anthropic：Crawler 与站长控制',
          'https://support.claude.com/en/articles/8896518-does-anthropic-crawl-data-from-the-web-and-how-can-site-owners-block-the-crawler',
        ),
      ],
      verification:
        '官方 bots.json 提供共享 IP 范围，地址族以 feed 为准，需结合具体 UA 判断用途。' +
        officialRange,
      robots:
        '分别支持 ClaudeBot、Claude-SearchBot、Claude-User 的 robots 指令，并支持 Crawl-delay。',
    },
    [
      ['ClaudeBot', ['训练'], '为模型改进收集网页资料。', { feeds: [claudeFeed] }],
      ['Claude-SearchBot', ['AI 搜索'], '为 Claude 搜索收集网页资料。', { feeds: [claudeFeed] }],
      ['Claude-User', ['用户触发'], '为 Claude 用户请求获取网页。', { feeds: [claudeFeed] }],
    ],
  ),
  ...vendor(
    {
      name: 'Perplexity',
      sources: [
        source(
          'Perplexity：Crawlers',
          'https://docs.perplexity.ai/docs/resources/perplexity-crawlers',
        ),
      ],
      verification: officialRange,
      robots:
        'PerplexityBot 遵循 robots；Perplexity-User 为用户触发，通常忽略 robots。官方文档中的 feed 域名可能调整，使用前核对重定向与来源。',
    },
    [
      [
        'PerplexityBot',
        ['AI 搜索'],
        '用于搜索发现，官方说明该 crawler 用途不含基础模型训练。',
        {
          feeds: [source('PerplexityBot IP 范围', 'https://www.perplexity.ai/perplexitybot.json')],
        },
      ],
      [
        'Perplexity-User',
        ['用户触发'],
        '响应用户操作实时获取网页。',
        {
          feeds: [
            source('Perplexity-User IP 范围', 'https://www.perplexity.ai/perplexity-user.json'),
          ],
        },
      ],
    ],
  ),
  ...vendor(
    {
      name: 'Kimi',
      sources: [source('Kimi：爬虫说明', 'https://www.kimi.ai/policies/kimi-crawlers')],
      verification:
        '分别核对 KimiBot、Kimi-SearchBot、Kimi-User 的官方 feed、准确 UA 与可信来源 IP。三者地址可能重合，IP 范围仅用于佐证 UA 身份；来源和快照独立保存。',
      robots:
        '各 token 用途独立，支持按子域名设置 robots 与 Crawl-delay。Kimi-User 由用户操作触发，robots.txt 规则可能不直接适用。',
    },
    [
      [
        'KimiBot',
        ['训练'],
        '抓取可能用于训练 Kimi 基础模型的网页内容。',
        {
          feeds: [source('KimiBot IP 范围', 'https://www.kimi.ai/policies/kimibot.json')],
          reviewedAt: '2026-10-21',
        },
      ],
      [
        'Kimi-SearchBot',
        ['AI 搜索'],
        '分析网页相关性并建立 Kimi 搜索索引。',
        {
          feeds: [
            source('Kimi-SearchBot IP 范围', 'https://www.kimi.ai/policies/kimi-searchbot.json'),
          ],
          reviewedAt: '2026-10-21',
        },
      ],
      [
        'Kimi-User',
        ['用户触发'],
        '响应 Kimi 用户操作获取文章或实时网页资料。',
        {
          feeds: [source('Kimi-User IP 范围', 'https://www.kimi.ai/policies/kimi-user.json')],
          reviewedAt: '2026-10-21',
        },
      ],
    ],
  ),
  ...vendor(
    {
      name: 'Tencent',
      sources: [source('腾讯混元：Hy 爬虫说明', 'https://hy.tencent.com/polices/hy-crawlers')],
      verification: officialRange,
      robots:
        'HySpider 支持按子域名设置 robots 与 Crawl-delay。官方 IP 范围会动态变化，核验应使用对应时间的快照。',
    },
    [
      [
        'HySpider',
        ['训练'],
        '抓取可能用于训练腾讯混元基础模型的网页内容。',
        {
          feeds: [source('HySpider IP 范围', 'https://hy.tencent.com/policy/hyspider.json')],
          reviewedAt: '2026-10-21',
        },
      ],
    ],
  ),
  ...vendor(
    {
      name: 'Amazon',
      sources: [source('Amazon：Amazonbot', 'https://developer.amazon.com/amazonbot')],
      verification: officialRange,
      robots:
        '各 token 用途分别控制；Amazon 不支持 Crawl-delay，Amzn-User 用户操作可能忽略 robots。',
    },
    [
      [
        'Amazonbot',
        ['训练', '通用抓取'],
        '用于 Amazon 产品与模型改进的自动抓取。',
        {
          feeds: [
            source('Amazonbot IP 范围', 'https://developer.amazon.com/amazonbot/ip-addresses/'),
          ],
        },
      ],
      [
        'Amzn-SearchBot',
        ['AI 搜索'],
        '用于 Amazon 搜索发现。',
        {
          feeds: [
            source(
              'Amzn-SearchBot IP 范围',
              'https://developer.amazon.com/amazonbot/searchbot-ip-addresses/',
            ),
          ],
        },
      ],
      [
        'Amzn-User',
        ['用户触发'],
        '实时响应用户操作。',
        {
          feeds: [
            source(
              'Amzn-User IP 范围',
              'https://developer.amazon.com/amazonbot/live-ip-addresses/',
            ),
          ],
        },
      ],
    ],
  ),
  ...vendor(
    {
      name: 'Mistral AI',
      sources: [source('Mistral：Robots', 'https://docs.mistral.ai/robots')],
      verification: officialRange,
      robots: '按 Mistral 官方 robots 文档分别设置用户获取、索引与训练 token。使用前核对适用场景。',
    },
    [
      [
        'MistralAI-User',
        ['用户触发'],
        '为用户请求实时获取页面。',
        { feeds: [source('MistralAI-User IP 范围', 'https://mistral.ai/mistralai-user-ips.json')] },
      ],
      [
        'MistralAI-Index',
        ['AI 搜索'],
        '为搜索索引获取网页。',
        {
          feeds: [source('MistralAI-Index IP 范围', 'https://mistral.ai/mistralai-index-ips.json')],
        },
      ],
      ['MistralAI-Training', ['训练'], '用于训练资料收集。', { verification: noFeed }],
    ],
  ),
  ...vendor(
    {
      name: 'Google',
      sources: [
        source(
          'Google：Common crawlers',
          'https://developers.google.com/crawling/docs/crawlers-fetchers/google-common-crawlers',
        ),
        source(
          'Google：Verify requests',
          'https://developers.google.com/crawling/docs/crawlers-fetchers/verify-google-requests',
        ),
      ],
      verification:
        '按 common / special / user-triggered 类别选择官方范围；或对官方规定的 .googlebot.com、.google.com 等域名执行双向 DNS 验证。common 范围仅适用于 common 类别。',
      robots:
        '支持对应 crawler 的 robots 指令。索引控制参考 noindex 文档；Google-Extended 与 Googlebot-News 是独立用途控制标记。',
    },
    [
      [
        'Googlebot',
        ['传统搜索'],
        'Google 搜索的主要网页 crawler，包括手机与桌面形态。',
        {
          feeds: [googleCommon],
          ua: 'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)',
          aliases: ['Googlebot Smartphone', 'Googlebot Desktop'],
        },
      ],
      ['Googlebot-Image', ['传统搜索'], 'Google 图片索引。', { feeds: [googleCommon] }],
      ['Googlebot-Video', ['传统搜索'], 'Google 视频索引。', { feeds: [googleCommon] }],
      ['GoogleOther', ['通用抓取'], 'Google 产品团队的通用 crawler。', { feeds: [googleCommon] }],
      [
        'GoogleOther-Image',
        ['通用抓取'],
        'GoogleOther 的图片资源获取。',
        { feeds: [googleCommon] },
      ],
      [
        'GoogleOther-Video',
        ['通用抓取'],
        'GoogleOther 的视频资源获取。',
        { feeds: [googleCommon] },
      ],
      [
        'Storebot-Google',
        ['传统搜索'],
        'Google Shopping 页面与商品信息抓取。',
        { feeds: [googleCommon] },
      ],
      [
        'Google-InspectionTool',
        ['用户触发'],
        'Google 测试与检查工具使用的 UA。',
        { feeds: [googleCommon] },
      ],
      [
        'Google-CloudVertexBot',
        ['AI 搜索'],
        'Vertex AI 相关客户配置的网页获取。',
        { feeds: [googleCommon] },
      ],
      [
        'Google-Extended',
        ['训练', 'AI 搜索'],
        '控制 Gemini 训练及部分 grounding 用途；官方说明该标记不影响 Google Search 收录与排名。',
        {
          kind: 'control',
          token: '',
          verification: '没有独立 HTTP UA 或专属请求 IP。通过 robots 用途标记设置策略。',
          robots: 'robots token 为 Google-Extended。',
        },
      ],
      [
        'Googlebot-News',
        ['传统搜索'],
        'Google News 收录用途的 robots 控制标记。',
        {
          kind: 'control',
          token: '',
          verification: '没有独立 HTTP UA。实际访问使用 Googlebot 等相应 crawler 的身份。',
          robots: 'robots token 为 Googlebot-News。',
        },
      ],
    ],
  ),
  ...vendor(
    {
      name: 'Apple',
      sources: [source('Apple：About Applebot', 'https://support.apple.com/en-us/119829')],
      verification:
        '使用官方范围，或反向域名 .applebot.apple.com 并正向解析回原 IP。' + officialRange,
      robots:
        'Applebot 抓取与 Applebot-Extended 模型训练使用分别控制；仅限制 Extended 时仍可允许搜索相关用途。',
    },
    [
      [
        'Applebot',
        ['传统搜索', '训练'],
        '支持 Apple 搜索产品，并可能用于模型训练。',
        { feeds: [source('Applebot IP 范围', 'https://search.developer.apple.com/applebot.json')] },
      ],
      [
        'Applebot-Extended',
        ['训练'],
        '控制 Apple 使用已抓取资料训练基础模型的用途。',
        {
          kind: 'control',
          token: '',
          verification: '用途控制标记，没有独立 crawler UA 与 IP。',
          robots: 'robots token 为 Applebot-Extended。',
        },
      ],
    ],
  ),
  ...vendor(
    {
      name: 'Microsoft',
      sources: [
        source(
          'Bing：Which crawlers does Bing use?',
          'https://www.bing.com/webmasters/help/help/which-crawlers-does-bing-use-8c184ec0',
        ),
        source(
          'Bing：Verify Bingbot',
          'https://www.bing.com/webmasters/help/Verify-Bingbot-2195837f',
        ),
      ],
      verification:
        '核对官方 bingbot 范围，或对 .search.msn.com 执行反向加正向 DNS 验证，亦可使用官方验证工具。',
      robots: '按 bingbot 指令配置，并参考 Bing 官方索引控制说明。',
    },
    [
      [
        'bingbot',
        ['传统搜索'],
        'Bing 网页搜索 crawler。',
        {
          feeds: [source('Bingbot IP 范围', 'https://www.bing.com/toolbox/bingbot.json')],
          ua: 'Mozilla/5.0 (compatible; bingbot/2.0; +http://www.bing.com/bingbot.htm)',
          aliases: ['BingBot'],
        },
      ],
    ],
  ),
  ...vendor(
    {
      name: 'DuckDuckGo',
      sources: [
        source(
          'DuckDuckGo：DuckDuckBot',
          'https://duckduckgo.com/duckduckgo-help-pages/results/duckduckbot',
        ),
        source(
          'DuckDuckGo：DuckAssistBot',
          'https://duckduckgo.com/duckduckgo-help-pages/results/duckassistbot',
        ),
      ],
      verification: officialRange,
      robots: '遵循对应 robots token。DuckAssistBot 的停止抓取变更可能需要最多 72 小时。',
    },
    [
      [
        'DuckDuckBot',
        ['传统搜索'],
        'DuckDuckGo 搜索 crawler。',
        { feeds: [source('DuckDuckBot IP 范围', 'https://duckduckgo.com/duckduckbot.json')] },
      ],
      [
        'DuckAssistBot',
        ['AI 搜索'],
        '为 AI 答案实时获取资料，官方说明该用途不含模型训练。',
        { feeds: [source('DuckAssistBot IP 范围', 'https://duckduckgo.com/duckassistbot.json')] },
      ],
    ],
  ),
  ...vendor(
    {
      name: 'Common Crawl',
      sources: [source('Common Crawl：CCBot', 'https://commoncrawl.org/ccbot')],
      verification:
        '优先使用官方 feed。反向 DNS 验证支持 IPv4，官方说明 IPv6 存在限制；按相应地址族核对。',
      robots: '支持 robots.txt 与 Crawl-delay。',
      advice: '资料可进入公开研究数据并被下游用于训练。按内容授权目标设置抓取偏好与敏感路径边界。',
    },
    [
      [
        'CCBot',
        ['研究数据', '训练'],
        '收集公开网络数据集，供研究及模型开发使用。',
        {
          feeds: [source('CCBot IP 范围', 'https://index.commoncrawl.org/ccbot.json')],
          ua: 'CCBot/2.0 (https://commoncrawl.org/faq/)',
        },
      ],
    ],
  ),
  ...vendor(
    {
      name: 'Ai2',
      sources: [source('Allen Institute for AI：Crawler', 'https://allenai.org/crawler')],
      verification: noFeed,
      robots: '按 AI2Bot token 和官方 crawler 页面配置抓取偏好。',
    },
    [
      [
        'AI2Bot',
        ['训练', '研究数据'],
        '收集训练开放语言模型所需的公开网页。',
        { ua: 'Mozilla/5.0 (compatible) AI2Bot (+https://www.allenai.org/crawler)' },
      ],
    ],
  ),
  ...vendor(
    {
      name: '百度',
      sources: [
        source(
          '百度搜索资源平台：Baiduspider',
          'https://ziyuan.baidu.com/college/articleinfo?id=335',
        ),
      ],
      verification:
        '按官方规则反查 .baidu.com 或 .baidu.jp，并正向解析包含原 IP。官方不建议仅依赖固定 IP 列表。',
      robots: '按 Baiduspider 规则设置 robots，检查是否影响公开页面收录。',
    },
    [
      [
        'Baiduspider',
        ['传统搜索'],
        '百度网页搜索抓取。',
        {
          ua: 'Mozilla/5.0 (compatible; Baiduspider/2.0; +http://www.baidu.com/search/spider.html)',
        },
      ],
      ['Baiduspider-render', ['传统搜索'], '百度页面渲染抓取标记。'],
    ],
  ),
  ...vendor(
    {
      name: '搜狗',
      sources: [source('搜狗：Spider 帮助', 'https://help.sogou.com/spider.html')],
      verification: noFeed,
      robots: '根据官方蜘蛛 token 配置 robots。',
    },
    [
      [
        'Sogou web spider',
        ['传统搜索'],
        '搜狗网页搜索抓取。',
        {
          ua: 'Sogou web spider/4.0(+http://www.sogou.com/docs/help/webmasters.htm#07)',
          aliases: ['Sogou spider'],
          robotsToken: 'Sogou web spider',
        },
      ],
      [
        'Sogou inst spider',
        ['传统搜索'],
        '搜狗实时更新抓取。',
        { ua: 'Sogou inst spider/4.0(+http://www.sogou.com/docs/help/webmasters.htm#07)' },
      ],
    ],
  ),
  ...vendor(
    {
      name: '360',
      sources: [
        source('360：Spider IP 信息', 'https://www.so.com/help/spider_ip.html'),
        source('360：robots 帮助', 'https://www.so.com/help/help_3_2.html'),
      ],
      verification:
        '从官方页面读取当前 Spider IP 列表并核对，保存更新时间；本版未随附该页面的范围快照。',
      robots: '按 360Spider token 配置。',
    },
    [['360Spider', ['传统搜索'], '360 搜索网页 crawler。']],
  ),
  ...vendor(
    {
      name: 'Yandex',
      sources: [
        source(
          'Yandex：Check robots',
          'https://yandex.com/support/webmaster/en/robot-workings/check-yandex-robots',
        ),
        source(
          'Yandex：IP check',
          'https://yandex.com/support/webmaster/en/indexing-options/ip-check',
        ),
      ],
      verification:
        '根据官方规则核对反向域名并正向解析确认原 IP。Yandex Cloud 归属不能单独提供 crawler 身份证据。',
      robots: '参考 Yandex 官方 robots 指令与具体 crawler token。',
    },
    [['YandexBot', ['传统搜索'], 'Yandex 网页搜索 crawler。']],
  ),
  ...vendor(
    {
      name: 'Naver',
      sources: [
        source(
          'Naver Search Advisor：Firewall',
          'https://searchadvisor.naver.com/guide/seo-basic-firewall',
        ),
      ],
      verification: '检查反向域名 .naver.com 并正向解析回原 IP；使用完整后缀边界。',
      robots: '分别核对 Yeti、Ads-Naver 与 Blueno 的用途及适用 robots 规则。',
    },
    [
      ['Yeti', ['传统搜索'], 'Naver 搜索 crawler。', { aliases: ['Naverbot'] }],
      ['Ads-Naver', ['广告'], 'Naver 广告页面检查。'],
      ['Blueno', ['链接预览'], 'Naver 链接预览。'],
    ],
  ),
  ...vendor(
    {
      name: 'Seznam',
      sources: [
        source(
          'Seznam：SeznamBot crawler',
          'https://o-seznam.cz/napoveda/vyhledavani/en/seznambot-crawler/',
        ),
      ],
      verification: '官方页面提供 IPv4/IPv6 与身份检查说明，使用当前范围；本版未随附页面范围快照。',
      robots: '按 Seznam 官方 crawler 文档分别控制。',
    },
    [
      [
        'SeznamBot',
        ['传统搜索'],
        'Seznam 常规搜索索引。',
        {
          ua: 'Mozilla/5.0 (compatible; SeznamBot/4.0; +https://o-seznam.cz/napoveda/vyhledavani/en/seznambot-crawler/)',
        },
      ],
      ['FreshBot', ['传统搜索'], 'Seznam 新鲜内容与 RSS 抓取。'],
    ],
  ),
  ...vendor(
    {
      name: 'Qwant',
      sources: [
        source(
          'Qwant：QwantBot and robots.txt',
          'https://help.qwant.com/hc/en-us/articles/51146433634833-The-Qwant-bot-QwantBot-and-the-robots-txt-file',
        ),
      ],
      verification: '按官方 QwantBot 页面引用的范围或双向 DNS 方法核验；核对 feed 的适用 token。',
      robots: '支持 Qwantbot 与 Qwantbot-news 的对应指令。',
    },
    [
      ['Qwantbot', ['传统搜索'], 'Qwant 网页搜索。'],
      ['Qwantbot-news', ['传统搜索'], 'Qwant 新闻搜索。'],
    ],
  ),
  ...vendor(
    {
      name: 'Mojeek',
      sources: [source('Mojeek：Bot', 'https://www.mojeek.com/bot.html')],
      verification: '按官方页面发布的 IP 信息或双向 DNS 检查。',
      robots: '遵循 robots.txt，官方说明不支持 Crawl-delay。',
    },
    [['MojeekBot', ['传统搜索'], 'Mojeek 独立搜索引擎 crawler。']],
  ),
  ...vendor(
    {
      name: 'Meta',
      sources: [cloudflare],
      verification:
        '本条依据 Cloudflare 观察目录，厂商文档本次访问受限。未取得可核实的官方 IP 范围，需在部署前复核。',
      robots: '本版用途标签来自 CDN 观察，具体 robots 行为需复核厂商当前说明。',
      evidence: 'observed',
    },
    [
      ['Meta-ExternalAgent', ['训练'], 'Cloudflare 观察标为 AI crawler。'],
      ['Meta-ExternalFetcher', ['用户触发'], 'Cloudflare 观察标为 AI assistant 获取器。'],
      ['FacebookBot', ['训练'], 'Cloudflare 观察标为 AI crawler。'],
    ],
  ),
  ...vendor(
    {
      name: '字节跳动',
      sources: [cloudflare],
      verification:
        '本条依据 Cloudflare 观察目录，未取得可核实的官方 IP feed。UA 分类与身份核验分别处理。',
      robots: '本次未核实厂商的完整 robots 行为说明；部署前复核，源站/WAF 提供实际访问控制。',
      evidence: 'observed',
    },
    [
      [
        'Bytespider',
        ['训练'],
        'Cloudflare 观察标为 ByteDance AI crawler。',
        { aliases: ['ByteDance', '字节蜘蛛'] },
      ],
    ],
  ),
  ...vendor(
    {
      name: 'Ahrefs',
      sources: [
        source('Ahrefs：Robot', 'https://ahrefs.com/robot'),
        source(
          'Ahrefs：Crawler IP ranges API',
          'https://docs.ahrefs.com/en/api/reference/public/get-crawler-ip-ranges',
        ),
      ],
      verification: officialRange,
      robots: '支持对应 robots 指令，参考官方页面的 Crawl-delay 与控制说明。',
      advice:
        'SEO 工具按监测需求开放，核验来源并对昂贵页面限速。审核前核对 SiteAudit 与通用 crawler 的范围差异。',
    },
    [
      [
        'AhrefsBot',
        ['SEO 工具'],
        'Ahrefs 网络索引 crawler。',
        {
          feeds: [
            source(
              'Ahrefs crawler IP ranges',
              'https://api.ahrefs.com/v3/public/crawler-ip-ranges',
            ),
          ],
        },
      ],
      [
        'AhrefsSiteAudit',
        ['SEO 工具'],
        '由网站审计任务触发的 Ahrefs crawler。',
        {
          verification:
            '按 Ahrefs 官方页面中的 SiteAudit 专属身份与 IP 信息核对；通用 crawler feed 的适用范围需要复核。',
        },
      ],
    ],
  ),
  ...vendor(
    {
      name: 'Semrush',
      sources: [
        source('Semrush：Bot', 'https://www.semrush.com/bot/'),
        source(
          'Semrush：Site Audit troubleshooting',
          'https://www.semrush.com/kb/681-site-audit-troubleshooting',
        ),
      ],
      verification:
        'SemrushBot 使用分布式地址，官方说明无法仅按固定连续网段控制。SiteAuditBot 有独立的官方审计范围，适用用途需要单独核对。',
      robots: '按对应 crawler robots token 设置，参考官方 Crawl-delay 说明。',
      advice:
        '根据 SEO 审计需求开放相应 crawler，避免将 SiteAuditBot 专属范围扩大解释为全部 SemrushBot。',
    },
    [
      ['SemrushBot', ['SEO 工具'], 'Semrush 通用网络 crawler。'],
      [
        'SiteAuditBot',
        ['SEO 工具'],
        'Semrush 网站审计 crawler。',
        {
          verification:
            '官方审计文档列出 85.208.98.128/25，使用前复核当前文档。该范围只描述 SiteAuditBot。',
          aliases: ['Semrush Site Audit'],
        },
      ],
    ],
  ),
  ...vendor(
    {
      name: 'Majestic',
      sources: [source('Majestic：MJ12bot', 'https://www.mj12bot.com/')],
      verification:
        'MJ12bot 全球分布式运行，没有统一固定 IP 范围。按官方联系与特定安排复核身份，保留证据。',
      robots: '支持 robots.txt 与 Crawl-delay。',
      advice:
        '按 SEO 与链接索引需求设置抓取偏好和频率；监测源站成本，避免采用任意社区 IP 表作为永久放行依据。',
    },
    [['MJ12bot', ['SEO 工具'], 'Majestic 链接索引的分布式 crawler。']],
  ),
  ...vendor(
    {
      name: 'Petal Search',
      sources: [source('PetalBot 官方地址（待复核）', 'https://aspiegel.com/petalbot')],
      verification: '本次官方资料无法稳定访问，IP、DNS 与 UA 完整示例待复核。',
      robots: '待官方资料复核后再采用具体规则。',
      evidence: 'pending',
      advice:
        '保留待复核状态。对异常请求按源站一般访问策略处理，待取得官方证据后再制定专属放行规则。',
    },
    [['PetalBot', ['传统搜索'], 'Petal Search crawler；本版保留待复核条目。']],
  ),
];
