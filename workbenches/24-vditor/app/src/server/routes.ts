import { readFile } from 'node:fs/promises';
import type { WorkbenchServer } from '../../sdk/runtime.mjs';
import { validateArticle } from '../contracts/article.ts';
import { isRecord } from '../contracts/project.ts';
import { registerAutosaveRoutes } from './autosave.ts';
import { createStore, StoreError } from './store.ts';
export const ASSETS = ['dist/js/i18n/zh_CN.js', 'dist/js/lute/lute.min.js', 'dist/js/icons/ant.js', 'dist/js/highlight.js/styles/github.min.css', 'dist/css/content-theme/light.css', 'dist/css/content-theme/dark.css', 'dist/css/content-theme/wechat.css'] as const;
export function registerRoutes(app: WorkbenchServer) {
  const store = createStore(app.database, validateArticle);
  registerAutosaveRoutes(app, validateArticle);
  const failure = (e: unknown) => Response.json({ error: { message: e instanceof Error ? e.message : '操作失败。' } }, { status: e instanceof StoreError ? e.status : 400 });
  app.route('GET', '/api/projects', () => store.list());
  app.route('GET', '/api/projects/:id', ({ params }) => { try { return store.get(params.id); } catch (e) { return failure(e); } });
  app.route('DELETE', '/api/projects/:id', ({ params, body }) => { try { if (!isRecord(body)) throw new Error('请求格式错误。'); return store.remove(params.id, body.revision); } catch (e) { return failure(e); } });
  for (const asset of ASSETS) app.route('GET', '/api/vditor/' + asset, async () => {
    const path = await app.resources.path('vditor-assets', asset.replace(/^dist\//, 'runtime/'));
    return new Response(await readFile(path, 'utf8'), { headers: { 'content-type': asset.endsWith('.css') ? 'text/css; charset=utf-8' : 'text/javascript; charset=utf-8', 'cache-control': 'public, max-age=86400', 'x-content-type-options': 'nosniff' } });
  });
}
