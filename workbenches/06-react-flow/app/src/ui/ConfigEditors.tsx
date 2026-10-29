// ABOUTME: 按节点配置结构生成的编辑表单：列选择、条件构建器、字段映射、聚合列表、正则标志与模板字段插入。
import { Plus, X } from "lucide-react";
import { useId } from "react";
import { unsafePatternReason } from "../contracts/expressions";
import { spec, type Field, type OpKind } from "../contracts/ops";
import { optionLabels } from "./describe";

type Widget = "textarea" | "code" | "column" | "flags" | "hidden" | "pattern" | "template";
interface Meta {
  label: string;
  widget?: Widget;
  port?: string;
  hint?: string;
  placeholder?: string;
  /** 仅当另一字段为这些值时显示。 */
  when?: [string, string[]];
}

const META: Record<string, Meta> = {
  "textInput.text": { label: "文本内容", widget: "textarea" },
  "csvInput.csv": { label: "CSV 内容", widget: "code", hint: "第一行为列名；支持引号、引号内换行。" },
  "csvInput.delimiter": { label: "分隔符" },
  "csvInput.header": { label: "第一行是列名" },
  "csvInput.inferNumbers": { label: "把数字识别为数值（保留 007 这类编号）" },
  "jsonInput.json": { label: "JSON 内容", widget: "code" },
  "textTransform.mode": { label: "处理方式" },
  "textTransform.value": { label: "附加文本", when: ["mode", ["prefix", "suffix"]] },
  "splitLines.column": { label: "列名" },
  "splitLines.trim": { label: "去掉每行首尾空白" },
  "splitLines.skipEmpty": { label: "跳过空行" },
  "splitLines.addIndex": { label: "添加原始行号列" },
  "regexExtract.pattern": { label: "正则表达式", widget: "pattern", hint: "用命名分组 (?<列名>…) 生成列；未命名分组生成 组1、组2…", placeholder: "(?<代码>E\\d+)" },
  "regexExtract.flags": { label: "标志", widget: "flags" },
  "regexExtract.column": { label: "要匹配的列（输入为表格时）", widget: "column", port: "in" },
  "regexExtract.keepUnmatched": { label: "保留未匹配的行（表格输入）" },
  "regexReplace.pattern": { label: "正则表达式", widget: "pattern" },
  "regexReplace.flags": { label: "标志", widget: "flags" },
  "regexReplace.replacement": { label: "替换为", hint: "$1、$<名称> 引用分组；$& 为整段匹配。" },
  "regexReplace.column": { label: "要替换的列（输入为表格时）", widget: "column", port: "in" },
  "template.template": { label: "模板", widget: "template", hint: "{{列名}} 填入该行的值，{{#}} 为行号。" },
  "template.separator": { label: "行间分隔符", hint: "\\n 表示换行" },
  "template.header": { label: "开头文字（可选）" },
  "jsonPick.path": { label: "JSON 路径", hint: "例：$.data.items、items[0].name、$.list[*].id", placeholder: "$.data.items" },
  "jsonPick.as": { label: "输出为" },
  "filter.mode": { label: "条件组合" },
  "filter.conditions": { label: "条件" },
  "filter.conditions.column": { label: "列", widget: "column", port: "in" },
  "filter.conditions.op": { label: "比较" },
  "filter.conditions.value": { label: "值", when: ["op", ["eq", "neq", "gt", "gte", "lt", "lte", "contains", "notContains", "startsWith", "endsWith", "matches"]] },
  "mapFields.keepOthers": { label: "保留未列出的其它列" },
  "mapFields.fields": { label: "字段" },
  "mapFields.fields.from": { label: "来源列或 {{模板}}", widget: "column", port: "in" },
  "mapFields.fields.to": { label: "新列名" },
  "mapFields.fields.cast": { label: "类型" },
  "sort.keys": { label: "排序列（按顺序优先）" },
  "sort.keys.column": { label: "列", widget: "column", port: "in" },
  "sort.keys.direction": { label: "方向" },
  "dedupe.columns": { label: "按这些列判断重复（不选则整行）", port: "in" },
  "dedupe.keep": { label: "重复时" },
  "group.by": { label: "分组列（不选则全部合为一组）", port: "in" },
  "group.aggregations": { label: "汇总" },
  "group.aggregations.op": { label: "方式" },
  "group.aggregations.column": { label: "列", widget: "column", port: "in", when: ["op", ["sum", "avg", "min", "max", "distinct"]] },
  "group.aggregations.as": { label: "结果列名" },
  "join.leftKey": { label: "左表关联列", widget: "column", port: "left" },
  "join.rightKey": { label: "右表关联列（为空则同名）", widget: "column", port: "right" },
  "join.kind": { label: "关联方式" },
  "join.rightPrefix": { label: "右表列名前缀（可选）" },
  "concat.sourceColumn": { label: "来源标记列（可选）", placeholder: "例如：来源" },
  "concat.labelA": { label: "A 的标记" },
  "concat.labelB": { label: "B 的标记" },
  "concat.separator": { label: "文本之间的分隔符", hint: "\\n 表示换行" },
  "chartOutput.label": { label: "标签列", widget: "column", port: "in" },
  "chartOutput.value": { label: "数值列", widget: "column", port: "in" },
  "chartOutput.limit": { label: "最多显示条数" },
  "chartOutput.order": { label: "排序" },
  "fileOutput.format": { label: "文件格式" },
  "fileOutput.fileName": { label: "文件名" },
};
const hidden = new Set(["textInput.fileName", "csvInput.fileName", "jsonInput.fileName"]);

