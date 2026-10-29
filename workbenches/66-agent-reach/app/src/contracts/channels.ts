// ABOUTME: 工作台服务自行执行的公开渠道与动作（无登录、无密钥）。

export type ChannelAction = {
  id: string;
  label: string;
  needsQuery: boolean;
  field: string;
  placeholder: string;
  note: string;
};
export type Channel = { id: string; label: string; actions: ChannelAction[] };
/** Channels and actions the workbench server performs itself (no login, no keys). */
export const CHANNELS: Channel[] = [
  {
    id: "web",
    label: "网页",
    actions: [
      {
        id: "read",
        label: "阅读网页",
        needsQuery: true,
        field: "网页链接",
        placeholder: "https://…",
        note: "先经 Jina Reader 转为正文，失败时由工作台直接读取并提取正文。链接会提交给 Jina。",
      },
      {
        id: "fetch",
        label: "直接读取",
        needsQuery: true,
        field: "网页链接",
        placeholder: "https://…",
        note: "工作台直接请求该网页并提取正文，不经第三方服务。",
      },
      {
        id: "search",
        label: "网页搜索",
        needsQuery: true,
        field: "搜索词",
        placeholder: "例如 OPFS SQLite 持久化…",
        note: "使用 Exa 免密钥公开搜索（上游 web search），搜索词会提交给 Exa。",
      },
    ],
  },
  {
    id: "github",
    label: "GitHub",
    actions: [
      {
        id: "read",
        label: "仓库 / Issue / PR",
        needsQuery: true,
        field: "仓库或链接",
        placeholder: "owner/repo 或 github.com 链接…",
        note: "匿名公开 REST：仓库含 README，Issue/PR 含前50条评论。未登录每小时60次。",
      },
      {
        id: "search",
        label: "搜索仓库",
        needsQuery: true,
        field: "关键词",
        placeholder: "例如 sqlite wasm…",
        note: "匿名公开 REST 仓库搜索，返回前5项。",
      },
    ],
  },
  {
    id: "v2ex",
    label: "V2EX",
    actions: [
      {
        id: "read",
        label: "主题与回复",
        needsQuery: true,
        field: "主题链接或编号",
        placeholder: "https://www.v2ex.com/t/…",
        note: "V2EX 公开 API，读取主题正文与第一页回复。",
      },
      {
        id: "node",
        label: "节点最新",
        needsQuery: true,
        field: "节点名称",
        placeholder: "例如 python…",
        note: "V2EX 公开 API，返回节点最新5个主题。",
      },
      {
        id: "hot",
        label: "今日热门",
        needsQuery: false,
        field: "无需填写",
        placeholder: "",
        note: "V2EX 公开 API，返回今日热门前5个主题。",
      },
    ],
  },
];
export const channelLabel = (id: string | null) =>
  CHANNELS.find((c) => c.id === id)?.label ?? id ?? "导入";
