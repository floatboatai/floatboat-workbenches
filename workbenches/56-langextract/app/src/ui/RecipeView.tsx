import { useMemo, useState } from "react";
import { Plus, X } from "lucide-react";
import { examples as decodeExamples, type EvidenceProject, type Example } from "../contracts/evidence";
import { buildPrompt, chunkDocument, exampleWarnings } from "../contracts/prompting";

const attrLine = (a: Record<string, string | string[]> | null | undefined) =>
  a ? Object.entries(a).map(([k, v]) => `${k}=${Array.isArray(v) ? v.join("、") : v}`).join("; ") : "";
const parseAttrLine = (s: string): Record<string, string> | null => {
  const out: Record<string, string> = {};
  for (const part of s.split(/[;；]/)) {
    const at = part.indexOf("=");
    if (at > 0) {
      const k = part.slice(0, at).trim();
      if (k && !["__proto__", "constructor", "prototype"].includes(k)) out[k] = part.slice(at + 1).trim();
    }
  }
  return Object.keys(out).length ? out : null;
};

export function RecipeView({
  data,
  docText,
  colorOf,
  setData,
  examplesDraft,
  setExamplesDraft,
  report,
  notice,
}: {
  data: EvidenceProject;
  docText: string;
  colorOf: (cls: string) => string;
  setData: (fn: (old: EvidenceProject) => EvidenceProject) => boolean;
  examplesDraft: string | null;
  setExamplesDraft: (v: string | null) => void;
  report: (e: unknown) => void;
  notice: (m: string) => void;
}) {
  const warnings = useMemo(() => exampleWarnings(data.examples), [data.examples]);
  const [showPrompt, setShowPrompt] = useState(false);
  const preview = useMemo(
    () =>
      showPrompt
        ? buildPrompt({ ...data, text: chunkDocument(docText)[0]?.text ?? "（当前资料为空）" })
        : "",
    [showPrompt, data, docText],
  );
  const classNames = data.fields.map((f) => f.name).filter(Boolean);
  const setExample = (i: number, fn: (e: Example) => Example) =>
    setData((old) => ({ ...old, examples: old.examples.map((e, j) => (i === j ? fn(e) : e)) }));
  return (
    <section className="configuration">
      <div className="config-heading">
        <span className="eyebrow">EXTRACTION RECIPE</span>
        <h2>定义要寻找的证据</h2>
        <p>
          与 LangExtract 相同的做法：一段任务说明、一组类别定义，再加几条“原文 → 逐字片段”的示例。Floatboat 模型和 Python
          服务都使用这里已应用的内容。
        </p>
      </div>
      <label>
        抽取要求
        <textarea
          aria-label="抽取要求"
          name="extraction-prompt"
          autoComplete="off"
          value={data.prompt}
          onChange={(e) => setData((old) => ({ ...old, prompt: e.target.value }))}
          maxLength={12000}
        />
      </label>
      <div className="field-heading">
        <h3>类别定义 · {data.fields.length}</h3>
        <button
          disabled={data.fields.length >= 40}
          onClick={() => setData((old) => ({ ...old, fields: [...old.fields, { name: "", description: "", attributes: [] }] }))}
        >
          <Plus size={15} aria-hidden="true" />
          添加类别
        </button>
      </div>
      <div className="field-table">
        {data.fields.map((field, i) => (
          <div className="field-row" key={i}>
            <span className="swatch big" style={{ background: colorOf(field.name) }} aria-hidden="true" />
            <label>
              <span className="lbl">名称</span>
              <input
                aria-label={`类别${i + 1}名称`}
                name={`field-${i}-name`}
                autoComplete="off"
                value={field.name}
                maxLength={100}
                onChange={(e) =>
                  setData((old) => ({ ...old, fields: old.fields.map((f, j) => (i === j ? { ...f, name: e.target.value } : f)) }))
                }
              />
            </label>
            <label>
              <span className="lbl">含义</span>
              <input
                aria-label={`类别${i + 1}含义`}
                name={`field-${i}-description`}
                autoComplete="off"
                value={field.description}
                maxLength={1000}
                onChange={(e) =>
                  setData((old) => ({ ...old, fields: old.fields.map((f, j) => (i === j ? { ...f, description: e.target.value } : f)) }))
                }
              />
            </label>
            <label>
              <span className="lbl">属性名（顿号分隔）</span>
              <input
                aria-label={`类别${i + 1}属性`}
                autoComplete="off"
                value={field.attributes.join("、")}
                maxLength={400}
                onChange={(e) =>
                  setData((old) => ({
                    ...old,
                    fields: old.fields.map((f, j) =>
                      i === j
                        ? { ...f, attributes: e.target.value.split(/[、,，]/).map((x) => x.trim()).filter(Boolean).slice(0, 12) }
                        : f,
                    ),
                  }))
                }
              />
            </label>
            <button
              aria-label={`移除类别${i + 1}`}
              className="icon-button"
              onClick={() => setData((old) => ({ ...old, fields: old.fields.filter((_, j) => i !== j) }))}
            >
              <X size={16} aria-hidden="true" />
            </button>
          </div>
        ))}
      </div>
      <div className="field-heading">
        <h3>Few-shot 示例 · {data.examples.length}</h3>
        <button
          disabled={data.examples.length >= 8}
          onClick={() =>
            setData((old) => ({
              ...old,
              examples: [...old.examples, { text: "", extractions: [{ extraction_class: classNames[0] ?? "", extraction_text: "", attributes: null }] }],
            }))
          }
        >
          <Plus size={15} aria-hidden="true" />
          添加示例
        </button>
      </div>
      {warnings.length > 0 && (
        <ul className="example-warnings" role="status">
          {warnings.map((w) => (
            <li key={w}>{w}</li>
          ))}
        </ul>
      )}
      {data.examples.map((ex, i) => (
        <article className="example-card" key={i}>
          <header>
            <span className="eyebrow">示例 {i + 1}</span>
            <button
              className="text-button"
              onClick={() => setData((old) => ({ ...old, examples: old.examples.filter((_, j) => j !== i) }))}
            >
              移除示例
            </button>
          </header>
          <label>
            示例原文
            <textarea
              aria-label={`示例${i + 1}原文`}
              value={ex.text}
              maxLength={10000}
              onChange={(e) => setExample(i, (x) => ({ ...x, text: e.target.value }))}
            />
          </label>
          <div className="example-rows">
            {ex.extractions.map((x, k) => (
              <div className="example-row" key={k}>
                <select
                  aria-label={`示例${i + 1}第${k + 1}条类别`}
                  value={x.extraction_class}
                  onChange={(e) =>
                    setExample(i, (old) => ({
                      ...old,
                      extractions: old.extractions.map((y, m) => (m === k ? { ...y, extraction_class: e.target.value } : y)),
                    }))
                  }
                >
                  {[...new Set([...classNames, x.extraction_class])].map((c) => (
                    <option key={c} value={c}>
                      {c || "（选择类别）"}
                    </option>
                  ))}
                </select>
                <input
                  aria-label={`示例${i + 1}第${k + 1}条片段`}
                  placeholder="原文逐字片段"
                  value={x.extraction_text}
                  maxLength={10000}
                  onChange={(e) =>
                    setExample(i, (old) => ({
                      ...old,
                      extractions: old.extractions.map((y, m) => (m === k ? { ...y, extraction_text: e.target.value } : y)),
                    }))
                  }
                />
                <input
                  key={attrLine(x.attributes)}
                  aria-label={`示例${i + 1}第${k + 1}条属性`}
                  placeholder="属性：用途=预付款; 含税=是"
                  defaultValue={attrLine(x.attributes)}
                  onBlur={(e) =>
                    setExample(i, (old) => ({
                      ...old,
                      extractions: old.extractions.map((y, m) => (m === k ? { ...y, attributes: parseAttrLine(e.target.value) } : y)),
                    }))
                  }
                />
                <button
                  className="icon-button"
                  aria-label={`移除示例${i + 1}第${k + 1}条`}
                  onClick={() => setExample(i, (old) => ({ ...old, extractions: old.extractions.filter((_, m) => m !== k) }))}
                >
                  <X size={15} aria-hidden="true" />
                </button>
              </div>
            ))}
            <button
              className="text-button"
              disabled={ex.extractions.length >= 50}
              onClick={() =>
                setExample(i, (old) => ({
                  ...old,
                  extractions: [...old.extractions, { extraction_class: classNames[0] ?? "", extraction_text: "", attributes: null }],
                }))
              }
            >
              <Plus size={14} aria-hidden="true" />
              添加片段
            </button>
          </div>
        </article>
      ))}
      <details className="json-source">
        <summary>示例 JSON 源码{examplesDraft !== null ? " · 有未应用草稿" : ""}</summary>
        <label>
          抽取示例 JSON
          <textarea
            className="code-editor"
            aria-label="抽取示例 JSON"
            name="examples-json"
            spellCheck={false}
            autoComplete="off"
            value={examplesDraft ?? JSON.stringify(data.examples, null, 2)}
            onChange={(e) => setExamplesDraft(e.target.value)}
          />
        </label>
        <div className="apply-row">
          <button
            onClick={() => {
              try {
                const next = decodeExamples(JSON.parse(examplesDraft ?? JSON.stringify(data.examples)));
                if (setData((old) => ({ ...old, examples: next }))) {
                  setExamplesDraft(null);
                  notice("示例已应用。");
                }
              } catch (e) {
                report(e);
              }
            }}
          >
            应用示例
          </button>
          {examplesDraft !== null && (
            <button className="text-button" onClick={() => setExamplesDraft(null)}>
              放弃草稿
            </button>
          )}
          <span>编辑中的 JSON 会保存为草稿；抽取使用已应用的示例。</span>
        </div>
      </details>
      <details className="json-source" onToggle={(e) => setShowPrompt((e.target as HTMLDetailsElement).open)}>
        <summary>提示词预览（当前资料第 1 段）</summary>
        <pre className="prompt-preview">{preview}</pre>
      </details>
    </section>
  );
}
