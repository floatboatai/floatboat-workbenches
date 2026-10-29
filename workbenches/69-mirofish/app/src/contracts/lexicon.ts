// ABOUTME: 中文立场词典：规则抽取初始立场、导入结果的立场估计共用同一套词表。

export const POSITIVE = [
  "支持", "赞成", "赞同", "欢迎", "认可", "期待", "点赞", "受益", "改善", "便利", "利好", "肯定",
  "同意", "看好", "满意", "积极", "值得", "好事", "有效", "提升", "拥护", "希望尽快", "叫好", "放心",
];
export const NEGATIVE = [
  "反对", "抗议", "质疑", "担忧", "担心", "投诉", "不满", "损失", "风险", "抵制", "不合理", "一刀切",
  "下降", "受损", "批评", "困难", "负担", "焦虑", "失望", "拒绝", "吐槽", "不公平", "缩水", "叫苦",
];
const NEGATORS = ["不", "没", "未", "无", "别", "非"];

/** Lexicon score in [-1,1] with simple one-character negation handling. */
export function lexiconScore(text: string): { score: number; hits: number } {
  let pos = 0,
    neg = 0;
  const scan = (words: string[], sign: 1 | -1) => {
    for (const w of words) {
      let from = 0;
      for (;;) {
        const i = text.indexOf(w, from);
        if (i < 0) break;
        from = i + w.length;
        const negated = i > 0 && NEGATORS.includes(text[i - 1]) && !w.startsWith("不");
        if ((sign === 1) !== negated) pos++;
        else neg++;
      }
    }
  };
  scan(POSITIVE, 1);
  scan(NEGATIVE, -1);
  const hits = pos + neg;
  return { score: hits ? (pos - neg) / (hits + 1) : 0, hits };
}
