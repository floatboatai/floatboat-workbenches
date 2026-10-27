import type { WorkbenchServer } from '../../sdk/runtime.mjs';
import { isRecord } from '../contracts/project';
import { validateNotebook } from '../contracts/notebook';
import { createStore, StoreError } from './store';
import { registerAutosaveRoutes } from './autosave';
export function registerRoutes(app: WorkbenchServer) {
  const store = createStore(app.database, validateNotebook);
  registerAutosaveRoutes(app, validateNotebook);
  const fail = (e: unknown) => Response.json({ error: { message: e instanceof Error ? e.message : '操作失败，请重试。' } }, { status: e instanceof StoreError ? e.status : 400 });
  app.route('GET', '/api/projects', () => store.list());
  app.route('GET', '/api/projects/:id', ({ params }) => { try { return store.get(params.id); } catch (e) { return fail(e); } });
  app.route('DELETE', '/api/projects/:id', ({ params, body }) => { try { if (!isRecord(body)) throw new Error('请求格式无效。'); return store.remove(params.id, body.revision); } catch (e) { return fail(e); } });
}
