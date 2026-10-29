// ABOUTME: 用简短记谱串生成标准 score-partwise MusicXML，供内置示例与测试使用；会检查每小节时值。
//
// 记谱串：小节以 "|" 分隔，音符以空格分隔。
//   D5:q  音名+变音(#/b)+八度:时值(w h q e s，加 . 为附点)，时值省略时沿用上一个
//   +B3   与前一个音同时发声（和弦），时值相同
//   r:h   休止符
//   !p    在下一个音前写力度记号（p pp mp mf f ff sf）
const DIV = 4;
const DURATIONS: Record<string, [number, string]> = { w: [16, "whole"], h: [8, "half"], q: [4, "quarter"], e: [2, "eighth"], s: [1, "16th"] };

export interface StaffSpec {
  clef: "G" | "F" | "C";
  music: string;
}
export interface PartSpec {
  id: string;
  name: string;
  abbreviation: string;
  staves: StaffSpec[];
  /** MIDI 音色编号（1–128），供制谱软件识别，不影响本应用的回放。 */
  program?: number;
}
export interface ScoreSpec {
  title: string;
  subtitle?: string;
  composer: string;
  arranger?: string;
  rights: string;
  fifths: number;
  beats: number;
  beatType: number;
  tempo?: { words: string; bpm: number };
  repeats?: { forward?: number[]; backward?: number[] };
  dynamics?: Record<number, string>;
  parts: PartSpec[];
}

const escape = (value: string) => value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

