// Shared stage styling; system fonts keep both embedded and exported decks offline.
export const stageCSS = `
.reveal{--stage-bg:#173b34;--stage-fg:#f8f4e9;--stage-accent:#edbd73;background:var(--stage-bg);color:var(--stage-fg);font:30px/1.5 system-ui,-apple-system,"PingFang SC","Microsoft YaHei",sans-serif}
.reveal[data-theme=paper]{--stage-bg:#f8f4ea;--stage-fg:#273a37;--stage-accent:#9b5725}
.reveal[data-theme=night]{--stage-bg:#202838;--stage-fg:#f7f4ec;--stage-accent:#b9caf9}
.reveal .slides{text-align:left}.reveal .slides>section{box-sizing:border-box;padding:28px 50px}
.reveal h1,.reveal h2,.reveal h3{color:inherit;font-weight:650;line-height:1.18;letter-spacing:-.04em;margin:0 0 22px;text-transform:none;overflow-wrap:anywhere}
.reveal h1{font-size:2.15em}.reveal h2{font-size:1.65em}.reveal h3{font-size:1.2em}
.reveal p{margin:16px 0;overflow-wrap:anywhere}.reveal strong{color:var(--stage-accent);font-weight:600}.reveal em{font-style:italic}
.reveal ul,.reveal ol{margin:20px 0 20px 1.2em;padding-left:0;display:block}.reveal li{padding:5px 0;overflow-wrap:anywhere}
.reveal blockquote{margin:32px 0;padding-left:24px;border-left:3px solid var(--stage-accent);font-size:1.2em;color:var(--stage-accent)}
.reveal pre{font-size:.65em;line-height:1.5;white-space:pre-wrap;text-align:left;margin:20px 0;padding:20px;background:#0002;border-radius:4px;overflow-wrap:anywhere}
.reveal code{font-family:ui-monospace,monospace}.reveal p code{background:#8882;padding:2px 8px}.reveal .controls{color:var(--stage-accent)}
.reveal .progress{color:var(--stage-accent);height:3px}.reveal .slide-number{font:16px ui-monospace,monospace;color:var(--stage-fg);background:transparent;right:auto;left:24px;bottom:18px}
.reveal .empty-slide{opacity:.6}.reveal button:focus-visible{outline:3px solid var(--stage-accent);outline-offset:4px}
@media(prefers-reduced-motion:reduce){.reveal *{animation:none!important;transition:none!important}}
`;
