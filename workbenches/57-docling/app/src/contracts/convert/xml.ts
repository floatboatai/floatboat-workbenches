// ABOUTME: 面向 OOXML 的小型 XML 解析器（元素、属性、文本、实体、CDATA），Node 与浏览器同一实现。
export interface XmlNode {
  name: string;
  attrs: Record<string, string>;
  children: XmlNode[];
  /** Concatenated character data directly inside this element. */
  text: string;
}
const entities: Record<string, string> = { lt: "<", gt: ">", amp: "&", quot: '"', apos: "'" };
export function decodeEntities(s: string): string {
  return s.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (m, e: string) => {
    if (e[0] === "#") {
      const code = e[1] === "x" || e[1] === "X" ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10);
      return Number.isFinite(code) && code <= 0x10ffff ? String.fromCodePoint(code) : m;
    }
    return entities[e.toLowerCase()] ?? m;
  });
}
const attrPattern = /([^\s=/>]+)\s*=\s*("([^"]*)"|'([^']*)')/g;
export function parseXml(source: string): XmlNode {
  const root: XmlNode = { name: "#document", attrs: {}, children: [], text: "" };
  const stack = [root];
  let i = 0;
  const n = source.length;
  while (i < n) {
    const lt = source.indexOf("<", i);
    if (lt < 0) {
      stack[stack.length - 1]!.text += decodeEntities(source.slice(i));
      break;
    }
    if (lt > i) stack[stack.length - 1]!.text += decodeEntities(source.slice(i, lt));
    if (source.startsWith("<!--", lt)) {
      const end = source.indexOf("-->", lt + 4);
      i = end < 0 ? n : end + 3;
    } else if (source.startsWith("<![CDATA[", lt)) {
      const end = source.indexOf("]]>", lt + 9);
      stack[stack.length - 1]!.text += source.slice(lt + 9, end < 0 ? n : end);
      i = end < 0 ? n : end + 3;
    } else if (source[lt + 1] === "?" || source[lt + 1] === "!") {
      const end = source.indexOf(">", lt);
      i = end < 0 ? n : end + 1;
    } else if (source[lt + 1] === "/") {
      const end = source.indexOf(">", lt);
      const name = source.slice(lt + 2, end).trim();
      // Close the nearest matching element; tolerate stray closers.
      for (let k = stack.length - 1; k > 0; k--)
        if (stack[k]!.name === name) {
          stack.length = k;
          break;
        }
      i = end < 0 ? n : end + 1;
    } else {
      let end = lt + 1,
        quote = "";
      while (end < n) {
        const c = source[end]!;
        if (quote) {
          if (c === quote) quote = "";
        } else if (c === '"' || c === "'") quote = c;
        else if (c === ">") break;
        end++;
      }
      const raw = source.slice(lt + 1, end),
        selfClosing = raw.endsWith("/"),
        body = selfClosing ? raw.slice(0, -1) : raw,
        space = body.search(/\s/),
        name = space < 0 ? body : body.slice(0, space);
      const attrs: Record<string, string> = {};
      if (space >= 0) {
        attrPattern.lastIndex = 0;
        let m: RegExpExecArray | null;
        const rest = body.slice(space);
        while ((m = attrPattern.exec(rest))) attrs[m[1]!] = decodeEntities(m[3] ?? m[4] ?? "");
      }
      const node: XmlNode = { name, attrs, children: [], text: "" };
      stack[stack.length - 1]!.children.push(node);
      if (!selfClosing) stack.push(node);
      i = end + 1;
    }
  }
  return root;
}
export const child = (node: XmlNode | undefined, name: string) =>
  node?.children.find((c) => c.name === name);
export const childrenNamed = (node: XmlNode | undefined, name: string) =>
  node ? node.children.filter((c) => c.name === name) : [];
export function find(node: XmlNode | undefined, name: string): XmlNode | undefined {
  if (!node) return undefined;
  const stack = [...node.children].reverse();
  while (stack.length) {
    const next = stack.pop()!;
    if (next.name === name) return next;
    for (let k = next.children.length - 1; k >= 0; k--) stack.push(next.children[k]!);
  }
  return undefined;
}
