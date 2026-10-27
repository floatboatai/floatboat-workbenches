import { readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import type { WorkbenchServer } from "../../sdk/runtime.mjs";

const html = `<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><link rel="icon" href="data:,"><link rel="stylesheet" href="/api/swagger-assets/swagger-ui.css?v=5.34.0"><style>body{margin:0;background:#fff}.swagger-ui .wrapper{padding:0 18px}.swagger-ui .info{margin:16px 0 24px}.swagger-ui .info .title{font-size:24px}.swagger-ui .scheme-container{box-shadow:none;border:1px solid #e1e8ef}.swagger-ui .opblock-summary-path{overflow-wrap:anywhere}.swagger-ui button:focus-visible{outline:3px solid #78a7d5;outline-offset:3px}@media(max-width:600px){.swagger-ui .wrapper{padding:0 8px}.swagger-ui .opblock .opblock-summary-path{font-size:11px}.swagger-ui .opblock .opblock-summary-description{font-size:11px}.swagger-ui .opblock-summary-method{min-width:50px!important}.swagger-ui .info .title{font-size:21px}}</style><title>接口参考</title></head><body><div id="swagger-root"></div><script src="/api/swagger-assets/swagger-ui-bundle.js?v=5.34.0"></script><script src="/api/swagger-init.js"></script></body></html>`;
const script = `(() => {
  let ui;
  const root = document.getElementById('swagger-root');
  const receive = (event) => {
    if (event.origin !== location.origin || event.source !== parent || !event.data || event.data.kind !== 'swagger-spec' || !event.data.spec || typeof event.data.spec !== 'object' || Array.isArray(event.data.spec)) return;
    const spec = event.data.spec;
    if (ui) { ui.specActions.updateSpec(JSON.stringify(spec)); return; }
    ui = SwaggerUIBundle({
      domNode: root, spec, layout: 'BaseLayout', validatorUrl: null,
      syntaxHighlight: false, persistAuthorization: false, withCredentials: false,
      queryConfigEnabled: false, supportedSubmitMethods: ['get'],
      defaultModelsExpandDepth: -1, docExpansion: 'list', displayRequestDuration: true,
      requestInterceptor: (request) => {
        if (new URL(request.url, location.href).origin !== location.origin || String(request.method || 'GET').toUpperCase() !== 'GET') throw new Error('只读试调仅支持当前工作台的同源 GET 接口。');
        return request;
      }
    });
  };
  window.addEventListener('message', receive);
  let previous = 0;
  const observer = new ResizeObserver(() => {
    const height = Math.min(16000, Math.max(480, document.body.scrollHeight));
    if (height !== previous) { previous = height; parent.postMessage({kind: 'swagger-height', height}, location.origin); }
  });
  observer.observe(root);
  window.addEventListener('pagehide', () => { observer.disconnect(); window.removeEventListener('message', receive); }, {once: true});
  parent.postMessage({kind: 'swagger-ready'}, location.origin);
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
          "content-security-policy":
            "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; media-src 'self' blob:; connect-src 'self'; object-src 'none'; base-uri 'none'",
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
      return new Response(
        new Uint8Array(await readFile(join(root, params.name))),
        {
          headers: {
            "content-type": params.name.endsWith(".css")
              ? "text/css; charset=utf-8"
              : "text/javascript; charset=utf-8",
            "cache-control": "public, max-age=31536000, immutable",
          },
        },
      );
    } catch {
      return new Response(null, { status: 404 });
    }
  });
}
