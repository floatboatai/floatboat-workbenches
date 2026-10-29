// ABOUTME: 内置示例乐谱：公有领域旋律（本项目编配与录入）和本项目原创练习曲，以及首开时的种子项目。
import { buildScore } from "./score-builder.ts";
import { inspectScore, type ScoreIndex } from "./musicxml.ts";
import { newProject, type ScoreProject } from "./domain.ts";
import { sha256Hex } from "./sha256.ts";

const minuetRight = [
  "D5:q G4:e A4 B4 C5", "D5:q G4 G4", "E5:q C5:e D5 E5 F#5", "G5:q G4 G4",
  "C5:q D5:e C5 B4 A4", "B4:q C5:e B4 A4 G4", "F#4:q G4:e A4 B4 G4", "A4:h.",
  "D5:q G4:e A4 B4 C5", "D5:q G4 G4", "E5:q C5:e D5 E5 F#5", "G5:q G4 G4",
  "C5:q D5:e C5 B4 A4", "B4:q C5:e B4 A4 G4", "A4:q B4:e A4 G4 F#4", "G4:h.",
  "B5:q G5:e A5 B5 G5", "A5:q D5:e E5 F#5 D5", "G5:q E5:e F#5 G5 D5", "C#5:q B4:e C#5 A4:q",
  "A4:e B4 C#5 D5 E5 F#5", "G5:q F#5 E5", "F#5:q A4 C#5", "D5:h.",
  "D5:q G4:e F#4 G4:q", "E5:q G4:e F#4 G4:q", "D5:q C5 B4", "A4:e G4 F#4 G4 A4:q",
  "D4:e E4 F#4 G4 A4 B4", "C5:q B4 A4", "B4:e D5 G4:q F#4", "G4:h.",
].join("|");
const minuetLeft = [
  "G3:h +B3 +D4 A3:q", "B3:h.", "C4:h.", "B3:h.", "A3:h.", "G3:h.", "D4:h B3:q", "D4:q D3:e C4 B3 A3",
  "B3:h A3:q", "G3:q B3 G3", "C4:h.", "B3:q C4:e B3 A3 G3", "A3:h F#3:q", "G3:h B3:q", "C4:q D4 D3", "G3:h G2:q",
  "G3:h.", "F#3:h.", "E3:h G3:q", "A3:h A2:q", "A3:h.", "B3:h C#4:q", "D4:q F#3 A3", "D4:q D3 C4",
  "B3:h.", "C4:h.", "B3:q A3 G3", "D4:h.", "D3:h.", "E3:h F#3:q", "G3:h D3:q", "G2:h.",
].join("|");

export const minuetXml = buildScore({
  title: "Minuet in G major",
  subtitle: "BWV Anh. 114",
  composer: "Christian Petzold (c. 1725)",
  arranger: "Left hand simplified, Floatboat edition",
  rights: "Melody public domain; this edition CC0 1.0",
  fifths: 1,
  beats: 3,
  beatType: 4,
  tempo: { words: "Moderato", bpm: 112 },
  repeats: { forward: [17], backward: [16, 32] },
  dynamics: { 1: "mf", 17: "p", 25: "f" },
  parts: [
    { id: "P1", name: "Piano", abbreviation: "Pno.", program: 1, staves: [ { clef: "G", music: minuetRight }, { clef: "F", music: minuetLeft } ] },
  ],
});

const odeMelody = [
  "F#5:q F#5 G5 A5", "A5:q G5 F#5 E5", "D5:q D5 E5 F#5", "F#5:q. E5:e E5:h",
  "F#5:q F#5 G5 A5", "A5:q G5 F#5 E5", "D5:q D5 E5 F#5", "E5:q. D5:e D5:h",
  "E5:q E5 F#5 D5", "E5:q F#5:e G5 F#5:q D5", "E5:q F#5:e G5 F#5:q E5", "D5:q E5 A4:h",
  "F#5:q F#5 G5 A5", "A5:q G5 F#5 E5", "D5:q D5 E5 F#5", "E5:q. D5:e D5:h",
];
const odeSecond = [
  "D5:q D5 E5 F#5", "E5:q E5 D5 C#5", "A4:q A4 C#5 D5", "D5:q. C#5:e C#5:h",
  "D5:q D5 E5 F#5", "E5:q E5 D5 C#5", "A4:q A4 C#5 D5", "C#5:q. A4:e A4:h",
  "C#5:q C#5 D5 A4", "C#5:q D5:e E5 D5:q A4", "C#5:q D5:e E5 D5:q C#5", "A4:q C#5 E4:h",
  "D5:q D5 E5 F#5", "E5:q E5 D5 C#5", "A4:q A4 C#5 D5", "C#5:q. A4:e A4:h",
];
const odeViola = [
  "F#4:h A4", "C#4:h E4", "F#4:h A4", "A4:h G4", "F#4:h A4", "C#4:h E4", "F#4:h A4", "G4:h F#4",
  "A4:h A4", "A4:h F#4", "A4:h G4", "F#4:h E4", "F#4:h A4", "C#4:h E4", "F#4:h A4", "G4:h F#4",
];
const odeCello = [
  "D3:h F#3", "A2:h C#3", "D3:h F#3", "A2:h A2", "D3:h F#3", "A2:h C#3", "D3:h F#3", "A2:h D3",
  "A2:h C#3", "A2:h D3", "A2:h C#3", "D3:h A2", "D3:h F#3", "A2:h C#3", "D3:h F#3", "A2:h D2",
];

