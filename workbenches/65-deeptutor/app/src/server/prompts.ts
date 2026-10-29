import { boundedText, isRecord } from "../contracts/project.ts";
import {
  questionValue,
  idValue,
  TUTOR_TURNS,
  type Question,
} from "../contracts/tutor.ts";
import type { GenerationOptions } from "../contracts/generation.ts";
import type { GenerationInput } from "./generations.ts";

export const MODEL = "gemini-3.8-flash";
const KIND_RULES: Record<string, string> = {
  single_choice:
    'single_choice：options为4个选项对象如{"A":"…","B":"…","C":"…","D":"…"}，correct_answer为一个选项字母',
  multi_choice:
    "multi_choice：options为4–5个选项，correct_answer为两个及以上字母，用英文逗号分隔，如\"A,C\"",
  true_false: 'true_false：options为空对象{}，correct_answer为"对"或"错"',
  fill_blank:
    "fill_blank：题干用___标出一个空，options为空对象{}，correct_answer为空格处的标准填写",
  short_answer:
    "short_answer：options为空对象{}，correct_answer为两三句参考答案",
};
const KIND_NAMES: Record<string, string> = {
  single_choice: "单选",
  multi_choice: "多选",
  true_false: "判断",
  fill_blank: "填空",
  short_answer: "简答",
};

export function generationPrompt(input: GenerationInput) {
  const { count, kind, difficulty } = input.options;
  const kinds =
    kind === "mixed"
      ? `题型在single_choice、multi_choice、true_false、fill_blank、short_answer中混合，至少使用三种（题数少于3时各不相同）`
      : `全部为${kind}（${KIND_NAMES[kind]}题）`;
  const level =
    difficulty === "mixed"
      ? "difficulty在“基础”“理解”“应用”之间分布"
      : `difficulty全部为“${difficulty}”`;
  const rules = (kind === "mixed" ? Object.values(KIND_RULES) : [KIND_RULES[kind]]).join("；");
  const system = [
    `你是课程练习题编辑。只根据讲义生成${count}道练习题，不添加讲义以外的事实。`,
    `${kinds}；${level}。`,
    "仅返回JSON数组，不要解释。每项字段：question(题干)、question_type、options、correct_answer、explanation(引用讲义说明为什么，指出常见误解)、difficulty、tags(1–3个知识点字符串)、user_answer(空字符串)。",
    `各题型要求：${rules}。`,
    "题目之间不重复，也不要与“已有题目”重复；干扰项要对应讲义中真实的易混概念。",
  ].join("\n");
  const avoid = input.avoid.length
    ? `\n\n已有题目（不要重复）：\n${input.avoid.map((x) => "- " + x).join("\n")}`
    : "";
  return {
    model: MODEL,
    system,
    prompt: `学习目标：${input.goal || "（未填写）"}\n\n讲义：\n${input.lesson}${avoid}`,
    maxOutputTokens: Math.min(16000, 2000 + count * 1000),
  };
}

export interface TutorRequest {
  id: string;
  question: Question;
  answer: string;
  correct: boolean | null;
  lesson: string;
  goal: string;
  turns: { role: "tutor" | "learner"; text: string }[];
  followUp: string;
}
export function tutorRequestValue(v: unknown): TutorRequest {
  if (!isRecord(v) || !Array.isArray(v.turns) || v.turns.length > TUTOR_TURNS - 2)
    throw new Error("讲解请求无效，或本题讲解已达到上限");
  if (v.correct !== null && typeof v.correct !== "boolean") throw new Error("核对结果无效");
  const answer = boundedText(v.answer, 5000);
  if (!answer.trim()) throw new Error("请先作答并核对");
  const followUp = boundedText(v.followUp ?? "", 1000);
  if (v.turns.length && !followUp.trim()) throw new Error("请写下要追问的内容");
  return {
    id: idValue(v.id),
    question: questionValue(v.question),
    answer,
    correct: v.correct,
    lesson: boundedText(v.lesson, 80000),
    goal: boundedText(v.goal, 2000),
    turns: v.turns.map((t) => {
      if (!isRecord(t) || (t.role !== "tutor" && t.role !== "learner"))
        throw new Error("讲解记录无效");
      return { role: t.role, text: boundedText(t.text, 8000) };
    }),
    followUp,
  };
}
const optionText = (q: Question) =>
  Object.entries(q.options)
    .map(([k, t]) => `${k}. ${t}`)
    .join("\n");
export function tutorPrompt(r: TutorRequest) {
  const q = r.question;
  const verdict =
    r.correct === false ? "判定：答错" : r.correct === true ? "判定：答对" : "判定：主观题，需要对照参考答案自评";
  const learnerAnswer = Object.keys(q.options).length
    ? r.answer
        .split(",")
        .map((k) => (q.options[k] ? `${k}. ${q.options[k]}` : k))
        .join("；")
    : r.answer;
  const history = r.turns
    .map((t) => (t.role === "tutor" ? "导师：" : "学习者：") + t.text)
    .join("\n\n");
  const lesson = r.lesson.length > 16000 ? r.lesson.slice(0, 16000) + "\n…（讲义其余部分略）" : r.lesson;
  return {
    model: MODEL,
    system: [
      "你是耐心、具体的课程导师，用简体中文回答。只依据给出的讲义、题目和参考答案讲解，不编造讲义以外的事实。",
      "第一次讲解：先点明学习者答案里的具体误解（引用他选的内容），再用讲义中的概念说明正确答案为什么成立，最后给一个一句话的小自测问题（不给答案）。",
      "回答追问：直接回应追问，必要时举一个讲义范围内的小例子。",
      "纯文本，可用“- ”开头的短列表，不使用Markdown标题或代码围栏，控制在220字以内。",
    ].join("\n"),
    prompt: [
      `学习目标：${r.goal || "（未填写）"}`,
      `讲义：\n${lesson}`,
      `题目（${q.question_type}）：${q.question}`,
      optionText(q) ? `选项：\n${optionText(q)}` : "",
      `参考答案：${q.correct_answer}`,
      q.explanation ? `题库解析：${q.explanation}` : "",
      `学习者答案：${learnerAnswer}`,
      verdict,
      history ? `此前对话：\n${history}` : "",
      r.followUp.trim() ? `学习者追问：${r.followUp.trim()}` : "请给出第一次讲解。",
    ]
      .filter(Boolean)
      .join("\n\n"),
    maxOutputTokens: 3000,
  };
}
export type { GenerationOptions };
