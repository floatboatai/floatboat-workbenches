import { useEffect, useRef, type RefObject } from "react";
import { Transformer } from "markmap-lib/no-plugins";
import { Markmap, deriveOptions } from "markmap-view";
import DOMPurify from "dompurify";

const transformer = new Transformer([]);
transformer.md.set({ html: false, linkify: false });
transformer.md.disable(["image"]);
type Tree = ReturnType<typeof transformer.transform>["root"];
function clean(node: Tree): void {
  node.content = DOMPurify.sanitize(node.content, {
    ALLOWED_TAGS: [
      "strong",
      "em",
      "code",
      "del",
      "ins",
      "s",
      "mark",
      "sub",
      "sup",
      "br",
    ],
    ALLOWED_ATTR: [],
  });
  node.children.forEach(clean);
}
export function Mindmap({
  markdown,
  svgRef,
  fitSignal,
  onError,
  onRendered,
}: {
  markdown: string;
  svgRef: RefObject<SVGSVGElement | null>;
  fitSignal: number;
  onError: (error: unknown) => void;
  onRendered: (markdown: string) => void;
}) {
  const map = useRef<Markmap | null>(null);
  const epoch = useRef(0);
  useEffect(() => {
    if (!svgRef.current) return;
    const instance = Markmap.create(svgRef.current, {
      ...deriveOptions({
        color: ["#b75c36", "#607c6b", "#6f78a1", "#bb9149"],
        maxWidth: 240,
      }),
      duration: 0,
      embedGlobalCSS: true,
      autoFit: true,
    });
    map.current = instance;
    return () => {
      epoch.current++;
      instance.destroy();
      map.current = null;
    };
  }, [svgRef]);
  useEffect(() => {
    const token = ++epoch.current;
    const timer = setTimeout(() => {
      try {
        const root = transformer.transform(
          markdown.trim() ? markdown : "# 添加一个标题，开始整理",
        ).root;
        clean(root);
        const instance = map.current;
        if (instance)
          void instance
            .setData(root)
            .then(async () => {
              if (token === epoch.current) {
                await instance.fit();
                if (token === epoch.current) onRendered(markdown);
              }
            })
            .catch(onError);
      } catch (error) {
        onError(error);
      }
    }, 180);
    return () => clearTimeout(timer);
  }, [markdown, onError, onRendered]);
  useEffect(() => {
    void map.current?.fit();
  }, [fitSignal]);
  return (
    <svg
      ref={svgRef}
      className="mindmap-svg"
      role="img"
      aria-label="由当前 Markdown 大纲生成的交互脑图"
    />
  );
}
