// ABOUTME: AI 大纲（次要功能）：Floatboat Host 状态卡、要求输入、候选稿缩略预览与确认采用。
import { RefreshCw, Sparkles, X } from "lucide-react";
import type { AppInfo } from "../contracts/app";
import type { Deck } from "../contracts/domain";
import type { OutlineSuggestion } from "../contracts/outline";
import { ScaledSlide } from "./SlideView";

export function AiPanel({
  platform,
  checking,
  onRecheck,
  prompt,
  setPrompt,
  busy,
  error,
  suggestion,
  deck,
  onGenerate,
  onApply,
  onDiscard,
  onClose,
}: {
  platform: AppInfo["platform"] | "checking" | "error";
  checking: boolean;
  onRecheck: () => void;
  prompt: string;
  setPrompt: (value: string) => void;
  busy: boolean;
  error: string;
  suggestion: OutlineSuggestion | null;
  deck: Deck;
  onGenerate: () => void;
  onApply: () => void;
  onDiscard: () => void;
  onClose: () => void;
}) {
  const connected = platform === "connected";
  return (
    <section
      className="ai-panel"
      aria-label="AI 大纲"
      onKeyDown={(event) => {
        if (event.key === "Escape") onClose();
      }}
    >
      <header>
        <h2>
          <Sparkles size={15} aria-hidden="true" /> AI 大纲
        </h2>
        <button type="button" className="icon-button" aria-label="关闭 AI 大纲" onClick={onClose}>
          <X size={16} aria-hidden="true" />
        </button>
      </header>
      {connected ? (
        <p className="host-status is-ok" role="status">
          Floatboat 已连接，生成使用桌面端的模型服务；每次调用时校验授权。
        </p>
      ) : (
        <div className="host-status is-off" role="status" data-host-status={platform}>
          <strong>{platform === "checking" ? "正在检测 Floatboat…" : "未连接 Floatboat，AI 大纲暂不可用"}</strong>
          {platform === "checking" ? null : (
            <p>
              大纲生成需要 Floatboat 桌面端的模型服务。打开 Floatboat 并登录（本地预览会自动发现正在运行的客户端），然后点「重新检测」。编辑、图表、导出 PPTX 不受影响。
            </p>
          )}
          <button type="button" onClick={onRecheck} disabled={checking}>
            <RefreshCw size={13} aria-hidden="true" />
            {checking ? "检测中…" : "重新检测"}
          </button>
        </div>
      )}
      <form
        onSubmit={(event) => {
          event.preventDefault();
          if (connected && prompt.trim()) onGenerate();
        }}
      >
        <label htmlFor="ai-prompt">这份演示要讲什么？</label>
        <textarea
          id="ai-prompt"
          name="aiPrompt"
          autoComplete="off"
          rows={4}
          maxLength={12000}
          value={prompt}
          onChange={(event) => setPrompt(event.target.value)}
          placeholder="例如：给销售团队讲新会员方案，6 页左右，包含现行方案与新方案的对比…"
        />
        <button type="submit" className="secondary" disabled={!connected || busy || !prompt.trim()}>
          {busy ? "正在生成…" : "生成候选大纲"}
        </button>
      </form>
      {error ? (
        <p className="field-error" role="alert">
          {error}
        </p>
      ) : null}
      {suggestion ? (
        <div className="ai-suggestion">
          <h3>
            候选稿 · {suggestion.title} · {suggestion.deck.slides.length} 页 <small>尚未采用</small>
          </h3>
          <ol>
            {suggestion.deck.slides.map((slide, i) => (
              <li key={slide.id}>
                <ScaledSlide slide={slide} theme={deck.theme} number={i + 1} width={150} mode="thumb" />
              </li>
            ))}
          </ol>
          <div className="button-row">
            <button type="button" className="primary" onClick={onApply}>
              采用并替换页面
            </button>
            <button type="button" onClick={onDiscard}>
              放弃候选稿
            </button>
          </div>
        </div>
      ) : null}
    </section>
  );
}
