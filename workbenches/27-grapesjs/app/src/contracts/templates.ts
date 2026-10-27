import type { PageData, PageNode } from "./page.ts";
const text = (tagName: string, content: string, cls: string): PageNode => ({
  tagName,
  type: "text",
  content,
  attributes: { class: cls },
});
export const blocks: {
  id: string;
  label: string;
  symbol: string;
  content: PageNode;
}[] = [
  {
    id: "section",
    label: "留白区段",
    symbol: "▤",
    content: {
      tagName: "section",
      style: { padding: "40px", "min-height": "160px" },
      components: [
        text("h2", "新的篇章", "section-title"),
        text("p", "在这里介绍你的想法。", "body-text"),
      ],
    },
  },
  {
    id: "heading",
    label: "标题",
    symbol: "H₁",
    content: text("h2", "写下一个好标题", "section-title"),
  },
  {
    id: "paragraph",
    label: "正文",
    symbol: "¶",
    content: text("p", "双击编辑这段文字，让内容成为页面的主角。", "body-text"),
  },
  {
    id: "columns",
    label: "双栏内容",
    symbol: "▥",
    content: {
      tagName: "section",
      style: {
        display: "flex",
        gap: "24px",
        padding: "40px",
        "flex-wrap": "wrap",
      },
      components: [
        {
          tagName: "div",
          style: { flex: "1", "min-width": "180px" },
          components: [
            text("h3", "一份新想法", "section-title"),
            text("p", "用简洁的文字，讲清一件值得分享的事。", "body-text"),
          ],
        },
        {
          tagName: "div",
          style: { flex: "1", "min-width": "180px" },
          components: [
            text("h3", "一段好故事", "section-title"),
            text("p", "让每一个区块都为你的页面增添价值。", "body-text"),
          ],
        },
      ],
    },
  },
  {
    id: "button",
    label: "锚点按钮",
    symbol: "↗",
    content: {
      tagName: "a",
      type: "link",
      content: "了解更多 →",
      attributes: { class: "button-link", href: "#about" },
    },
  },
  {
    id: "divider",
    label: "分隔线",
    symbol: "―",
    content: {
      tagName: "hr",
      style: {
        border: "0",
        "border-top": "1px solid #d6d9cf",
        margin: "24px 0",
      },
    },
  },
];
export const seed: PageData = {
  version: 1,
  components: [
    {
      tagName: "main",
      attributes: { class: "site" },
      components: [
        {
          tagName: "header",
          attributes: { class: "site-header" },
          components: [
            text("span", "FIELDNOTES", "wordmark"),
            text("span", "独立设计 · 日常观察", "header-note"),
          ],
        },
        {
          tagName: "section",
          attributes: { class: "hero" },
          components: [
            {
              tagName: "div",
              attributes: { class: "hero-copy" },
              components: [
                text("p", "DESIGN FOR EVERYDAY LIFE", "eyebrow"),
                text("h1", "把日常，\n过成喜欢的样子。", "hero-title"),
                text(
                  "p",
                  "从一张桌子、一束光，到一个新的开始。\n我们记录生活里的好设计，也分享它们背后的故事。",
                  "hero-description",
                ),
                {
                  tagName: "a",
                  type: "link",
                  content: "认识我们的工作室 ↗",
                  attributes: { href: "#about", class: "button-link" },
                },
              ],
            },
            {
              tagName: "div",
              attributes: {
                class: "artwork",
                "aria-label": "抽象的暖色建筑几何图形",
              },
              components: [
                { tagName: "div", attributes: { class: "sun" } },
                { tagName: "div", attributes: { class: "arch" } },
                { tagName: "div", attributes: { class: "small-block" } },
                text("span", "A SMALL STUDIO\nWITH BIG IDEAS.", "art-caption"),
              ],
            },
          ],
        },
        {
          tagName: "section",
          attributes: { id: "about", class: "about" },
          components: [
            text("p", "01 / 我们的观察", "eyebrow"),
            {
              tagName: "div",
              attributes: { class: "about-grid" },
              components: [
                text("h2", "好的设计，\n从认真生活开始。", "section-title"),
                text(
                  "p",
                  "留意清晨的光线，珍惜物品的质感，找到适合自己的节奏。我们相信，小小的改变可以让平凡的日子变得不同。",
                  "body-text",
                ),
              ],
            },
          ],
        },
        {
          tagName: "footer",
          attributes: { class: "site-footer" },
          components: [
            text("span", "FIELDNOTES © 2026", "footer-text"),
            text("span", "保持好奇，持续创造。", "footer-text"),
          ],
        },
      ],
    },
  ],
  rules: [
    {
      selector: ".site",
      style: {
        color: "#28392e",
        "background-color": "#f7f6ef",
        "font-family": "Arial, sans-serif",
      },
    },
    {
      selector: ".site-header",
      style: {
        display: "flex",
        "justify-content": "space-between",
        "align-items": "center",
        padding: "30px 40px",
        "border-bottom": "1px solid #dedfd4",
      },
    },
    {
      selector: ".wordmark",
      style: {
        "font-size": "19px",
        "font-weight": "800",
        "letter-spacing": "3px",
      },
    },
    {
      selector: ".header-note",
      style: { "font-size": "11px", color: "#6a7165" },
    },
    {
      selector: ".hero",
      style: {
        display: "flex",
        "align-items": "stretch",
        padding: "64px 40px",
        gap: "32px",
        "flex-wrap": "wrap",
      },
    },
    { selector: ".hero-copy", style: { flex: "1", "min-width": "250px" } },
    {
      selector: ".eyebrow",
      style: {
        "font-size": "10px",
        "letter-spacing": "2px",
        "font-weight": "700",
        margin: "0 0 28px",
      },
    },
    {
      selector: ".hero-title",
      style: {
        "font-size": "42px",
        "line-height": "1.3",
        "letter-spacing": "-2px",
        "white-space": "pre-line",
        margin: "0 0 24px",
        "font-weight": "700",
      },
    },
    {
      selector: ".hero-description",
      style: {
        "font-size": "13px",
        "line-height": "1.9",
        color: "#6a7165",
        "white-space": "pre-line",
        margin: "0 0 32px",
      },
    },
    {
      selector: ".button-link",
      style: {
        display: "inline-block",
        padding: "13px 20px",
        "background-color": "#314e3b",
        color: "#fff",
        "border-radius": "3px",
        "text-decoration": "none",
        "font-size": "12px",
        "font-weight": "600",
      },
    },
    {
      selector: ".artwork",
      style: {
        width: "245px",
        "min-height": "305px",
        "background-color": "#e9dfc8",
        "border-radius": "120px 120px 4px 4px",
        padding: "35px 30px 20px",
        display: "flex",
        "flex-direction": "column",
        "align-items": "center",
        "justify-content": "flex-end",
        gap: "12px",
      },
    },
    {
      selector: ".sun",
      style: {
        width: "64px",
        height: "64px",
        "background-color": "#cc7c55",
        "border-radius": "50%",
      },
    },
    {
      selector: ".arch",
      style: {
        width: "135px",
        height: "100px",
        "background-color": "#76846a",
        "border-radius": "70px 70px 0 0",
      },
    },
    {
      selector: ".small-block",
      style: { width: "165px", height: "20px", "background-color": "#c5ad81" },
    },
    {
      selector: ".art-caption",
      style: {
        "font-size": "9px",
        "line-height": "1.7",
        "letter-spacing": "2px",
        "white-space": "pre-line",
        "text-align": "center",
        margin: "12px 0 0",
      },
    },
    {
      selector: ".about",
      style: { padding: "34px 40px 48px", "border-top": "1px solid #dedfd4" },
    },
    {
      selector: ".about-grid",
      style: { display: "flex", gap: "40px", "flex-wrap": "wrap" },
    },
    {
      selector: ".section-title",
      style: {
        "font-size": "26px",
        "line-height": "1.5",
        margin: "0",
        "white-space": "pre-line",
        flex: "1",
        "min-width": "200px",
      },
    },
    {
      selector: ".body-text",
      style: {
        "font-size": "13px",
        "line-height": "1.9",
        color: "#6a7165",
        margin: "0",
        flex: "1",
        "min-width": "200px",
      },
    },
    {
      selector: ".site-footer",
      style: {
        display: "flex",
        "justify-content": "space-between",
        padding: "22px 40px",
        "border-top": "1px solid #dedfd4",
      },
    },
    {
      selector: ".footer-text",
      style: { "font-size": "10px", "letter-spacing": "1px", color: "#747d6f" },
    },
    {
      selector: ".hero-title",
      style: { "font-size": "34px" },
      media: "(max-width: 480px)",
    },
    {
      selector: ".hero",
      style: { padding: "40px 24px" },
      media: "(max-width: 480px)",
    },
    {
      selector: ".site-header",
      style: { padding: "24px" },
      media: "(max-width: 480px)",
    },
  ],
};
