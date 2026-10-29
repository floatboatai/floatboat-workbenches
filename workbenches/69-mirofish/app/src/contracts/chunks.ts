// ABOUTME: 按编码后体积切分文本，使每个 JSON 请求都低于运行时 2MB 的请求体上限。
/** Split by encoded size so each JSON request stays under the runtime's 2 MB body limit. */
export function chunksOf(text: string, budget = 1_400_000) {
  const out: string[] = [];
  const enc = new TextEncoder();
  let at = 0;
  while (at < text.length) {
    let size = 400_000;
    let piece = text.slice(at, at + size);
    while (enc.encode(JSON.stringify({ text: piece })).length > budget && size > 1000) {
      size = Math.floor(size / 2);
      piece = text.slice(at, at + size);
    }
    // Keep surrogate pairs intact across chunk boundaries.
    const last = piece.charCodeAt(piece.length - 1);
    if (last >= 0xd800 && last <= 0xdbff && at + piece.length < text.length) piece = piece.slice(0, -1);
    out.push(piece);
    at += piece.length;
  }
  return out.length ? out : [""];
}
