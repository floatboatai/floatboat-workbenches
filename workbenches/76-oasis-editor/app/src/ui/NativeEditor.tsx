import { useEffect, useRef, useState } from "react";
import type { EditorDocument, OasisEditorClient } from "oasis-editor";
import { mountEditor, prepareFonts } from "./engine";
import "../vendor/oasis-editor/oasis-editor.css";
export function NativeEditor({
  document,
  zoom,
  onChange,
  onReady,
  onError,
  onPages,
}: {
  document: EditorDocument | null;
  zoom: number;
  onChange: (d: EditorDocument) => void;
  onReady: (c: OasisEditorClient | null) => void;
  onError: (e: unknown) => void;
  onPages: (n: number) => void;
}) {
  const host = useRef<HTMLDivElement>(null),
    callbacks = useRef({ onChange, onReady, onError, onPages });
  callbacks.current = { onChange, onReady, onError, onPages };
  const instance = useRef<OasisEditorClient | null>(null);
  const [ready, setReady] = useState(false);
  useEffect(() => {
    let live = true;
    let cleanup: (() => void) | undefined;
    let observer: MutationObserver | undefined;
    void (async () => {
      try {
        await prepareFonts();
        if (!live) return;
        const client = mountEditor(host.current!, document);
        instance.current = client;
        await client.ready;
        if (!live) {
          await client.dispose();
          return;
        }
        client.ui.zoom.set(zoom);
        let wire = JSON.stringify(document);
        const capture = () => {
          const d = client.getDocument(),
            next = JSON.stringify(d);
          if (next !== wire) {
            wire = next;
            callbacks.current.onChange(JSON.parse(next) as EditorDocument);
          }
        };
        cleanup = client.on("documentChange", capture);
        capture();
        callbacks.current.onReady(client);
        setReady(true);
        const pages = () =>
          callbacks.current.onPages(
            host.current?.querySelectorAll("canvas").length ?? 1,
          );
        observer = new MutationObserver(pages);
        observer.observe(host.current!, { childList: true, subtree: true });
        pages();
      } catch (e) {
        if (live) callbacks.current.onError(e);
      }
    })();
    return () => {
      live = false;
      cleanup?.();
      observer?.disconnect();
      callbacks.current.onReady(null);
      void instance.current?.dispose();
      instance.current = null;
    };
  }, []);
  useEffect(() => {
    instance.current?.ui.zoom.set(zoom);
  }, [zoom]);
  return (
    <div className="native-frame" aria-label="分页文档编辑区">
      {!ready && (
        <p className="loading-paper" role="status">
          正在准备字库与纸张…
        </p>
      )}
      <div className="native-host" ref={host} />
    </div>
  );
}
