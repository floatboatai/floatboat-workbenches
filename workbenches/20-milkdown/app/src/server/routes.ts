import { registerAutosaveRoutes } from './autosave.ts';
import type { WorkbenchServer } from '../../sdk/runtime.mjs';
import { isRecord } from '../contracts/project.ts';
import { validateNotebook } from '../contracts/notebook.ts';
import { createStore, StoreError } from './store.ts';
export function registerRoutes(app: WorkbenchServer) {
  const store = createStore(app.database, validateNotebook);
  registerAutosaveRoutes(app, validateNotebook);
  const fail = (error: unknown) => Response.json({ error: { message: error instanceof Error ? error.message : '操作失败，请重试。' } }, { status: error instanceof StoreError ? error.status : 400 });
  app.route('GET', '/api/projects', () => store.list());
  app.route('GET', '/api/projects/:id', ({ params }) => { try { return store.get(params.id); } catch (error) { return fail(error); } });
  app.route('POST', '/api/projects', ({ body }) => { try { if (!isRecord(body)) throw new Error('请求格式无效。'); return Response.json(store.create(body.title, body.data), { status: 201 }); } catch (error) { return fail(error); } });
  app.route('PUT', '/api/projects/:id', ({ params, body }) => { try { if (!isRecord(body)) throw new Error('请求格式无效。'); return store.update(params.id, body.title, body.data, body.revision); } catch (error) { return fail(error); } });
  app.route('DELETE', '/api/projects/:id', ({ params, body }) => { try { if (!isRecord(body)) throw new Error('请求格式无效。'); return store.remove(params.id, body.revision); } catch (error) { return fail(error); } });
}
