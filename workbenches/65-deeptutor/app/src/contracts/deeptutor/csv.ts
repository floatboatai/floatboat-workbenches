// Port of the parts of CPython 3.12 `csv` used by DeepTutor's importing.py:
// csv.Sniffer().sniff(sample, delimiters) and csv.reader with a sniffed,
// `excel` or `excel_tab` dialect (QUOTE_MINIMAL, no escapechar, strict=False).
// CPython is licensed under the PSF License Agreement; see notices/.
import { codePoints } from "./pycompat.ts";

export class CsvError extends Error {}
export interface Dialect {
  delimiter: string;
  quotechar: string;
  doublequote: boolean;
  skipinitialspace: boolean;
}
export const excel: Dialect = {
  delimiter: ",",
  quotechar: '"',
  doublequote: true,
  skipinitialspace: false,
};
export const excelTab: Dialect = { ...excel, delimiter: "\t" };

// Python `\w` in a str pattern: alphanumerics (str.isalnum) and underscore.
const W = "\\p{L}\\p{N}_";
// Python re.MULTILINE `^`/`$` only treat "\n" as a line boundary.
const BOL = "(?:(?<![\\s\\S])|(?<=\\n))";
const EOL = "(?=\\n|(?![\\s\\S]))";
const PATTERNS = [
  `(?<delim>[^${W}\\n"'])(?<space> ?)(?<quote>["'])[\\s\\S]*?\\k<quote>\\k<delim>`,
  `(?:${BOL}|\\n)(?<quote>["'])[\\s\\S]*?\\k<quote>(?<delim>[^${W}\\n"'])(?<space> ?)`,
  `(?<delim>[^${W}\\n"'])(?<space> ?)(?<quote>["'])[\\s\\S]*?\\k<quote>(?:${EOL}|\\n)`,
  `(?:${BOL}|\\n)(?<quote>["'])[\\s\\S]*?\\k<quote>(?:${EOL}|\\n)`,
];
const escapeRe = (s: string) => s.replace(/[\\^$.*+?()[\]{}|/-]/g, "\\$&");
/** Python's max(d, key=d.get): first key with the largest value. */
function argmax(map: Map<string, number>) {
  let best = "",
    value = -Infinity;
  for (const [k, v] of map)
    if (v > value) {
      best = k;
      value = v;
    }
  return best;
}
const count = (line: string, s: string) => line.split(s).length - 1;

function guessQuoteAndDelimiter(data: string, delimiters: string) {
  let matches: RegExpMatchArray[] = [],
    pattern = 0;
  for (; pattern < PATTERNS.length; pattern++) {
    matches = [...data.matchAll(new RegExp(PATTERNS[pattern], "gu"))];
    if (matches.length) break;
  }
  if (!matches.length)
    return { quotechar: "", doublequote: false, delimiter: "", skip: false };
  const quotes = new Map<string, number>(),
    delims = new Map<string, number>();
  let spaces = 0;
  const hasDelim = pattern < 3;
  for (const m of matches) {
    const g = m.groups!;
    if (g.quote) quotes.set(g.quote, (quotes.get(g.quote) ?? 0) + 1);
    if (!hasDelim) continue;
    if (g.delim && delimiters.includes(g.delim))
      delims.set(g.delim, (delims.get(g.delim) ?? 0) + 1);
    if (g.space) spaces++;
  }
  const quotechar = argmax(quotes);
  let delim = "",
    skip = false;
  if (delims.size) {
    delim = argmax(delims);
    skip = delims.get(delim) === spaces;
    if (delim === "\n") delim = "";
  }
  const d = escapeRe(delim);
  const dq = new RegExp(
    `((${d})|${BOL})[^${W}]*${quotechar}[^${d}\\n]*${quotechar}[^${d}\\n]*${quotechar}[^${W}]*((${d})|${EOL})`,
    "u",
  );
  return { quotechar, doublequote: dq.test(data), delimiter: delim, skip };
}

function guessDelimiter(text: string, delimiters: string) {
  const data = text.split("\n").filter((x) => x !== "");
  const ascii = Array.from({ length: 127 }, (_, i) => String.fromCharCode(i));
  const chunkLength = Math.min(10, data.length);
  let iteration = 0;
  const charFrequency = new Map<string, Map<number, number>>();
  const modes = new Map<string, [number, number]>();
  const delims = new Map<string, [number, number]>();
  let start = 0,
    end = chunkLength;
  const skipFor = (d: string) => count(data[0], d) === count(data[0], d + " ");
  while (start < data.length) {
    iteration++;
    for (const line of data.slice(start, end))
      for (const char of ascii) {
        const meta = charFrequency.get(char) ?? new Map<number, number>();
        const freq = count(line, char);
        meta.set(freq, (meta.get(freq) ?? 0) + 1);
        charFrequency.set(char, meta);
      }
    for (const [char, meta] of charFrequency) {
      const items = [...meta.entries()];
      if (items.length === 1 && items[0][0] === 0) continue;
      if (items.length > 1) {
        let mode = items[0];
        for (const item of items) if (item[1] > mode[1]) mode = item;
        const rest = items.filter((item) => item !== mode);
        modes.set(char, [mode[0], mode[1] - rest.reduce((s, i) => s + i[1], 0)]);
      } else modes.set(char, items[0]);
    }
    const total = Math.min(chunkLength * iteration, data.length);
    let consistency = 1.0;
    const threshold = 0.9;
    while (delims.size === 0 && consistency >= threshold) {
      for (const [k, v] of modes)
        if (v[0] > 0 && v[1] > 0 && v[1] / total >= consistency && delimiters.includes(k))
          delims.set(k, v);
      consistency -= 0.01;
    }
    if (delims.size === 1) {
      const delim = [...delims.keys()][0];
      return { delimiter: delim, skip: skipFor(delim) };
    }
    start = end;
    end += chunkLength;
  }
  if (!delims.size) return { delimiter: "", skip: false };
  for (const d of [",", "\t", ";", " ", ":"])
    if (delims.has(d)) return { delimiter: d, skip: skipFor(d) };
  const items = [...delims.entries()].sort(
    ([ka, a], [kb, b]) => a[0] - b[0] || a[1] - b[1] || (ka < kb ? -1 : ka > kb ? 1 : 0),
  );
  const delim = items[items.length - 1][0];
  return { delimiter: delim, skip: skipFor(delim) };
}

