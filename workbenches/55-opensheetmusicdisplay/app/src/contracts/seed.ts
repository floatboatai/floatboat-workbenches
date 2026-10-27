import { bytesToBase64, type ScoreProject } from "./domain.ts";
const lines = [
  ["C", "E", "G", "E"],
  ["D", "F", "A", "F"],
  ["E", "G", "B", "G"],
  ["F", "A", "C", "A"],
  ["G", "B", "D", "B"],
  ["A", "C", "E", "C"],
  ["G", "F", "D", "B"],
  ["C", "E", "G", "C"],
];
const part = (id: string, low: boolean) =>
  `<part id="${id}">${lines.map((steps, index) => `<measure number="${index + 1}">${index === 0 ? `<attributes><divisions>1</divisions><key><fifths>0</fifths></key><time><beats>4</beats><beat-type>4</beat-type></time><clef><sign>${low ? "F" : "G"}</sign><line>${low ? 4 : 2}</line></clef></attributes>` : ""}${(low ? [steps[0]] : steps).map((step) => `<note><pitch><step>${step}</step><octave>${low ? 3 : 5}</octave></pitch><duration>${low ? 4 : 1}</duration><type>${low ? "whole" : "quarter"}</type></note>`).join("")}${index === 7 ? '<barline location="right"><bar-style>light-heavy</bar-style></barline>' : ""}</measure>`).join("")}</part>`;
export const seedXml = `<?xml version="1.0" encoding="UTF-8"?>
<score-partwise version="4.0"><work><work-title>Morning Lines</work-title></work><identification><creator type="composer">Floatboat original study</creator><rights>Original demonstration score; reusable under the repository license.</rights></identification><part-list><score-part id="P1"><part-name>Flute</part-name><part-abbreviation>Fl.</part-abbreviation></score-part><score-part id="P2"><part-name>Cello</part-name><part-abbreviation>Vc.</part-abbreviation></score-part></part-list>${part("P1", false)}${part("P2", true)}</score-partwise>`;
export const seed: ScoreProject = {
  source: {
    fileName: "morning-lines.musicxml",
    kind: "xml",
    originalBase64: bytesToBase64(new TextEncoder().encode(seedXml)),
    xml: seedXml,
  },
  partId: "",
  layout: "page",
  zoom: 0.85,
  annotations: [],
  focus: { partId: "P1", measureIndex: 0 },
};
