// ABOUTME: 基于官方 schema 与当前数据集的编辑器辅助：属性名/取值补全（含字段名、数据集名）与属性说明悬停提示。
import type { Completion, CompletionContext, CompletionResult } from "@codemirror/autocomplete";
import { syntaxTree } from "@codemirror/language";
import type { EditorState } from "@codemirror/state";
import { hoverTooltip, type EditorView } from "@codemirror/view";
import type { SyntaxNode } from "@lezer/common";
import { fieldTypeLabel, type DatasetRef } from "../contracts/datasets";
import { isRecord } from "../contracts/project";

type Schema = Record<string, unknown>;
type Segment = string | number;
export interface AssistSource {
  schema: Schema | null;
  datasets: DatasetRef[];
}

const VALUE_NODES = new Set(["String", "Number", "True", "False", "Null", "Object", "Array", "⚠"]);
function nameOf(property: SyntaxNode, state: EditorState): string | null {
  const name = property.getChild("PropertyName");
  if (!name) return null;
  const raw = state.sliceDoc(name.from, name.to);
  try {
    const value: unknown = JSON.parse(raw);
    return typeof value === "string" ? value : null;
  } catch {
    return raw.replace(/^"|"$/g, "");
  }
}
/** 从语法节点向上求 JSON 路径（不含节点自身作为属性名的情况）。 */
function pathOf(node: SyntaxNode, state: EditorState): Segment[] {
  const path: Segment[] = [];
  let current: SyntaxNode = node;
  while (current.parent) {
    const parent: SyntaxNode = current.parent;
    if (parent.name === "Property" && current.name !== "PropertyName") {
      const name = nameOf(parent, state);
      if (name !== null) path.unshift(name);
    } else if (parent.name === "Array") {
      let index = 0;
      for (let child = parent.firstChild; child && child.from < current.from; child = child.nextSibling)
        if (VALUE_NODES.has(child.name)) index++;
      path.unshift(index);
    }
    current = parent;
  }
  return path;
}