type Config = Record<string, unknown>;

function ColumnInput({ id, value, columns, onChange, placeholder }: { id: string; value: string; columns: string[]; onChange: (v: string) => void; placeholder?: string }) {
  const list = id + "-columns";
  return (
    <>
      <input id={id} list={list} value={value} autoComplete="off" spellCheck={false} placeholder={placeholder ?? (columns[0] ? `例如 ${columns[0]}` : "运行后可选择列")} onChange={(e) => onChange(e.target.value)} />
      <datalist id={list}>
        {columns.map((column) => (
          <option key={column} value={column} />
        ))}
      </datalist>
    </>
  );
}

function FieldInput({ path, field, value, onChange, columns, scope }: { path: string; field: Field; value: unknown; onChange: (v: unknown) => void; columns: Record<string, string[]>; scope: Config }) {
  const id = useId();
  const meta = META[path] ?? { label: path.split(".").at(-1)! };
  if (meta.when && !meta.when[1].includes(String(scope[meta.when[0]]))) return null;
  const known = columns[meta.port ?? "in"] ?? [];
  const key = path.split(".").at(-1)!;
  if (field.kind === "bool")
    return (
      <label className="check">
        <input type="checkbox" checked={value === true} onChange={(e) => onChange(e.target.checked)} />
        {meta.label}
      </label>
    );
  let control;
  if (field.kind === "enum")
    control = (
      <select id={id} value={String(value)} onChange={(e) => onChange(e.target.value)}>
        {field.values.map((option) => (
          <option key={option} value={option}>
            {optionLabels[key]?.[option] ?? option}
          </option>
        ))}
      </select>
    );
  else if (field.kind === "int")
    control = <input id={id} type="number" inputMode="numeric" min={field.min} max={field.max} value={Number(value)} onChange={(e) => onChange(Math.min(field.max, Math.max(field.min, Math.round(Number(e.target.value) || field.min))))} />;
  else if (field.kind === "strings") {
    const chosen = Array.isArray(value) ? (value as string[]) : [];
    const all = [...known, ...chosen.filter((c) => !known.includes(c))];
    control = all.length ? (
      <div className="chips" role="group" aria-label={meta.label}>
        {all.map((column) => (
          <label key={column} className="chip">
            <input type="checkbox" checked={chosen.includes(column)} onChange={(e) => onChange(e.target.checked ? [...chosen, column] : chosen.filter((c) => c !== column))} />
            {column}
          </label>
        ))}
      </div>
    ) : (
      <p className="muted">运行一次后可在这里勾选列。</p>
    );
  } else if (field.kind === "list") return <ListEditor path={path} field={field} value={value} onChange={onChange} columns={columns} label={meta.label} />;
  else {
    const text = typeof value === "string" ? value : "";
    const set = (v: string) => onChange(v.slice(0, field.max));
    if (meta.widget === "flags")
      control = (
        <div className="chips" role="group" aria-label="正则标志">
          {[
            ["i", "忽略大小写"],
            ["m", "多行 ^$"],
            ["s", ". 含换行"],
          ].map(([flag, label]) => (
            <label key={flag} className="chip">
              <input type="checkbox" checked={text.includes(flag)} onChange={(e) => onChange(e.target.checked ? text + flag : text.replace(flag, ""))} />
              {flag} · {label}
            </label>
          ))}
        </div>
      );
    else if (meta.widget === "column") control = <ColumnInput id={id} value={text} columns={known} onChange={set} placeholder={meta.placeholder} />;
    else if (meta.widget === "textarea" || meta.widget === "code" || meta.widget === "template")
      control = (
        <>
          <textarea id={id} translate={meta.widget === "code" ? "no" : undefined} className={meta.widget === "code" ? "code" : ""} value={text} spellCheck={false} maxLength={field.max} rows={meta.widget === "template" ? 4 : 10} onChange={(e) => set(e.target.value)} />
          {meta.widget === "template" && known.length ? (
            <div className="chips insert" aria-label="插入字段">
              {["#", ...known].map((column) => (
                <button type="button" key={column} className="chip" onClick={() => set(text + `{{${column}}}`)}>
                  {`{{${column}}}`}
                </button>
              ))}
            </div>
          ) : null}
        </>
      );
    else control = <input id={id} value={text} autoComplete="off" spellCheck={false} maxLength={field.max} placeholder={meta.placeholder} className={meta.widget === "pattern" ? "code" : ""} translate={meta.widget === "pattern" ? "no" : undefined} onChange={(e) => set(e.target.value)} />;
    if (meta.widget === "pattern") {
      const reason = text ? unsafePatternReason(text) : null;
      let invalid = "";
      if (text && !reason)
        try {
          new RegExp(text);
        } catch (error) {
          invalid = error instanceof Error ? error.message : "正则无效";
        }
      if (reason || invalid)
        control = (
          <>
            {control}
            <p className="field-error" role="alert">
              {reason || invalid}
            </p>
          </>
        );
    }
  }
  return (
    <div className="field">
      <label htmlFor={id}>{meta.label}</label>
      {control}
      {meta.hint ? <p className="hint">{meta.hint}</p> : null}
    </div>
  );
}