/** csv.Sniffer().sniff(sample, delimiters). Throws CsvError when undetermined. */
export function sniff(sample: string, delimiters: string): Dialect {
  let { quotechar, doublequote, delimiter, skip } = guessQuoteAndDelimiter(
    sample,
    delimiters,
  );
  if (!delimiter) ({ delimiter, skip } = guessDelimiter(sample, delimiters));
  if (!delimiter) throw new CsvError("Could not determine delimiter");
  return {
    delimiter,
    quotechar: quotechar || '"',
    doublequote,
    skipinitialspace: skip,
  };
}

const FIELD_LIMIT = 131072;
/** Lines of io.StringIO(content, newline=""): terminators kept, \r, \n or \r\n. */
function* lines(content: string) {
  const re = /[^\r\n]*(?:\r\n|\r|\n)|[^\r\n]+$/gy;
  let m: RegExpExecArray | null;
  while (re.lastIndex < content.length && (m = re.exec(content))) yield m[0];
}
/** csv.reader(io.StringIO(content, newline=""), dialect), yielding rows lazily. */
export function* reader(content: string, dialect: Dialect): Generator<string[]> {
  type State = "START_RECORD" | "START_FIELD" | "IN_FIELD" | "IN_QUOTED_FIELD" | "QUOTE_IN_QUOTED_FIELD" | "EAT_CRNL";
  const EOL_MARK = null;
  let state: State = "START_RECORD",
    fields: string[] = [],
    field: string[] = [];
  const save = () => {
    fields.push(field.join(""));
    field = [];
  };
  const add = (c: string) => {
    if (field.length >= FIELD_LIMIT)
      throw new CsvError(`field larger than field limit (${FIELD_LIMIT})`);
    field.push(c);
  };
  const { delimiter, quotechar, doublequote, skipinitialspace } = dialect;
  const nl = (c: string | null) => c === "\n" || c === "\r";
  function process(c: string | null) {
    switch (state) {
      case "START_RECORD":
        if (c === EOL_MARK) break;
        if (nl(c)) {
          state = "EAT_CRNL";
          break;
        }
        state = "START_FIELD";
      // falls through
      case "START_FIELD":
        if (nl(c) || c === EOL_MARK) {
          save();
          state = c === EOL_MARK ? "START_RECORD" : "EAT_CRNL";
        } else if (c === quotechar) state = "IN_QUOTED_FIELD";
        else if (c === " " && skipinitialspace) {
          // ignore spaces at start of field
        }
        else if (c === delimiter) save();
        else {
          add(c!);
          state = "IN_FIELD";
        }
        break;
      case "IN_FIELD":
        if (nl(c) || c === EOL_MARK) {
          save();
          state = c === EOL_MARK ? "START_RECORD" : "EAT_CRNL";
        } else if (c === delimiter) {
          save();
          state = "START_FIELD";
        } else add(c!);
        break;
      case "IN_QUOTED_FIELD":
        if (c === EOL_MARK) {
          // quoted fields continue across lines
        }
        else if (c === quotechar) state = doublequote ? "QUOTE_IN_QUOTED_FIELD" : "IN_FIELD";
        else add(c);
        break;
      case "QUOTE_IN_QUOTED_FIELD":
        if (c === quotechar) {
          add(c);
          state = "IN_QUOTED_FIELD";
        } else if (c === delimiter) {
          save();
          state = "START_FIELD";
        } else if (nl(c) || c === EOL_MARK) {
          save();
          state = c === EOL_MARK ? "START_RECORD" : "EAT_CRNL";
        } else {
          add(c);
          state = "IN_FIELD";
        }
        break;
      case "EAT_CRNL":
        if (nl(c)) {
          // swallow the rest of the line terminator
        }
        else if (c === EOL_MARK) state = "START_RECORD";
        else
          throw new CsvError(
            "new-line character seen in unquoted field - do you need to open the file with newline=''?",
          );
        break;
    }
  }
  const source = lines(content);
  for (;;) {
    // parse_reset(): every record starts from START_RECORD.
    state = "START_RECORD";
    fields = [];
    field = [];
    for (;;) {
      const next = source.next();
      if (next.done) {
        if (field.length !== 0 || (state as State) === "IN_QUOTED_FIELD") {
          save();
          break;
        }
        return;
      }
      for (const c of codePoints(next.value)) process(c);
      process(EOL_MARK);
      if (state === "START_RECORD") break;
    }
    const row = fields;
    fields = [];
    yield row;
  }
}
