import { useEffect, useState } from "react";
import { blobRequest, toBase64 } from "./files.ts";
export function DocumentPage({
  id,
  page,
  text,
}: {
  id: string;
  page: number;
  text: string;
}) {
  const [image, setImage] = useState(""),
    [error, setError] = useState(""),
    [mode, setMode] = useState<"image" | "text">("image");
  useEffect(() => {
    let live = true;
    setImage("");
    setError("");
    void blobRequest(`/api/documents/${id}/pages/${page}`)
      .then(async (blob) => {
        const bytes = new Uint8Array(await blob.arrayBuffer());
        if (live) setImage("data:image/png;base64," + toBase64(bytes));
      })
      .catch(() => {
        if (live) setError("页面图像暂不可用，可切换原文阅读。");
      });
    return () => {
      live = false;
    };
  }, [id, page]);
  return (
    <>
      <div className="view-toggle" role="group" aria-label="阅读方式">
        <button
          aria-pressed={mode === "image"}
          onClick={() => setMode("image")}
        >
          原页
        </button>
        <button aria-pressed={mode === "text"} onClick={() => setMode("text")}>
          文字
        </button>
      </div>
      {mode === "text" ? (
        <article className="text-page">
          <small>第 {page} 页 · 提取原文</small>
          <pre>{text || "此页没有可提取的文字。"}</pre>
        </article>
      ) : (
        <div className="paper">
          {image ? (
            <img
              src={image}
              alt={`PDF第${page}页`}
              width={595}
              height={842}
              onError={() => {
                setImage("");
                setError("原页图像未能显示，请切换文字阅读。");
              }}
            />
          ) : (
            <p role="status">{error || "正在读取原页…"}</p>
          )}
        </div>
      )}
    </>
  );
}
