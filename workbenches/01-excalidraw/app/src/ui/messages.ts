// ABOUTME: 集中维护骨架的双语文案。

const messages = {
  "zh-CN": {
    loading: "正在加载",
    empty: "暂无内容",
    failure: "暂时无法加载。独立预览请使用终端中的完整地址。",
    retry: "重试",
    connected: "平台已连接，能力可用性以调用时授权为准。",
    "not-connected": "平台未连接 · 本地功能可用",
    unavailable: "暂时无法连接平台 · 本地功能可用",
  },
  en: {
    loading: "Loading",
    empty: "No content yet",
    failure:
      "Unable to load. For standalone preview, use the full URL from the terminal.",
    retry: "Retry",
    connected: "Platform connected. Authorization is checked on each call.",
    "not-connected": "Platform not connected · Local features available",
    unavailable: "Platform unavailable · Local features available",
  },
};

export function text(key: keyof typeof messages.en): string {
  return messages[
    document.documentElement.lang.startsWith("zh") ? "zh-CN" : "en"
  ][key];
}
