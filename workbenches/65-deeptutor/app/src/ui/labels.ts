export const KIND_LABEL: Record<string, string> = {
  single_choice: "单选题",
  multi_choice: "多选题",
  true_false: "判断题",
  fill_blank: "填空题",
  short_answer: "简答题",
};
export const TRUE_FALSE: Record<string, string> = { T: "对", F: "错" };
/** Readable answer text: option keys with their labels, true/false in Chinese. */
export function answerLabel(
  q: { question_type: string; options: Record<string, string> },
  value: string,
) {
  if (q.question_type === "true_false") return TRUE_FALSE[value] ?? value;
  if (!Object.keys(q.options).length) return value;
  return value
    .split(",")
    .filter(Boolean)
    .map((k) => (q.options[k] ? `${k}. ${q.options[k]}` : k))
    .join("；");
}
