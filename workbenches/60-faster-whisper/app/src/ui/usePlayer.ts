// ABOUTME: 读取已保存的音频原件，生成播放地址，并以低采样率解码出可缩放的真实峰值数组。
import { useEffect, useState } from "react";
import type { AudioSource } from "../contracts/transcript";
import { audioBytes } from "./media";

export interface Peaks {
  values: Float32Array;
  /** Peaks per second of audio. */
  rate: number;
  duration: number;
}
const MAX_PEAKS = 60000;

async function decodePeaks(bytes: Uint8Array): Promise<Peaks> {
  let context: AudioContext;
  try {
    // A low decode rate keeps hour-long interviews within a few hundred MB while drawing.
    context = new AudioContext({ sampleRate: 8000 });
  } catch {
    context = new AudioContext();
  }
  try {
    const decoded = await context.decodeAudioData(new Uint8Array(bytes).buffer);
    const rate = Math.min(100, MAX_PEAKS / Math.max(1, decoded.duration));
    const count = Math.max(1, Math.ceil(decoded.duration * rate)),
      values = new Float32Array(count),
      per = decoded.length / count;
    for (let ch = 0; ch < decoded.numberOfChannels; ch++) {
      const data = decoded.getChannelData(ch);
      for (let i = 0; i < count; i++) {
        const a = Math.floor(i * per),
          b = Math.min(data.length, Math.floor((i + 1) * per));
        let max = values[i];
        for (let n = a; n < b; n++) {
          const v = data[n] < 0 ? -data[n] : data[n];
          if (v > max) max = v;
        }
        values[i] = max;
      }
    }
    let top = 0;
    for (const v of values) if (v > top) top = v;
    if (top > 0) for (let i = 0; i < count; i++) values[i] = Math.min(1, values[i] / top);
    return { values, rate, duration: decoded.duration };
  } finally {
    await context.close().catch(() => {});
  }
}

export function usePlayer(source: AudioSource | null) {
  const [url, setUrl] = useState(""),
    [peaks, setPeaks] = useState<Peaks | null>(null),
    [error, setError] = useState(""),
    [loading, setLoading] = useState(false);
  useEffect(() => {
    let disposed = false,
      objectUrl = "";
    setUrl("");
    setPeaks(null);
    setError("");
    if (!source) return;
    setLoading(true);
    void (async () => {
      const bytes = await audioBytes(source.id);
      if (disposed) return;
      objectUrl = URL.createObjectURL(new Blob([new Uint8Array(bytes)], { type: source.mime }));
      setUrl(objectUrl);
      try {
        const result = await decodePeaks(bytes);
        if (!disposed) setPeaks(result);
      } catch {
        if (!disposed) setError("此音频无法在浏览器中解码出波形；原件仍已保存，可尝试播放或提交转写。");
      }
    })()
      .catch(() => {
        if (!disposed) setError("音频原件无法读取，请重新导入音频。");
      })
      .finally(() => {
        if (!disposed) setLoading(false);
      });
    return () => {
      disposed = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [source?.id]);
  return { url, peaks, error, setError, loading };
}