export const odeXml = buildScore({
  title: "Ode to Joy",
  subtitle: "Theme from Symphony No. 9, Op. 125",
  composer: "Ludwig van Beethoven (1824)",
  arranger: "String quartet arrangement, Floatboat edition",
  rights: "Melody public domain; this arrangement CC0 1.0",
  fifths: 2,
  beats: 4,
  beatType: 4,
  tempo: { words: "Allegro assai", bpm: 100 },
  repeats: { forward: [9], backward: [16] },
  dynamics: { 1: "p", 9: "mf", 13: "f" },
  parts: [
    { id: "P1", name: "Violin I", abbreviation: "Vln. I", program: 41, staves: [{ clef: "G", music: odeMelody.join("|") }] },
    { id: "P2", name: "Violin II", abbreviation: "Vln. II", program: 41, staves: [{ clef: "G", music: odeSecond.join("|") }] },
    { id: "P3", name: "Viola", abbreviation: "Vla.", program: 42, staves: [{ clef: "C", music: odeViola.join("|") }] },
    { id: "P4", name: "Violoncello", abbreviation: "Vc.", program: 43, staves: [{ clef: "F", music: odeCello.join("|") }] },
  ],
});

const morningSteps = [
  ["C", "E", "G", "E"], ["D", "F", "A", "F"], ["E", "G", "B", "G"], ["F", "A", "C", "A"],
  ["G", "B", "D", "B"], ["A", "C", "E", "C"], ["G", "F", "D", "B"], ["C", "E", "G", "C"],
];
export const morningXml = buildScore({
  title: "Morning Lines",
  composer: "Floatboat original study",
  rights: "Original demonstration score; CC0 1.0",
  fifths: 0,
  beats: 4,
  beatType: 4,
  parts: [
    { id: "P1", name: "Flute", abbreviation: "Fl.", program: 74, staves: [{ clef: "G", music: morningSteps.map((m) => m.map((s, i) => `${s}5${i ? "" : ":q"}`).join(" ")).join("|") }] },
    { id: "P2", name: "Cello", abbreviation: "Vc.", program: 43, staves: [{ clef: "F", music: morningSteps.map((m) => `${m[0]}3:w`).join("|") }] },
  ],
});

export interface Sample {
  key: string;
  fileName: string;
  label: string;
  note: string;
  xml: string;
}
export const SAMPLES: Sample[] = [
  { key: "minuet", fileName: "petzold-minuet-in-g.musicxml", label: "小步舞曲 G 大调（钢琴）", note: "Petzold，BWV Anh. 114 · 32 小节，两段反复", xml: minuetXml },
  { key: "ode", fileName: "beethoven-ode-to-joy-quartet.musicxml", label: "欢乐颂（弦乐四重奏）", note: "贝多芬第九交响曲主题 · 4 声部 16 小节", xml: odeXml },
  { key: "morning", fileName: "morning-lines.musicxml", label: "Morning Lines（长笛与大提琴）", note: "本项目原创练习曲 · 8 小节", xml: morningXml },
];

const encoder = new TextEncoder();
export function sampleSource(sample: Sample): { bytes: Uint8Array; id: string; index: ScoreIndex } {
  const bytes = encoder.encode(sample.xml);
  return { bytes, id: sha256Hex(bytes), index: inspectScore(sample.xml) };
}
export function sampleProject(sample: Sample): ScoreProject {
  const { bytes, id, index } = sampleSource(sample);
  return newProject({ id, fileName: sample.fileName, kind: "xml", size: bytes.length }, index);
}

/** 首开时的审校对象：小步舞曲，附两条示范批注。 */
export function seedProject(): ScoreProject {
  const project = sampleProject(SAMPLES[0]);
  project.annotations = [
    { id: "seed-turn", partId: "P1", measureIndex: 7, beat: null, kind: "articulation", text: "第一段结尾：确认是否加颤音（各版本不一），排练前与演奏者统一。", resolved: false, createdAt: "2026-10-29T09:00:00.000Z" },
    { id: "seed-csharp", partId: "P1", measureIndex: 19, beat: [0, 1], kind: "pitch", text: "转入 D 大调：升 C 需在校样中清晰可见。", resolved: true, createdAt: "2026-10-29T09:05:00.000Z" },
  ];
  return project;
}
