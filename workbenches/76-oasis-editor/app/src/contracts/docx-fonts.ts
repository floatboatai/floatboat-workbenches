import { unzipSync, zipSync, strFromU8, strToU8 } from "fflate";
export function ooxmlFont(value: string) {
  return (
    value
      .replace(/&quot;|&apos;|["'\\]/g, "")
      .split(",")
      .map((x) => x.trim())
      .find(
        (x) =>
          x &&
          !/^(sans-serif|serif|monospace|system-ui|cursive|fantasy)$/i.test(x),
      ) || "Calibri"
  );
}
/** OOXML requires one typeface, never a CSS fallback list. Preserve an existing East Asian face. */
export function normalizeDocxFonts(bytes: Uint8Array) {
  const parts = unzipSync(bytes);
  for (const [path, data] of Object.entries(parts)) {
    if (!path.startsWith("word/") || !path.endsWith(".xml")) continue;
    const xml = strFromU8(data);
    const updated = xml.replace(/<w:rFonts\b[^>]*\/?\s*>/g, (tag) => {
      let clean = tag.replace(
        /w:(ascii|hAnsi|cs)="([^"]*)"/g,
        (_, name: string, value: string) => `w:${name}="${ooxmlFont(value)}"`,
      );
      if (!/\bw:eastAsia=/.test(clean))
        clean = clean.replace(/\/?\s*>$/, ' w:eastAsia="Workbench Sans SC"/>');
      return clean;
    });
    if (updated !== xml) parts[path] = strToU8(updated);
  }
  return zipSync(parts, { level: 6 });
}
