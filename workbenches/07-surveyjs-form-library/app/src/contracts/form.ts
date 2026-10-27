import { isRecord, boundedText } from "./project.ts";
export type QuestionType =
  | "text"
  | "comment"
  | "radiogroup"
  | "checkbox"
  | "dropdown"
  | "boolean"
  | "rating";
export interface Question {
  name: string;
  type: QuestionType;
  title: string;
  isRequired: boolean;
  choices?: string[];
}
export interface FormSchema {
  title: string;
  description: string;
  elements: Question[];
}
export interface FormDocument {
  schema: FormSchema;
}
export type Answer = string | number | boolean | string[];
export interface ResponseRecord {
  id: string;
  createdAt: string;
  schema: FormSchema;
  answers: Record<string, Answer>;
}
const types = new Set([
  "text",
  "comment",
  "radiogroup",
  "checkbox",
  "dropdown",
  "boolean",
  "rating",
]);
const choiceTypes = new Set(["radiogroup", "checkbox", "dropdown"]);
function plain(value: unknown, max: number) {
  const text = boundedText(value, max);
  if (/<\/?[a-z][^>]*>/i.test(text))
    throw new Error("标题和说明请使用纯文字，不包含 HTML。");
  return text;
}
export function validateForm(value: unknown): FormDocument {
  if (!isRecord(value) || !isRecord(value.schema))
    throw new Error("问卷需要 schema 定义。");
  const schema = value.schema;
  if (
    !Array.isArray(schema.elements) ||
    schema.elements.length < 1 ||
    schema.elements.length > 50
  )
    throw new Error("问卷需要 1–50 道题。");
  const title = plain(schema.title, 200);
  if (!title.trim()) throw new Error("问卷标题不能为空。");
  const elements = schema.elements.map((question): Question => {
    if (
      !isRecord(question) ||
      typeof question.type !== "string" ||
      !types.has(question.type)
    )
      throw new Error("包含不支持的题型。");
    if (
      typeof question.name !== "string" ||
      !/^[A-Za-z][A-Za-z0-9_]{0,49}$/.test(question.name) ||
      Object.prototype.hasOwnProperty.call(Object.prototype, question.name)
    )
      throw new Error("数据字段名应以字母开头，仅含字母、数字和下划线。");
    const title = plain(question.title, 200);
    if (!title.trim()) throw new Error("题目不能为空。");
    let choices: string[] | undefined;
    if (choiceTypes.has(question.type)) {
      if (
        !Array.isArray(question.choices) ||
        question.choices.length < 2 ||
        question.choices.length > 20
      )
        throw new Error("选择题需要 2–20 个选项。");
      choices = question.choices.map((value) => {
        const item = plain(value, 150);
        if (!item.trim()) throw new Error("选项不能为空。");
        return item;
      });
      if (new Set(choices).size !== choices.length)
        throw new Error("选项不能重复。");
    }
    return {
      name: question.name,
      type: question.type as QuestionType,
      title,
      isRequired: question.isRequired === true,
      ...(choices ? { choices } : {}),
    };
  });
  if (
    new Set(elements.map((question) => question.name)).size !== elements.length
  )
    throw new Error("题目的数据字段名不能重复。");
  return {
    schema: {
      title,
      description: plain(schema.description ?? "", 3000),
      elements,
    },
  };
}
export function validateAnswers(
  schema: FormSchema,
  value: unknown,
): Record<string, Answer> {
  if (!isRecord(value)) throw new Error("答卷格式无效。");
  const questions = new Map(
    schema.elements.map((question) => [question.name, question]),
  );
  if (Object.keys(value).some((key) => !questions.has(key)))
    throw new Error("答卷包含不属于当前问卷的字段。");
  const entries: [string, Answer][] = [];
  for (const question of schema.elements) {
    const answer = value[question.name];
    const empty =
      answer === undefined ||
      answer === null ||
      answer === "" ||
      (Array.isArray(answer) && answer.length === 0);
    if (empty) {
      if (question.isRequired) throw new Error(`请回答「${question.title}」。`);
      continue;
    }
    switch (question.type) {
      case "text":
      case "comment":
        if (
          typeof answer !== "string" ||
          answer.length > 5000 ||
          (question.isRequired && !answer.trim())
        )
          throw new Error(`「${question.title}」需要 1–5000 字符的文字。`);
        entries.push([question.name, answer]);
        break;
      case "boolean":
        if (typeof answer !== "boolean") throw new Error("判断题答案无效。");
        entries.push([question.name, answer]);
        break;
      case "rating":
        if (
          typeof answer !== "number" ||
          !Number.isInteger(answer) ||
          answer < 1 ||
          answer > 5
        )
          throw new Error("评分必须为 1–5。");
        entries.push([question.name, answer]);
        break;
      case "checkbox":
        if (
          !Array.isArray(answer) ||
          answer.some(
            (item) =>
              typeof item !== "string" || !question.choices?.includes(item),
          ) ||
          new Set(answer).size !== answer.length
        )
          throw new Error("多选答案不在选项中。");
        entries.push([question.name, answer as string[]]);
        break;
      default:
        if (typeof answer !== "string" || !question.choices?.includes(answer))
          throw new Error("答案不在选项中。");
        entries.push([question.name, answer]);
    }
  }
  const data = Object.fromEntries(entries);
  if (new TextEncoder().encode(JSON.stringify(data)).length > 50000)
    throw new Error("答卷超过 50 KB，请缩短内容。");
  return data;
}
export function responseValue(value: unknown): ResponseRecord {
  if (
    !isRecord(value) ||
    typeof value.id !== "string" ||
    typeof value.createdAt !== "string"
  )
    throw new Error("答卷响应无效。");
  const schema = validateForm({ schema: value.schema }).schema;
  return {
    id: value.id,
    createdAt: value.createdAt,
    schema,
    answers: validateAnswers(schema, value.answers),
  };
}
export const seed: FormDocument = {
  schema: {
    title: "一起定义更好的产品",
    description: "用几分钟告诉我们你的想法。回答将保存在当前工作空间。",
    elements: [
      { name: "name", type: "text", title: "如何称呼你？", isRequired: true },
      {
        name: "priority",
        type: "radiogroup",
        title: "你最希望改善哪一方面？",
        isRequired: true,
        choices: ["使用体验", "工作效率", "功能完整度"],
      },
      {
        name: "thoughts",
        type: "comment",
        title: "还有什么想补充的？",
        isRequired: false,
      },
    ],
  },
};