function ListEditor({ path, field, value, onChange, columns, label }: { path: string; field: Extract<Field, { kind: "list" }>; value: unknown; onChange: (v: unknown) => void; columns: Record<string, string[]>; label: string }) {
  const items = Array.isArray(value) ? (value as Config[]) : [];
  const blank = () => Object.fromEntries(Object.entries(field.item).map(([k, f]) => [k, f.kind === "bool" ? f.default : f.kind === "strings" || f.kind === "list" ? [] : f.default]));
  return (
    <fieldset className="list-editor">
      <legend>{label}</legend>
      {items.map((item, index) => (
        <div className="list-item" key={index}>
          {Object.entries(field.item).map(([key, inner]) => (
            <FieldInput
              key={key}
              path={`${path}.${key}`}
              field={inner}
              value={item[key]}
              scope={item}
              columns={columns}
              onChange={(v) => onChange(items.map((current, i) => (i === index ? { ...current, [key]: v } : current)))}
            />
          ))}
          <button type="button" className="icon-button" aria-label={`删除第 ${index + 1} 项`} onClick={() => onChange(items.filter((_, i) => i !== index))}>
            <X aria-hidden="true" size={14} />
          </button>
        </div>
      ))}
      <button type="button" className="add-item" disabled={items.length >= field.max} onClick={() => onChange([...items, blank()])}>
        <Plus aria-hidden="true" size={13} />
        添加
      </button>
    </fieldset>
  );
}

export function ConfigEditor({ op, config, onChange, columns }: { op: OpKind; config: Config; onChange: (key: string, value: unknown) => void; columns: Record<string, string[]> }) {
  return (
    <div className="config-editor">
      {Object.entries(spec(op).config).map(([key, field]) =>
        hidden.has(`${op}.${key}`) ? null : (
          <FieldInput key={key} path={`${op}.${key}`} field={field} value={config[key]} scope={config} columns={columns} onChange={(value) => onChange(key, value)} />
        ),
      )}
    </div>
  );
}
