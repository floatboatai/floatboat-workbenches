/* SPDX-License-Identifier: GPL-2.0-or-later
 * Element policy for the embedded CircuitJS1 engine.  Pure functions: the bridge supplies the
 * engine's own dump-type maps, tests supply small fixtures.  Every element class registered by
 * upstream is enabled except the ones below, each with the reason it is withheld. */

/** Classes that are never constructed: placing, loading, pasting or example-opening is refused. */
export const BLOCKED_ELEMENTS = Object.freeze({
  AudioInputElm: '音频输入会读取本机音频文件并用 Web Audio 解码作为信号源；本工作台不读取本机文件或音频输入。',
  DataInputElm: '数据输入会读取本机 CSV/文本文件作为信号源；本工作台不在引擎内读取本机文件。',
  DataRecorderElm: '数据导出元件只能把采样写成浏览器下载文件；嵌入引擎没有下载权限，记录会静默丢失。',
});

export const BLOCKED_LABELS = Object.freeze({
  AudioInputElm: '音频输入', DataInputElm: '数据输入', DataRecorderElm: '数据导出',
});

/** Classes that load and simulate normally but have no rack button, with the reason. */
export const RACK_OMITTED = Object.freeze({
  ExtVoltageElm: '电压只能由页面外部脚本通过 CircuitJS JS 接口设置；本工作台不提供脚本宿主。含此元件的电路仍可打开。',
  SubcircuitElm: '通用子电路实例需要先定义子电路模型；文件中自带模型的子电路可正常打开，内置 LM317 / TL431 在元件库中。',
  AudioOutputElm: '音频输出只在原生侧栏的「Play Audio」按钮下发声，嵌入时不显示该按钮：电路照常仿真但不发声。含此元件的 13 个官方滤波/振荡示例可正常打开。',
  ScopeElm: '画布内嵌示波器由浮动示波器入口创建（尚未开放）；含此元件的电路仍可打开与运行。',
});

/** Non-element mouse modes that the bridge accepts as tools. */
export const MOUSE_MODES = Object.freeze(['Select', 'DragAll', 'DragRow', 'DragColumn', 'DragSelected', 'DragPost']);

/** XML children of <cir> that carry models, scopes, sliders or hints rather than elements. */
export const NON_ELEMENT_XML = Object.freeze(['o', 'dm', 'rlm', 'tm', 'mm', 'clm', 'ccm', 'h', 'adj', 'test', 'switchevent', 'scopedata']);

export const MAX_SOURCE_CHARS = 650000;
export const MAX_ENTRIES = 4000;

const CODE = c => c.charCodeAt(0);
const TEXT_SPECIAL = new Set(['o', 'h', '$', '!', '%', '?', 'B', '.'].map(CODE));
const TEXT_NUMERIC_SPECIAL = new Set([32, 34, 38]);

function emptyResult() {
  return { entries: 0, classes: {}, unknown: [], blocked: [], library: false };
}
function count(result, cls) {
  result.entries++;
  result.classes[cls] = (result.classes[cls] ?? 0) + 1;
  if (BLOCKED_ELEMENTS[cls] && !result.blocked.includes(cls)) result.blocked.push(cls);
}
function unknown(result, type) {
  if (result.unknown.length < 12 && !result.unknown.includes(type)) result.unknown.push(type);
}

/** Classify a legacy text dump using the engine's numeric dump-type map (Map<number,string>). */
export function checkTextSource(source, dumpTypeMap) {
  const result = emptyResult();
  for (const raw of String(source).split(/\r?\n|\r/)) {
    const tokens = raw.split(/[ +\t\n\r\f]+/).filter(Boolean);
    if (!tokens.length) continue;
    const type = tokens[0];
    let tint = CODE(type);
    if (TEXT_SPECIAL.has(tint)) {
      // Text-format subcircuit models list their parts by class name.
      if (type === '.') for (const t of tokens) if (BLOCKED_ELEMENTS[t] && !result.blocked.includes(t)) result.blocked.push(t);
      continue;
    }
    if (tint >= 48 && tint <= 57) tint = Number.parseInt(type, 10);
    if (TEXT_NUMERIC_SPECIAL.has(tint)) continue;
    const cls = tint === CODE('n') ? 'NoiseElm' : dumpTypeMap.get(tint);
    if (!cls) { unknown(result, type); continue; }
    count(result, cls);
  }
  return result;
}

/** Classify a parsed XML circuit document using the engine's XML tag map (Map<string,string>). */
export function checkXmlDocument(doc, xmlDumpTypeMap) {
  const result = emptyResult();
  const root = doc.documentElement;
  if (!root || root.tagName !== 'cir' || doc.getElementsByTagName('parsererror').length) {
    result.invalid = true;
    return result;
  }
  if (root.getAttribute('sublib') === '1') result.library = true;
  for (const node of Array.from(root.children)) {
    const tag = node.tagName;
    if (NON_ELEMENT_XML.includes(tag)) {
      if (tag === 'ccm') for (const inner of Array.from(node.getElementsByTagName('*'))) {
        const cls = xmlDumpTypeMap.get(inner.tagName);
        if (cls && BLOCKED_ELEMENTS[cls] && !result.blocked.includes(cls)) result.blocked.push(cls);
      }
      continue;
    }
    if (node.getAttribute('x') == null) continue; // upstream ignores position-less tags
    const cls = xmlDumpTypeMap.get(tag);
    if (!cls) { unknown(result, tag); continue; }
    count(result, cls);
  }
  return result;
}

/** Human message for a check result; empty string means the circuit can be opened. */
export function describeCheck(result, labelFor = cls => BLOCKED_LABELS[cls] ?? cls) {
  if (result.invalid) return 'CircuitJS XML 格式无效，原文仍保留。';
  if (result.library) return '这是子电路库文件（只含模型），不是可运行的电路；原文仍保留。';
  if (result.entries > MAX_ENTRIES) return `电路含 ${result.entries} 个元件，超过 ${MAX_ENTRIES} 个的安全上限；原文仍保留，请拆分电路。`;
  if (result.blocked.length) return `含有本工作台不开放的元件：${result.blocked.map(cls => `${labelFor(cls)}（${BLOCKED_ELEMENTS[cls]}）`).join('；')} 原文仍保留。`;
  if (result.unknown.length) return `含有 CircuitJS1 不识别的条目类型：${result.unknown.join('、')}。原文仍保留，可在实验簿文本页核对。`;
  return '';
}
