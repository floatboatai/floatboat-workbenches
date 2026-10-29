// ABOUTME: 严格扫描 JSON 文本，给出首个语法错误的字符位置。
class Located {
  offset: number;
  message: string;
  constructor(offset: number, message: string) {
    this.offset = offset;
    this.message = message;
  }
}
/** 只在 JSON.parse 失败时调用，以获得可跳转的行列。 */
export function locateJsonError(text: string): { offset: number; message: string } {
  let index = 0;
  const fail = (message: string): never => {
    throw new Located(index, message);
  };
  const space = () => {
    while (index < text.length && " \t\n\r".includes(text[index])) index++;
  };
  const literal = (word: string) => {
    if (text.startsWith(word, index)) index += word.length;
    else fail("无法识别的值");
  };
  const string = () => {
    index++;
    while (index < text.length) {
      const char = text[index];
      if (char === '"') {
        index++;
        return;
      }
      if (char === "\\") {
        const next = text[index + 1];
        if (next === "u") {
          if (!/^[0-9a-fA-F]{4}$/.test(text.slice(index + 2, index + 6)))
            fail("\\u 转义需要 4 位十六进制");
          index += 6;
        } else if ('"\\/bfnrt'.includes(next ?? "")) index += 2;
        else fail("无效的转义字符");
        continue;
      }
      if (char.charCodeAt(0) < 32) fail("字符串中包含未转义的换行或控制字符");
      index++;
    }
    fail("字符串缺少结束引号");
  };
  const number = () => {
    const match = /^-?(?:0|[1-9]\d*)(?:\.\d+)?(?:[eE][+-]?\d+)?/.exec(
      text.slice(index, index + 400),
    );
    if (!match) fail("无效的数字");
    index += match![0].length;
  };
  const value = (depth: number): void => {
    if (depth > 512) fail("嵌套层级过深");
    space();
    const char = text[index];
    if (char === "{") {
      index++;
      space();
      if (text[index] === "}") {
        index++;
        return;
      }
      for (;;) {
        space();
        if (text[index] !== '"') fail("属性名需要使用双引号");
        string();
        space();
        if (text[index] !== ":") fail("属性名后缺少冒号");
        index++;
        value(depth + 1);
        space();
        if (text[index] === ",") {
          const comma = index++;
          space();
          if (text[index] === "}") {
            index = comma;
            fail("对象末尾多了逗号");
          }
          continue;
        }
        if (text[index] === "}") {
          index++;
          return;
        }
        fail("属性之间缺少逗号或对象缺少 }");
      }
    }
    if (char === "[") {
      index++;
      space();
      if (text[index] === "]") {
        index++;
        return;
      }
      for (;;) {
        value(depth + 1);
        space();
        if (text[index] === ",") {
          const comma = index++;
          space();
          if (text[index] === "]") {
            index = comma;
            fail("数组末尾多了逗号");
          }
          continue;
        }
        if (text[index] === "]") {
          index++;
          return;
        }
        fail("数组元素之间缺少逗号或数组缺少 ]");
      }
    }
    if (char === '"') return string();
    if (char === "-" || (char >= "0" && char <= "9")) return number();
    if (char === "t") return literal("true");
    if (char === "f") return literal("false");
    if (char === "n") return literal("null");
    if (char === undefined) fail("内容意外结束");
    fail("无法识别的字符 " + JSON.stringify(char));
  };
  try {
    value(0);
    space();
    if (index < text.length) fail("JSON 根值之后还有多余内容");
  } catch (error) {
    if (error instanceof Located) return { offset: error.offset, message: error.message };
    throw error;
  }
  return { offset: 0, message: "JSON 格式错误" };
}

