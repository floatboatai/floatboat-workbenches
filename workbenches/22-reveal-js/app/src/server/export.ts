import { deckSections, escapeHtml, validateDeck } from "../contracts/deck.ts";
import { stageCSS } from "../contracts/theme.ts";
import { titleValue } from "../contracts/project.ts";
export function standaloneHtml(
  raw: unknown,
  title: unknown,
  script: string,
  css: string,
  license: string,
): string {
  const deck = validateDeck(raw),
    name = titleValue(title);
  const options = JSON.stringify({
    width: 960,
    height: deck.ratio === "wide" ? 540 : 720,
    margin: 0.05,
    center: true,
    controls: true,
    progress: true,
    slideNumber: deck.numbers ? "c/t" : false,
    transition: deck.transition,
    hash: false,
    postMessage: false,
    postMessageEvents: false,
    view: null,
    scrollActivationWidth: 0,
    embedded: false,
    help: false,
    keyboard: true,
  });
  return `<!doctype html>\n<html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; img-src data:; base-uri 'none'; form-action 'none'"><title>${escapeHtml(name)}</title><style>${css}\n${stageCSS}\nhtml,body{margin:0;height:100%;background:#173b34} .reveal{height:100%}</style></head><body>\n<!-- Reveal.js 6.0.2; MIT license retained below. Speaker notes remain inside this file. -->\n<div class="reveal" data-theme="${deck.theme}"><div class="slides">${deckSections(deck)}</div></div>\n<script>${script.replace(/<\/script/gi, "<\\/script")}</script>\n<script>const config=${options};if(matchMedia('(prefers-reduced-motion: reduce)').matches)config.transition='none';Reveal.initialize(config);</script><template id="reveal-license">${escapeHtml(license)}</template></body></html>`;
}
