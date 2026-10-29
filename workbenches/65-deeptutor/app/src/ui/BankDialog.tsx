import { useRef } from "react";
import { FileUp, Download } from "lucide-react";
import { questionsValue } from "../contracts/tutor.ts";
import { isRecord } from "../contracts/project.ts";
import { Dialog } from "./Dialog.tsx";
import { KIND_LABEL } from "./labels.ts";
import { BANK_DRAFT_LIMIT } from "./bank-file.ts";
import type { Desk } from "./useTutorDesk.ts";

const SAMPLE_CSV = "题目,题型,A,B,C,D,答案,解析,标签\n";

/** Question-bank desk: import/edit raw JSON, CSV or TSV, check, then adopt. */
export function BankDialog({
  d,
  open,
  close,
}: {
  d: Desk;
  open: boolean;
  close: () => void;
}) {
  const { p, busy, mutable } = d;
  const file = useRef<HTMLInputElement>(null);
  const imported = Array.isArray(p.draft.importHistory)
    ? p.draft.importHistory
        .slice()
        .reverse()
        .find(
          (x) =>
            isRecord(x) &&
            isRecord(x.generation) &&
            x.generation.status === "completed",
        )
    : null;
  function inspectImported() {
    try {
      if (!isRecord(imported) || !isRecord(imported.generation)) return;
      if (d.bank && !confirm("替换当前待采用的题库候选？原生成记录仍会保留。")) return;
      const questions = questionsValue(imported.generation.questions);
      p.setDraft((x) => ({ ...x, bankCandidate: questions }));
    } catch (e) {
      p.report(e);
    }
  }
  const omitted = typeof p.draft.bankTextOmitted === "string" ? p.draft.bankTextOmitted : "";
  return (
    <Dialog open={open} close={close} title="题库" eyebrow="QUESTION BANK" className="bank">
      <p className="bank-intro">
        按DeepTutor题库格式检查：JSON题目数组，或带表头的CSV/TSV（题目、题型、A–J选项、答案、解析、难度、标签，中英文列名均可）。一次最多500题；有任何一行不合格时整批不导入，并列出行号。
      </p>
      <div className="bank-toolbar">
        <button disabled={!mutable} onClick={() => file.current?.click()}>
          <FileUp size={16} aria-hidden="true" />
          选择题库文件
        </button>
        <label>
          格式
          <select
            name="bankFormat"
            value={d.bankFormat}
            disabled={!mutable}
            onChange={(e) => p.setDraft((x) => ({ ...x, bankFormat: e.target.value }))}
          >
            <option value="json">JSON</option>
            <option value="csv">CSV</option>
            <option value="tsv">TSV</option>
          </select>
        </label>
        <button onClick={d.exportBank}>
          <Download size={16} aria-hidden="true" />
          导出当前题库
        </button>
        {imported ? <button onClick={inspectImported}>取回导入记录中的生成题</button> : null}
        <input
          ref={file}
          type="file"
          accept=".json,.csv,.tsv,.txt,application/json,text/csv,text/tab-separated-values"
          hidden
          aria-label="选择题库文件"
          onChange={(e) => {
            const f = e.target.files?.[0];
            e.target.value = "";
            if (f) void d.readBank(f);
          }}
        />
      </div>
      <label className="bank-source">
        <span>
          题库原文
          {typeof p.draft.bankText === "string" ? " · 编辑会自动保存" : " · 当前显示本课程题库"}
        </span>
        <textarea
          id="bank-text"
          name="bankText"
          spellCheck={false}
          disabled={!mutable}
          value={d.rawBank}
          placeholder={SAMPLE_CSV}
          onChange={(e) => p.setDraft((x) => ({ ...x, bankText: e.target.value }))}
        />
      </label>
      {omitted ? (
        <p className="bank-note">
          “{omitted}”超过{Math.round(BANK_DRAFT_LIMIT / 1000)}KB，已直接检查；原文不放入自动保存的工作稿，检查结果会保留。
        </p>
      ) : null}
      <div className="bank-toolbar">
        <button
          className="primary"
          disabled={!mutable || busy}
          onClick={() => {
            void d.normalizeBank();
          }}
        >
          {busy ? "正在检查…" : "检查题库格式"}
        </button>
        {typeof p.draft.bankText === "string" ? (
          <button
            onClick={() =>
              p.setDraft((x) => {
                const n = { ...x };
                delete n.bankText;
                delete n.bankCandidate;
                return n;
              })
            }
          >
            放弃原文编辑
          </button>
        ) : null}
      </div>
      {d.bankErrors.length ? (
        <div className="bank-errors" role="alert">
          <strong>{d.bankErrors.length} 处需要修正，整批未导入</strong>
          <ul>
            {d.bankErrors.slice(0, 30).map((e, i) => (
              <li key={i}>
                {e.row > 0 ? <b>第{e.row}行</b> : null}
                {e.message}
              </li>
            ))}
          </ul>
          {d.bankErrors.length > 30 ? <p>另有 {d.bankErrors.length - 30} 处未列出。</p> : null}
        </div>
      ) : null}
      {d.bank ? (
        <div className="bank-candidate">
          <strong>{d.bank.length} 道题通过检查</strong>
          <ol>
            {d.bank.slice(0, 200).map((q) => (
              <li key={q.question_id}>
                <span className="kind">{KIND_LABEL[q.question_type] ?? q.question_type}</span>
                {q.question}
              </li>
            ))}
          </ol>
          {d.bank.length > 200 ? <p>另有 {d.bank.length - 200} 题。</p> : null}
          <div className="adopt">
            <button
              className="primary"
              disabled={!mutable || busy}
              onClick={() => {
                if (d.bank && d.adoptQuestions(d.bank, "bank", "append")) close();
              }}
            >
              追加到练习册
            </button>
            <button
              disabled={!mutable || busy}
              onClick={() => {
                if (d.bank && d.adoptQuestions(d.bank, "bank", "replace")) close();
              }}
            >
              替换整套题
            </button>
          </div>
        </div>
      ) : null}
    </Dialog>
  );
}