function noteXml(token: string, state: { dur: string }, staff: number, voice: number, measure: number): { xml: string; ticks: number } {
  let rest = token;
  const chord = rest.startsWith("+");
  if (chord) rest = rest.slice(1);
  const [pitch, given] = rest.split(":");
  if (given) state.dur = given;
  const dotted = state.dur.endsWith(".");
  const base = DURATIONS[state.dur.replace(".", "")];
  if (!base) throw new Error(`第 ${measure} 小节时值无效：${token}`);
  const ticks = dotted ? base[0] * 1.5 : base[0];
  let body: string;
  if (pitch === "r") body = "<rest/>";
  else {
    const match = /^([A-G])([#b]?)(\d)$/.exec(pitch);
    if (!match) throw new Error(`第 ${measure} 小节音高无效：${token}`);
    const alter = match[2] === "#" ? 1 : match[2] === "b" ? -1 : 0;
    body = `<pitch><step>${match[1]}</step>${alter ? `<alter>${alter}</alter>` : ""}<octave>${match[3]}</octave></pitch>`;
  }
  const xml =
    `<note>${chord ? "<chord/>" : ""}${body}<duration>${ticks}</duration><voice>${voice}</voice>` +
    `<type>${base[1]}</type>${dotted ? "<dot/>" : ""}<staff>${staff}</staff></note>`;
  return { xml, ticks: chord ? 0 : ticks };
}

function staffMeasure(source: string, staff: number, measure: number, length: number): string {
  const state = { dur: "q" };
  let ticks = 0,
    out = "",
    pending = "";
  for (const token of source.trim().split(/\s+/).filter(Boolean)) {
    if (token.startsWith("!")) {
      pending = token.slice(1);
      continue;
    }
    if (pending) {
      out += `<direction placement="below"><direction-type><dynamics><${pending}/></dynamics></direction-type><staff>${staff}</staff></direction>`;
      pending = "";
    }
    const note = noteXml(token, state, staff, staff === 1 ? 1 : 5, measure);
    out += note.xml;
    ticks += note.ticks;
  }
  if (ticks !== length) throw new Error(`第 ${measure} 小节第 ${staff} 谱表时值为 ${ticks / DIV} 拍，应为 ${length / DIV} 拍。`);
  return out;
}

export function buildScore(spec: ScoreSpec): string {
  const length = (spec.beats * 16 * DIV) / (spec.beatType * 4);
  const measureCount = spec.parts[0].staves[0].music.split("|").length;
  const clefLine = { G: 2, F: 4, C: 3 };
  const parts = spec.parts.map((part) => {
    const staves = part.staves.map((staff) => staff.music.split("|"));
    if (staves.some((lines) => lines.length !== measureCount)) throw new Error(`${part.name} 的小节数与其他声部不同。`);
    let xml = `<part id="${part.id}">`;
    for (let m = 0; m < measureCount; m++) {
      xml += `<measure number="${m + 1}">`;
      if (spec.repeats?.forward?.includes(m + 1)) xml += '<barline location="left"><bar-style>heavy-light</bar-style><repeat direction="forward"/></barline>';
      if (m === 0) {
        xml += `<attributes><divisions>${DIV}</divisions><key><fifths>${spec.fifths}</fifths></key><time><beats>${spec.beats}</beats><beat-type>${spec.beatType}</beat-type></time>`;
        if (part.staves.length > 1) xml += `<staves>${part.staves.length}</staves>`;
        part.staves.forEach((staff, i) => {
          xml += `<clef${part.staves.length > 1 ? ` number="${i + 1}"` : ""}><sign>${staff.clef}</sign><line>${clefLine[staff.clef]}</line></clef>`;
        });
        xml += "</attributes>";
        if (spec.tempo && part === spec.parts[0])
          xml += `<direction placement="above"><direction-type><words font-weight="bold">${escape(spec.tempo.words)}</words></direction-type><direction-type><metronome><beat-unit>quarter</beat-unit><per-minute>${spec.tempo.bpm}</per-minute></metronome></direction-type><sound tempo="${spec.tempo.bpm}"/></direction>`;
      }
      const dynamic = spec.dynamics?.[m + 1];
      part.staves.forEach((_, i) => {
        if (i > 0) xml += `<backup><duration>${length}</duration></backup>`;
        const music = dynamic && i === 0 && !staves[i][m].includes("!") ? `!${dynamic} ${staves[i][m]}` : staves[i][m];
        xml += staffMeasure(music, i + 1, m + 1, length);
      });
      if (spec.repeats?.backward?.includes(m + 1))
        xml += '<barline location="right"><bar-style>light-heavy</bar-style><repeat direction="backward"/></barline>';
      else if (m === measureCount - 1) xml += '<barline location="right"><bar-style>light-heavy</bar-style></barline>';
      xml += "</measure>";
    }
    return xml + "</part>";
  });
  const partList = spec.parts
    .map(
      (part) =>
        `<score-part id="${part.id}"><part-name>${escape(part.name)}</part-name><part-abbreviation>${escape(part.abbreviation)}</part-abbreviation>` +
        (part.program ? `<score-instrument id="${part.id}-I1"><instrument-name>${escape(part.name)}</instrument-name></score-instrument><midi-instrument id="${part.id}-I1"><midi-program>${part.program}</midi-program></midi-instrument>` : "") +
        "</score-part>",
    )
    .join("");
  return (
    '<?xml version="1.0" encoding="UTF-8"?>\n' +
    '<!DOCTYPE score-partwise PUBLIC "-//Recordare//DTD MusicXML 4.0 Partwise//EN" "http://www.musicxml.org/dtds/partwise.dtd">\n' +
    `<score-partwise version="4.0"><work><work-title>${escape(spec.title)}</work-title></work>` +
    (spec.subtitle ? `<movement-title>${escape(spec.subtitle)}</movement-title>` : "") +
    `<identification><creator type="composer">${escape(spec.composer)}</creator>` +
    (spec.arranger ? `<creator type="arranger">${escape(spec.arranger)}</creator>` : "") +
    `<rights>${escape(spec.rights)}</rights><encoding><software>Floatboat score builder</software></encoding></identification>` +
    `<part-list>${partList}</part-list>${parts.join("")}</score-partwise>\n`
  );
}

