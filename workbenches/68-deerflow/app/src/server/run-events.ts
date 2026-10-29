// ABOUTME: 页面的研究进度事件流（text/event-stream）：按序号回放已记录事件，再推送新事件与运行状态。
import type { WorkbenchServer } from "../../sdk/runtime.mjs";
import type { createResearchRuns } from "./research-runs.ts";

type Runs = ReturnType<typeof createResearchRuns>;
const terminal = (phase: string) => !["creating_thread", "submitting", "unknown", "pending", "running"].includes(phase);

/** Each connection lives at most `lifetimeMs`; EventSource reconnects with Last-Event-ID and nothing is lost. */
export function eventStream(runs: Runs, id: string, after: number, lifetimeMs = 50000) {
  const encoder = new TextEncoder();
  let cleanup = () => {};
  return new ReadableStream<Uint8Array>({
    start(controller) {
      let cursor = after,
        closed = false,
        lastRun = "";
      const send = (s: string) => {
        if (!closed) controller.enqueue(encoder.encode(s));
      };
      const close = () => {
        if (closed) return;
        closed = true;
        off();
        clearInterval(ping);
        clearTimeout(stop);
        controller.close();
      };
      const flush = () => {
        if (closed) return;
        for (const e of runs.events(id, cursor)) {
          send(`id: ${e.seq}\nevent: progress\ndata: ${JSON.stringify(e)}\n\n`);
          cursor = e.seq;
        }
        const run = runs.summary(id);
        const encoded = JSON.stringify(run);
        if (encoded !== lastRun) {
          lastRun = encoded;
          send(`event: run\ndata: ${encoded}\n\n`);
        }
        if (terminal(run.phase) && !runs.following(id)) {
          send("event: done\ndata: {}\n\n");
          close();
        }
      };
      const off = runs.subscribe(id, flush);
      const ping = setInterval(() => send(": ping\n\n"), 15000);
      const stop = setTimeout(close, lifetimeMs);
      cleanup = close;
      send("retry: 1500\n\n");
      flush();
    },
    cancel() {
      cleanup();
    },
  });
}

export function registerRunEvents(app: WorkbenchServer, runs: Runs, fail: (e: unknown) => Response) {
  app.route("GET", "/api/research/:id/log", ({ params }) => {
    try {
      runs.read(params.id);
      return runs.events(params.id, 0);
    } catch (e) {
      return fail(e);
    }
  });
  app.route("GET", "/api/research/:id/events", ({ params, request, url }) => {
    try {
      runs.read(params.id);
    } catch (e) {
      return fail(e);
    }
    const header = request.headers["last-event-id"];
    const after = Number((Array.isArray(header) ? header[0] : header) ?? url.searchParams.get("after") ?? 0);
    return new Response(eventStream(runs, params.id, Number.isFinite(after) && after > 0 ? after : 0), {
      headers: { "content-type": "text/event-stream; charset=utf-8", "cache-control": "no-store", "x-accel-buffering": "no" },
    });
  });
}
