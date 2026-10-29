// ABOUTME: 首次打开时的示例文稿：一份普通的社区图书角改造方案，覆盖标题、表格、任务清单、链接、引用与高亮。
import type { JSONContent } from "@tiptap/core";
import type { WritingProject } from "./domain.ts";

const t = (text: string, ...marks: string[]): JSONContent =>
  marks.length ? { type: "text", text, marks: marks.map((type) => ({ type })) } : { type: "text", text };
const p = (...content: JSONContent[]): JSONContent => ({ type: "paragraph", content });
const h = (level: number, text: string): JSONContent => ({
  type: "heading",
  attrs: { level },
  content: [t(text)],
});
const cell = (type: "tableCell" | "tableHeader", text: string): JSONContent => ({
  type,
  attrs: { colspan: 1, rowspan: 1, colwidth: null },
  content: [p(t(text))],
});
const row = (type: "tableCell" | "tableHeader", ...texts: string[]): JSONContent => ({
  type: "tableRow",
  content: texts.map((text) => cell(type, text)),
});
const task = (checked: boolean, text: string): JSONContent => ({
  type: "taskItem",
  attrs: { checked },
  content: [p(t(text))],
});
const item = (type: "listItem", ...content: JSONContent[]): JSONContent => ({
  type,
  content: [p(...content)],
});

export const seedTitle = "社区共享图书角改造方案";

export const seed: WritingProject = {
  content: {
    type: "doc",
    content: [
      p(
        t("本方案计划在"),
        t("春晖社区活动中心一楼", "bold"),
        t("改造一处约 40 平方米的共享图书角，为周边约 1,800 户居民提供借阅、亲子阅读和小型分享活动空间。方案由社区服务站起草，供"),
        t("11 月居民议事会", "highlight"),
        t("讨论。"),
      ),
      h(2, "背景"),
      p(
        t("现有阅览室位于二楼，只在工作日白天开放，去年全年借阅仅 620 册次。居民问卷（回收 312 份）显示，68% 的受访者希望在晚间和周末借书，亲子家庭最关心儿童书架和安静的阅读角。开放时间与分区可参考"),
        {
          type: "text",
          text: "公共图书馆的通行做法",
          marks: [
            {
              type: "link",
              attrs: {
                href: "https://zh.wikipedia.org/wiki/%E5%85%AC%E5%85%B1%E5%9B%BE%E4%B9%A6%E9%A6%86",
                target: "_blank",
                rel: "noopener noreferrer",
              },
            },
          ],
        },
        t("。"),
      ),
      {
        type: "blockquote",
        content: [
          p(t("“下班后能带孩子下楼看半小时书，就是我们最需要的。”——3 号楼居民留言")),
        ],
      },
      p(
        t("周边 3 所小学的放学时间集中在 16:30 前后，不少孩子需要在社区等候家长下班。一个安静、有人照看的阅读空间，可以同时缓解看护压力。"),
      ),
      h(2, "目标"),
      {
        type: "orderedList",
        content: [
          item("listItem", t("每周开放不少于 60 小时，覆盖晚间与周末。")),
          item("listItem", t("首批上架图书 1,500 册，其中儿童读物不少于 40%。")),
          item("listItem", t("半年内月均借阅达到 400 册次。")),
        ],
      },
      h(2, "空间与运营"),
      p(
        t("图书角分为三个区域：靠窗的成人阅读区、铺设软垫的亲子绘本区，以及由可移动桌椅组成的分享区，周末用于读书会和作业辅导。日常由 6 名志愿者轮值管理，工作日 17:00–21:00、周末 9:00–18:00 开放；居民凭社区服务卡自助借还，每次最多借 5 册，借期 21 天。"),
      ),
      h(2, "预算"),
      {
        type: "table",
        content: [
          row("tableHeader", "项目", "数量", "金额（元）"),
          row("tableCell", "书架与阅读桌椅", "1 套", "18,000"),
          row("tableCell", "首批图书采购", "1,500 册", "30,000"),
          row("tableCell", "照明与插座改造", "1 项", "6,500"),
          row("tableCell", "自助借还设备", "1 台", "9,800"),
          row("tableCell", "合计", "—", "64,300"),
        ],
      },
      p(
        t("经费拟由街道社区服务专项承担 70%，其余通过共建单位捐赠解决；"),
        t("图书采购须在 12 月底前完成招标", "bold"),
        t("。"),
      ),
      h(2, "实施安排"),
      {
        type: "taskList",
        content: [
          task(true, "完成居民问卷与需求汇总"),
          task(true, "确认场地承重与消防要求"),
          task(false, "议事会审议预算（11 月 20 日）"),
          task(false, "招募志愿者管理员（12 月）"),
          task(false, "试运行并收集反馈（次年 1 月）"),
        ],
      },
      h(3, "风险与应对"),
      {
        type: "bulletList",
        content: [
          item("listItem", t("志愿者不足", "bold"), t("：与附近两所中学合作，提供志愿服务时长认证。")),
          item("listItem", t("图书损耗", "bold"), t("：采用自助借还登记，每季度盘点一次并公示。")),
          item("listItem", t("噪音影响", "bold"), t("：分享活动只安排在周末白天，晚间保持安静阅读。")),
        ],
      },
      p(t("如有意见，请在 11 月 15 日前反馈给社区服务站。", "italic")),
    ],
  },
};
