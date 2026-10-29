// ABOUTME: 报告 Markdown 渲染：GFM 表格与列表、[编号] 引用链接、禁用原始 HTML 与远端图片。
import Markdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { linkCitations, citeAnchor } from "../contracts/report";
import { safeUrl, type Source } from "../contracts/research";

export function ReportMarkdown({ text, sources, onCite }: { text: string; sources: Source[]; onCite?: (n: number) => void }) {
  return (
    <Markdown
      skipHtml
      remarkPlugins={[remarkGfm]}
      components={{
        a: ({ href, children }) => {
          const cite = /^#source-(\d+)$/.exec(href ?? "");
          if (cite)
            return (
              <a
                className="cite"
                href={"#" + citeAnchor(Number(cite[1]))}
                onClick={(e) => {
                  if (!onCite) return;
                  e.preventDefault();
                  onCite(Number(cite[1]));
                }}
              >
                {children}
              </a>
            );
          const url = safeUrl(href ?? "");
          return url ? (
            <a href={url} target="_blank" rel="noreferrer noopener">
              {children}
            </a>
          ) : (
            <span>{children}</span>
          );
        },
        img: ({ alt }) => <span>［图片：{alt || "附件"}］</span>,
      }}
    >
      {linkCitations(text, sources)}
    </Markdown>
  );
}
