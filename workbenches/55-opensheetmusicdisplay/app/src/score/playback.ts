// ABOUTME: 用 Web Audio 合成器按 OSMD 光标逐个时值回放可见声部，并驱动光标移动；不加载任何音色文件。
import type { Note, OpenSheetMusicDisplay } from "opensheetmusicdisplay";

export interface PlaybackOptions {
  tempo: () => number;
  transpose: () => number;
  hidden: () => string[];
  onStep: () => void;
  onEnd: () => void;
}

const LOOKAHEAD = 0.06;

export class Player {
  private context?: AudioContext;
  private master?: GainNode;
  private timer?: ReturnType<typeof setTimeout>;
  private time = 0;
  private voices = new Set<OscillatorNode>();
  playing = false;

  constructor(
    private engine: OpenSheetMusicDisplay,
    private options: PlaybackOptions,
  ) {}

  static supported(): boolean {
    return typeof window !== "undefined" && typeof window.AudioContext === "function";
  }

  async start(): Promise<void> {
    if (this.playing) return;
    this.context ??= new AudioContext();
    await this.context.resume();
    if (!this.master) {
      const compressor = this.context.createDynamicsCompressor();
      compressor.connect(this.context.destination);
      this.master = this.context.createGain();
      this.master.gain.value = 0.5;
      this.master.connect(compressor);
    }
    const cursor = this.engine.cursor;
    cursor.show();
    if (cursor.Iterator.EndReached) cursor.reset();
    this.playing = true;
    this.time = this.context.currentTime + LOOKAHEAD;
    this.play();
  }

  stop(): void {
    this.playing = false;
    if (this.timer) clearTimeout(this.timer);
    this.timer = undefined;
    const now = this.context?.currentTime ?? 0;
    for (const voice of this.voices)
      try {
        voice.stop(now + 0.03);
      } catch {
        /* 已停止的振荡器 */
      }
    this.voices.clear();
  }

  dispose(): void {
    this.stop();
    void this.context?.close();
    this.context = undefined;
    this.master = undefined;
  }

  private wholeNoteSeconds(): number {
    const bpm = this.engine.cursor.Iterator.CurrentBpm || this.engine.Sheet.DefaultStartTempoInBpm || 100;
    return 240 / ((bpm * this.options.tempo()) / 100);
  }

  /** 在 this.time 发声当前光标下的音符，然后安排下一步。 */
  private play(): void {
    if (!this.playing || !this.context) return;
    const cursor = this.engine.cursor;
    const iterator = cursor.Iterator;
    if (iterator.EndReached) {
      this.playing = false;
      this.options.onEnd();
      return;
    }
    const whole = this.wholeNoteSeconds();
    const hidden = this.options.hidden();
    const notes: Note[] = [];
    for (const instrument of this.engine.Sheet.Instruments)
      if (!hidden.includes(instrument.IdString)) notes.push(...cursor.NotesUnderCursor(instrument));
    const sounding = notes.filter((note) => !note.isRest() && note.Pitch && (!note.NoteTie || note.NoteTie.StartNote === note));
    for (const note of sounding) {
      const length = (note.NoteTie ? note.NoteTie.Duration : note.Length).RealValue * whole;
      const pitch = note.TransposedPitch ?? note.Pitch;
      const shift = note.TransposedPitch ? 0 : this.options.transpose();
      this.voice(pitch.Frequency * 2 ** (shift / 12), this.time, Math.max(0.08, length), sounding.length);
    }
    const start = iterator.CurrentEnrolledTimestamp.RealValue;
    const peek = iterator.clone();
    peek.moveToNext();
    while (!peek.EndReached && peek.CurrentEnrolledTimestamp.RealValue <= start) peek.moveToNext();
    const fallback = Math.max(0.25, ...notes.map((note) => note.Length.RealValue));
    const gap = (peek.EndReached ? fallback : peek.CurrentEnrolledTimestamp.RealValue - start) * whole;
    const wait = Math.max(0, (this.time + gap - this.context.currentTime - LOOKAHEAD) * 1000);
    this.timer = setTimeout(() => this.advance(start, whole), wait);
  }

  private advance(previous: number, whole: number): void {
    if (!this.playing) return;
    const cursor = this.engine.cursor;
    cursor.next();
    this.options.onStep();
    if (cursor.Iterator.EndReached) {
      this.playing = false;
      this.options.onEnd();
      return;
    }
    const step = cursor.Iterator.CurrentEnrolledTimestamp.RealValue - previous;
    this.time += Math.max(0, step) * whole;
    // 被浏览器节流（后台标签）后不追赶旧时间。
    if (this.context && this.time < this.context.currentTime) this.time = this.context.currentTime + LOOKAHEAD;
    this.play();
  }

  private voice(frequency: number, at: number, length: number, polyphony: number): void {
    if (!this.context || !this.master || !Number.isFinite(frequency) || frequency < 20 || frequency > 8000) return;
    const context = this.context;
    const level = 0.32 / Math.sqrt(Math.max(1, polyphony));
    const gain = context.createGain();
    const filter = context.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.value = Math.min(6000, frequency * 6);
    const body = context.createOscillator();
    body.type = "triangle";
    body.frequency.value = frequency;
    const shine = context.createOscillator();
    shine.type = "sine";
    shine.frequency.value = frequency * 2;
    const shineGain = context.createGain();
    shineGain.gain.value = 0.18;
    const end = at + length;
    gain.gain.setValueAtTime(0, at);
    gain.gain.linearRampToValueAtTime(level, at + 0.012);
    gain.gain.exponentialRampToValueAtTime(level * 0.45, at + Math.min(0.35, length * 0.6));
    gain.gain.setValueAtTime(level * 0.45, Math.max(at + 0.02, end - 0.04));
    gain.gain.exponentialRampToValueAtTime(0.0001, end + 0.12);
    body.connect(filter);
    shine.connect(shineGain).connect(filter);
    filter.connect(gain).connect(this.master);
    for (const oscillator of [body, shine]) {
      oscillator.start(at);
      oscillator.stop(end + 0.15);
      this.voices.add(oscillator);
      oscillator.onended = () => this.voices.delete(oscillator);
    }
  }
}
