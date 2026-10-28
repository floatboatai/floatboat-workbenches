export async function callEngine(path: string, input?: unknown) {
  const raw = process.env.FIGCRAFT_SERVICE_URL ?? "http://127.0.0.1:8796";
  const base = new URL(raw);
  if (
    base.username ||
    base.password ||
    (!["127.0.0.1", "localhost", "[::1]"].includes(base.hostname) &&
      base.protocol !== "https:")
  )
    throw new Error("远程FigCraft服务需要HTTPS。");
  const response = await fetch(new URL(path, base), {
    method: input ? "POST" : "GET",
    redirect: "error",
    signal: AbortSignal.timeout(45000),
    headers: {
      "content-type": "application/json",
      ...(process.env.FIGCRAFT_SERVICE_TOKEN
        ? { authorization: "Bearer " + process.env.FIGCRAFT_SERVICE_TOKEN }
        : {}),
    },
    ...(input ? { body: JSON.stringify(input) } : {}),
  });
  const reader = response.body?.getReader();
  let size = 0;
  const chunks: Uint8Array[] = [];
  if (!reader) throw new Error("引擎响应为空。");
  while (true) {
    const item = await reader.read();
    if (item.done) break;
    size += item.value.length;
    if (size > 6000000) {
      await reader.cancel();
      throw new Error("引擎响应过大。");
    }
    chunks.push(item.value);
  }
  const text = Buffer.concat(chunks).toString();
  const value: unknown = JSON.parse(text);
  if (!response.ok)
    throw new Error(
      value && typeof value === "object" && "error" in value
        ? String(value.error).slice(0, 250)
        : "FigCraft服务无法完成请求。",
    );
  return value;
}
