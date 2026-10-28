import { useEffect, useState } from "react";
import { videoBytes } from "./media";
export function VideoPreview({ id, label }: { id?: string; label: string }) {
  const [url, setUrl] = useState(""),
    [error, setError] = useState("");
  useEffect(() => {
    let active = true,
      object = "";
    setUrl("");
    setError("");
    if (id)
      void videoBytes(id)
        .then((bytes) => {
          if (active) {
            object = URL.createObjectURL(
              new Blob([new Uint8Array(bytes)], { type: "video/mp4" }),
            );
            setUrl(object);
          }
        })
        .catch(() => {
          if (active) setError("原片暂不可读，请重新上传。");
        });
    return () => {
      active = false;
      if (object) URL.revokeObjectURL(object);
    };
  }, [id]);
  return url ? (
    <video aria-label={label} src={url} controls preload="metadata" />
  ) : (
    <div className="video-placeholder">
      {error || (id ? "正在读取原片…" : "上传一段视频")}
      <small>MP4 · 每段最多20 MB</small>
    </div>
  );
}
