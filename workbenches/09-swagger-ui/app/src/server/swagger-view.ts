// ABOUTME: 同源 iframe 中运行官方 Swagger UI；外部试调经 /api/try/send 代理，授权值只留在 iframe 内存。
import { readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import type { WorkbenchServer } from "../../sdk/runtime.mjs";
import { handleProxy } from "./proxy.ts";

const style = [
  // 文档由视口滚动：Swagger UI 的虚拟端点列表监听 window 滚动。
  "html,body{margin:0;background:#fff}",
  "html{overscroll-behavior:contain}",
  ".swagger-ui .wrapper{padding:0 24px;max-width:1180px}",
  ".swagger-ui .information-container .info{margin:22px 0 18px}",
  ".swagger-ui .info .title{font-size:26px}",
  ".swagger-ui .info .description p,.swagger-ui .info .description li{font-size:14px;line-height:1.65}",
  ".swagger-ui .scheme-container{box-shadow:none;border-top:1px solid #e3e8ee;border-bottom:1px solid #e3e8ee;padding:14px 0}",
  ".swagger-ui .filter-container .operation-filter-input{margin:12px 0;border:1px solid #c9d2dc;border-radius:4px;padding:7px 10px}",
  ".swagger-ui .opblock-summary-path{overflow-wrap:anywhere}",
  ".swagger-ui .opblock.wb-flash{box-shadow:0 0 0 3px #f2b84b}",
  ".swagger-ui button:focus-visible,.swagger-ui a:focus-visible,.swagger-ui input:focus-visible,.swagger-ui select:focus-visible,.swagger-ui textarea:focus-visible{outline:3px solid #2f6fb3;outline-offset:2px}",
  "@media(max-width:600px){.swagger-ui .wrapper{padding:0 10px}.swagger-ui .opblock .opblock-summary-path,.swagger-ui .opblock .opblock-summary-description{font-size:11px}.swagger-ui .opblock-summary-method{min-width:52px!important}.swagger-ui .info .title{font-size:21px}}",
  "@media(prefers-reduced-motion:reduce){*{transition:none!important;animation:none!important;scroll-behavior:auto!important}}",
].join("");

const html = `<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><link rel="icon" href="data:,"><link rel="stylesheet" href="/api/swagger-assets/swagger-ui.css?v=5.34.0"><style>${style}</style><title>接口参考</title></head><body><div id="swagger-root"></div><script src="/api/swagger-assets/swagger-ui-bundle.js?v=5.34.0"></script><script src="/api/swagger-init.js?v=0.9.0"></script></body></html>`;

/*
 * 运行在 iframe 中的脚本。保持为纯字符串，避免构建工具改写。
 * - 同源 /api/sample/ 与 /api/demo/ 直接请求；其它同源路径拒绝。
 * - 外部 http(s) 请求通过 userFetch 封装为 JSON 交给 /api/try/send，界面中的 Request URL 和 curl 仍显示真实目标。
 * - 授权值由 Swagger UI 保存在内存（persistAuthorization:false），不会写入项目或日志。
 */
const script = `(() => {
  'use strict';
  let ui = null;
  let allowPrivate = false;
  const root = document.getElementById('swagger-root');
  const post = (message) => parent.postMessage(message, location.origin);
  const nullBody = new Set([101, 103, 204, 205, 304]);
  const toBase64 = (bytes) => {
    let text = '';
    for (let index = 0; index < bytes.length; index += 0x8000)
      text += String.fromCharCode.apply(null, bytes.subarray(index, index + 0x8000));
    return btoa(text);
  };
  const fromBase64 = (value) => {
    const text = atob(value);
    const bytes = new Uint8Array(text.length);
    for (let index = 0; index < text.length; index++) bytes[index] = text.charCodeAt(index);
    return bytes;
  };
  const label = (url) => {
    try { const parsed = new URL(url, location.href); return (parsed.origin === location.origin ? '' : parsed.host) + parsed.pathname; }
    catch { return String(url).slice(0, 120); }
  };
  async function localFetch(url, request) {
    const method = String(request.method || 'GET').toUpperCase();
    const started = performance.now();
    try {
      const response = await fetch(url, request);
      post({ kind: 'swagger-call', method, target: label(url), status: response.status, durationMs: Math.round(performance.now() - started), local: true });
      return response;
    } catch (error) {
      post({ kind: 'swagger-call', method, target: label(url), code: 'CONNECT', message: '工作台示例服务没有响应。', local: true });
      throw new Error('工作台示例服务没有响应，请确认预览仍在运行。');
    }
  }
  async function proxyFetch(url, request) {
    const method = String(request.method || 'GET').toUpperCase();
    const headers = [];
    let hasType = false;
    for (const [name, value] of Object.entries(request.headers || {})) {
      if (value === undefined || value === null) continue;
      if (name.toLowerCase() === 'content-type') hasType = true;
      headers.push([name, String(value)]);
    }
    let body = null;
    if (request.body !== undefined && request.body !== null && method !== 'GET' && method !== 'HEAD') {
      const probe = new Request(location.origin, { method: 'POST', body: request.body });
      const bytes = new Uint8Array(await probe.arrayBuffer());
      const type = probe.headers.get('content-type');
      if (type && !hasType) headers.push(['Content-Type', type]);
      if (bytes.length > 1000000) {
        post({ kind: 'swagger-call', method, target: label(url), code: 'TOO_LARGE', message: '请求体超过 1 MB。' });
        throw new Error('请求体超过 1 MB，请缩小上传内容。');
      }
      body = toBase64(bytes);
    }
    let reply;
    try {
      reply = await fetch('/api/try/send', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ method, url, headers, body, allowPrivate }) });
    } catch {
      post({ kind: 'swagger-call', method, target: label(url), code: 'OFFLINE', message: '工作台服务没有响应。' });
      throw new Error('工作台服务没有响应，请确认预览仍在运行后重试。');
    }
    const data = await reply.json().catch(() => null);
    if (!reply.ok || !data || data.error) {
      const error = (data && data.error) || {};
      const message = error.message || '试调代理失败（HTTP ' + reply.status + '）。';
      post({ kind: 'swagger-call', method, target: label(url), code: error.code || 'PROXY', message });
      throw new Error(message);
    }
    post({ kind: 'swagger-call', method, target: label(url), status: data.status, durationMs: data.durationMs, truncated: data.truncated });
    const responseHeaders = new Headers();
    for (const pair of data.headers) {
      try {
        const name = String(pair[0]).toLowerCase() === 'set-cookie' ? 'x-upstream-set-cookie' : pair[0];
        responseHeaders.append(name, pair[1]);
      } catch {}
    }
    if (data.truncated) responseHeaders.set('x-workbench-truncated', '响应超过 5 MB，只显示前 5 MB');
    let status = data.status;
    if (status < 200 || status > 599) { responseHeaders.set('x-upstream-status', String(status)); status = 502; }
    return new Response(nullBody.has(status) || method === 'HEAD' ? null : fromBase64(data.body), { status, statusText: data.statusText, headers: responseHeaders });
  }
  function requestInterceptor(request) {
    if (request.loadSpec) throw new Error('工作台不加载外部 $ref 文件：' + request.url);
    let target;
    try { target = new URL(request.url, location.href); }
    catch { throw new Error('请求地址无效：' + request.url); }
    if (target.origin === location.origin) {
      if (/^\\/api\\/(?:sample|demo)\\//.test(target.pathname)) { request.userFetch = localFetch; return request; }
      const message = '请求地址 ' + target.pathname + ' 指向工作台本身。请在 servers（Swagger 2.0 为 host）中填写完整的 https:// 地址；内置示例服务位于 /api/sample/。';
      post({ kind: 'swagger-call', method: String(request.method || 'GET').toUpperCase(), target: target.pathname, code: 'RELATIVE', message });
      throw new Error(message);
    }
    if (target.protocol !== 'http:' && target.protocol !== 'https:') throw new Error('只能试调 http:// 或 https:// 地址。');
    request.userFetch = proxyFetch;
    return request;
  }
  function find(path, method) {
    return Array.from(document.querySelectorAll('.opblock.opblock-' + method)).find((block) => {
      const node = block.querySelector('[data-path]');
      return node && node.getAttribute('data-path') === path;
    });
  }
  function reveal(block, takeFocus) {
    if (!block.classList.contains('is-open')) {
      const toggle = block.querySelector('.opblock-summary-control');
      if (toggle) toggle.click();
    }
    block.scrollIntoView({ block: 'start' });
    block.classList.add('wb-flash');
    setTimeout(() => block.classList.remove('wb-flash'), 1200);
    const toggle = block.querySelector('.opblock-summary-control');
    if (toggle && takeFocus) toggle.focus({ preventScroll: true });
  }
  function focusOperation(path, method, tags, takeFocus) {
    if (!ui) return;
    let block = find(path, method);
    if (block) return reveal(block, takeFocus);
    ui.layoutActions.updateFilter('');
    for (const tag of tags) ui.layoutActions.show(['operations-tag', tag], true);
    // Swagger UI 5.34 对大量端点启用虚拟列表，屏外端点不在 DOM 中：先让列表滚到该端点。
    try {
      const raw = ui.specSelectors.specJson().getIn(['paths', path, method]);
      const id = ui.fn.opId(raw && raw.toJS ? raw.toJS() : {}, path, method);
      if (tags[0] && ui.layoutActions.scrollToVirtualizedOperation)
        ui.layoutActions.scrollToVirtualizedOperation(['operations', tags[0], id]);
    } catch {}
    let attempts = 0;
    const retry = () => {
      block = find(path, method);
      if (block) return reveal(block, takeFocus);
      if (++attempts < 20) setTimeout(retry, 50);
      else post({ kind: 'swagger-missing', path, method });
    };
    setTimeout(retry, 30);
  }
  const receive = (event) => {
    if (event.origin !== location.origin || event.source !== parent || !event.data || typeof event.data !== 'object') return;
    const data = event.data;
    if (data.kind === 'swagger-settings') { allowPrivate = data.allowPrivate === true; return; }
    if (data.kind === 'swagger-focus' && typeof data.path === 'string' && typeof data.method === 'string') {
      // 父页面可能刚把 iframe 从隐藏切换为可见，等一帧布局后再定位。
      setTimeout(() => focusOperation(data.path, data.method, Array.isArray(data.tags) ? data.tags : [], data.takeFocus === true), 60);
      return;
    }
    if (data.kind === 'swagger-section') { setTimeout(() => section(data.section), 60); return; }
    if (data.kind === 'swagger-spec') receiveSpec(data);
  };
  function section(name) {
    if (name === 'models') {
      const models = document.querySelector('section.models');
      if (!models) { post({ kind: 'swagger-missing', section: 'models' }); return; }
      if (!models.classList.contains('is-open')) { const head = models.querySelector('h4 button, h4'); if (head) head.click(); }
      models.scrollIntoView({ block: 'start' });
    }
    if (name === 'authorize') {
      const button = document.querySelector('.auth-wrapper .authorize');
      if (button) button.click(); else post({ kind: 'swagger-missing', section: 'authorize' });
    }
    if (name === 'top') document.scrollingElement.scrollTo({ top: 0 });
  }
  function receiveSpec(data) {
    if (data.kind !== 'swagger-spec' || !data.spec || typeof data.spec !== 'object' || Array.isArray(data.spec)) return;
    const spec = data.spec;
    if (ui) { ui.specActions.updateSpec(JSON.stringify(spec)); return; }
    ui = SwaggerUIBundle({
      domNode: root,
      spec,
      layout: 'BaseLayout',
      validatorUrl: null,
      deepLinking: true,
      filter: true,
      displayRequestDuration: true,
      displayOperationId: false,
      persistAuthorization: false,
      withCredentials: false,
      queryConfigEnabled: false,
      showMutatedRequest: false,
      tryItOutEnabled: false,
      defaultModelsExpandDepth: 1,
      defaultModelExpandDepth: 2,
      docExpansion: 'list',
      syntaxHighlight: { activated: true, theme: 'agate' },
      supportedSubmitMethods: ['get', 'put', 'post', 'delete', 'options', 'head', 'patch'],
      requestInterceptor,
    });
  }
  window.addEventListener('message', receive);
  window.addEventListener('pagehide', () => window.removeEventListener('message', receive), { once: true });
  post({ kind: 'swagger-ready' });
})();`;

export function registerSwaggerView(app: WorkbenchServer): void {
  const root = dirname(fileURLToPath(import.meta.resolve("swagger-ui-dist")));
  app.route(
    "GET",
    "/api/swagger-view",
    () =>
      new Response(html, {
        headers: {
          "content-type": "text/html; charset=utf-8",
          "cache-control": "no-store",
          "content-security-policy":
            "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob: https:; media-src 'self' blob:; connect-src 'self'; object-src 'none'; base-uri 'none'; form-action 'none'",
        },
      }),
  );
  app.route(
    "GET",
    "/api/swagger-init.js",
    () =>
      new Response(script, {
        headers: {
          "content-type": "text/javascript; charset=utf-8",
          "cache-control": "no-store",
        },
      }),
  );
  app.route("GET", "/api/swagger-assets/:name", async ({ params }) => {
    if (!["swagger-ui.css", "swagger-ui-bundle.js"].includes(params.name))
      return new Response(null, { status: 404 });
    try {
      return new Response(new Uint8Array(await readFile(join(root, params.name))), {
        headers: {
          "content-type": params.name.endsWith(".css")
            ? "text/css; charset=utf-8"
            : "text/javascript; charset=utf-8",
          "cache-control": "public, max-age=31536000, immutable",
        },
      });
    } catch {
      return new Response(null, { status: 404 });
    }
  });
  app.route("POST", "/api/try/send", ({ body, request }) =>
    handleProxy(body, { selfHost: request.headers.host }),
  );
}
