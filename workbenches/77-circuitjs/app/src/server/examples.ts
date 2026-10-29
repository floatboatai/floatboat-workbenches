// ABOUTME: 只读提供随 GPL 源码快照保存的 CircuitJS1 官方示例目录与示例文本；仅允许目录中列出的文件名。

import { readFile } from 'node:fs/promises';
import type { WorkbenchServer } from '../../sdk/runtime.mjs';
import { EXAMPLE_FILE, parseSetupList, type ExampleEntry } from '../contracts/examples.ts';

const ROOT = 'upstream/ts/public';
export const MAX_EXAMPLE_BYTES = 200_000;

export function registerExampleRoutes(app: WorkbenchServer) {
  let index: Promise<ExampleEntry[]> | null = null;
  const load = () => (index ??= app.resources.path('notices', `${ROOT}/setuplist.txt`).then(path => readFile(path, 'utf8')).then(parseSetupList).catch(error => { index = null; throw error; }));
  const unavailable = () => Response.json({ error: { message: '示例库资源不可用：请确认工作台源码包含 notices/upstream/ts/public。' } }, { status: 503 });
  app.route('GET', '/api/examples', async () => {
    try { return { source: 'CircuitJS1 setuplist.txt', license: 'GPL-2.0-or-later', examples: await load() }; }
    catch { return unavailable(); }
  });
  app.route('GET', '/api/examples/:file', async ({ params }) => {
    const file = params.file;
    try {
      const entry = EXAMPLE_FILE.test(file) ? (await load()).find(e => e.file === file) : undefined;
      if (!entry) return Response.json({ error: { message: '示例不存在。' } }, { status: 404 });
      const source = await readFile(await app.resources.path('notices', `${ROOT}/circuits/${entry.file}`), 'utf8');
      if (Buffer.byteLength(source) > MAX_EXAMPLE_BYTES) return Response.json({ error: { message: '示例文件超过容量。' } }, { status: 413 });
      return { ...entry, source };
    } catch { return unavailable(); }
  });
}