function definitions(schema: Schema): Schema {
  return isRecord(schema.definitions) ? schema.definitions : {};
}
function expand(root: Schema, value: unknown, depth = 0, out: Schema[] = []): Schema[] {
  if (!isRecord(value) || depth > 14) return out;
  if (typeof value.$ref === "string") {
    const target = definitions(root)[value.$ref.replace("#/definitions/", "")];
    expand(root, target, depth + 1, out);
  } else out.push(value);
  for (const key of ["anyOf", "oneOf", "allOf"])
    if (Array.isArray(value[key])) for (const item of value[key] as unknown[]) expand(root, item, depth + 1, out);
  return out;
}
/** 沿路径求出可能的子 schema（anyOf 分支取并集）。 */
function schemasAt(root: Schema, path: Segment[]): Schema[] {
  let current = expand(root, root);
  for (const segment of path) {
    const next: Schema[] = [];
    for (const schema of current) {
      if (typeof segment === "number") {
        if (isRecord(schema.items)) next.push(...expand(root, schema.items));
      } else if (isRecord(schema.properties) && isRecord(schema.properties[segment]))
        next.push(...expand(root, schema.properties[segment]));
      else if (isRecord(schema.additionalProperties)) next.push(...expand(root, schema.additionalProperties));
    }
    current = next;
    if (!current.length) break;
  }
  return current;
}
function propertyEntries(root: Schema, path: Segment[]): Map<string, Schema> {
  const map = new Map<string, Schema>();
  for (const schema of schemasAt(root, path))
    if (isRecord(schema.properties))
      for (const [key, value] of Object.entries(schema.properties))
        if (!map.has(key) && isRecord(value)) map.set(key, value);
  return map;
}
function describe(root: Schema, entry: Schema): { description: string; type: string } {
  let description = typeof entry.description === "string" ? entry.description : "";
  const types = new Set<string>();
  for (const schema of expand(root, entry)) {
    if (!description && typeof schema.description === "string") description = schema.description;
    if (typeof schema.type === "string") types.add(schema.type);
    if (Array.isArray(schema.type)) schema.type.forEach((t) => types.add(String(t)));
    if (Array.isArray(schema.enum) || schema.const !== undefined) types.add("enum");
  }
  const clean = description
    .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")
    .replace(/__([^_]+)__/g, "$1")
    .replace(/`([^`]+)`/g, "$1")
    .split(/\n\s*\n/)[0]
    .trim();
  return { description: clean.length > 420 ? clean.slice(0, 417) + "…" : clean, type: [...types].slice(0, 4).join(" | ") };
}
function existingKeys(object: SyntaxNode, state: EditorState): Set<string> {
  const keys = new Set<string>();
  for (let child = object.firstChild; child; child = child.nextSibling)
    if (child.name === "Property") {
      const name = nameOf(child, state);
      if (name !== null) keys.add(name);
    }
  return keys;
}
const quote = (text: string) => JSON.stringify(text);

export function schemaCompletion(source: () => AssistSource) {
  return (context: CompletionContext): CompletionResult | null => {
    const { schema, datasets } = source();
    const { state, pos } = context;
    const node = syntaxTree(state).resolveInner(pos, -1);
    const word = context.matchBefore(/"?[^"\s:,{}[\]]*"?$/);
    // —— 属性名补全 ——
    let object: SyntaxNode | null = null;
    let from = pos;
    let to = pos;
    if (node.name === "PropertyName" && node.parent?.parent?.name === "Object") {
      object = node.parent.parent;
      from = node.from;
      to = node.to;
    } else if (node.name === "Object" || ((node.name === "{" || node.name === ",") && node.parent?.name === "Object")) {
      object = node.name === "Object" ? node : node.parent;
    } else if (node.name === "String" && node.parent?.name === "Object") {
      object = node.parent;
      from = node.from;
      to = node.to;
    } else if (node.name === "⚠" && node.parent?.name === "Object") {
      object = node.parent;
      from = word?.from ?? pos;
    }
    if (object) {
      if (!schema) return null;
      if (!context.explicit && from === pos && !word?.text) {
        /* 仅在显式触发或已开始输入时弹出 */
        if (!(node.name === "{" || node.name === "," || node.name === "Object")) return null;
      }
      const path = pathOf(object, state);
      const taken = existingKeys(object, state);
      const after = state.sliceDoc(to, to + 3);
      const needsColon = !/^\s*:/.test(after);
      const options: Completion[] = [];
      for (const [key, entry] of propertyEntries(schema, path)) {
        if (taken.has(key) && !(from < pos)) continue;
        const info = describe(schema, entry);
        options.push({
          label: quote(key),
          displayLabel: key,
          type: "property",
          detail: info.type,
          info: info.description || undefined,
          apply: quote(key) + (needsColon ? ": " : ""),
          boost: ["mark", "encoding", "data", "x", "y", "color", "field", "type", "layer", "transform"].includes(key) ? 2 : 0,
        });
      }
      return options.length ? { from, to, options, validFor: /^"?[^"]*"?$/ } : null;
    }
    // —— 取值补全 ——
    let valueNode: SyntaxNode | null = null;
    if (VALUE_NODES.has(node.name) && node.name !== "Object" && node.name !== "Array") valueNode = node;
    let path: Segment[] | null = null;
    if (valueNode && (valueNode.parent?.name === "Property" || valueNode.parent?.name === "Array")) {
      path = pathOf(valueNode, state);
      from = valueNode.from;
      to = valueNode.to;
    } else if (node.name === ":" && node.parent?.name === "Property") {
      const name = nameOf(node.parent, state);
      if (name !== null) path = [...pathOf(node.parent, state), name];
    } else if (node.name === "Property") {
      const name = nameOf(node, state);
      if (name !== null) path = [...pathOf(node, state), name];
    } else if ((node.name === "[" || node.name === ",") && node.parent?.name === "Array") {
      path = [...pathOf(node.parent, state), 0];
    }
    if (!path) return null;
    if (!context.explicit && from === pos && node.name !== ":") return null;
    const options: Completion[] = [];
    const last = path[path.length - 1];
    const parentKey = path[path.length - 2];
    if (last === "field" || (typeof last === "number" && (parentKey === "groupby" || parentKey === "fields"))) {
      const seen = new Set<string>();
      for (const dataset of datasets)
        for (const column of dataset.columns)
          if (!seen.has(column.name)) {
            seen.add(column.name);
            options.push({
              label: quote(column.name),
              displayLabel: column.name,
              type: "variable",
              detail: `${fieldTypeLabel[column.type]} · ${dataset.name}`,
              boost: 3,
            });
          }
    }
    if (last === "name" && parentKey === "data")
      for (const dataset of datasets)
        options.push({ label: quote(dataset.name), displayLabel: dataset.name, type: "constant", detail: `${dataset.rows} 行`, boost: 3 });
    if (schema) {
      const seen = new Set<string>();
      for (const candidate of schemasAt(schema, path)) {
        const values = Array.isArray(candidate.enum) ? candidate.enum : candidate.const !== undefined ? [candidate.const] : [];
        for (const value of values) {
          const label = JSON.stringify(value);
          if (seen.has(label)) continue;
          seen.add(label);
          options.push({ label, displayLabel: String(value), type: "enum" });
        }
        if (candidate.type === "boolean" && !seen.has("true")) {
          seen.add("true");
          options.push({ label: "true", type: "keyword" }, { label: "false", type: "keyword" });
        }
      }
    }
    return options.length ? { from, to, options, validFor: /^"?[^"]*"?$/ } : null;
  };
}

export function schemaHover(source: () => AssistSource) {
  return hoverTooltip((view: EditorView, pos: number, side) => {
    const { schema } = source();
    if (!schema) return null;
    const node = syntaxTree(view.state).resolveInner(pos, side);
    if (node.name !== "PropertyName" || node.parent?.name !== "Property") return null;
    const key = nameOf(node.parent, view.state);
    if (key === null) return null;
    const entry = propertyEntries(schema, pathOf(node.parent, view.state)).get(key);
    if (!entry) return null;
    const info = describe(schema, entry);
    if (!info.description && !info.type) return null;
    return {
      pos: node.from,
      end: node.to,
      above: true,
      create() {
        const dom = document.createElement("div");
        dom.className = "schema-hover";
        const title = document.createElement("strong");
        title.textContent = key;
        const type = document.createElement("code");
        type.textContent = info.type;
        const text = document.createElement("p");
        text.textContent = info.description || "（schema 中没有说明）";
        dom.append(title, " ", type, text);
        return { dom };
      },
    };
  });
}
