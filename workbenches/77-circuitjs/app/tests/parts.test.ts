// ABOUTME: 元件库目录与引擎元件策略：覆盖上游菜单全部元件，排除项有理由，源码检查识别不开放/未知条目。

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { ALL_PARTS, PART_CATEGORIES, QUICK_PARTS, bestPart, partLabel, searchParts } from '../src/contracts/parts.ts';
import { parseValue, sliderDraft, suggestRange } from '../src/contracts/sliders.ts';
import { si, stepsPerSecond } from '../src/contracts/units.ts';
import { TIMER_SOURCE, seed, validateCircuit } from '../src/contracts/circuit.ts';

const manifest = JSON.parse(readFileSync(new URL('../manifest.json', import.meta.url), 'utf8'));
const notices = manifest.resources.find((x: { id: string }) => x.id === 'notices').path;
// The engine policy lives with the bridge in the declared engine-source resource (relocated in source packages).
const engineSource = manifest.resources.find((x: { id: string }) => x.id === 'engine-source').path;
const { BLOCKED_ELEMENTS, RACK_OMITTED, MAX_ENTRIES, checkTextSource, describeCheck } = await import(new URL(`../${engineSource}/policy.js`, import.meta.url).href);
const menus = readFileSync(new URL(`../${notices}/upstream/ts/Menus.ts`, import.meta.url), 'utf8');
const compose = menus.slice(menus.indexOf('composeMainMenu(menu: Menu'), menus.indexOf('makeClassCheckItems(menu: Menu'));
const upstreamMenu = new Set([...compose.matchAll(/"([A-Za-z0-9]+Elm(?::~[\w-]+)?)"/g)].map(m => m[1]));

test('upstream main menu has ~150 element entries and every one is in the rack or excluded with a reason', () => {
  assert.ok(upstreamMenu.size > 140, `menu classes: ${upstreamMenu.size}`);
  const rack = new Set(ALL_PARTS.map(p => p.cls));
  const missing = [...upstreamMenu].filter(cls => !rack.has(cls) && !(cls in BLOCKED_ELEMENTS) && !(cls in RACK_OMITTED));
  assert.deepEqual(missing, []);
  for (const cls of rack) assert.ok(upstreamMenu.has(cls), `rack part not in upstream menu: ${cls}`);
  for (const cls of Object.keys(BLOCKED_ELEMENTS)) { assert.ok(upstreamMenu.has(cls)); assert.ok(!rack.has(cls)); }
  for (const [cls, reason] of Object.entries({ ...BLOCKED_ELEMENTS, ...RACK_OMITTED })) assert.ok(String(reason).length > 20, `${cls} needs a reason`);
  assert.equal(new Set(ALL_PARTS.map(p => p.cls)).size, ALL_PARTS.length, 'no duplicates');
  assert.ok(ALL_PARTS.length >= 140);
});

test('only file/audio-input elements are blocked; rack covers the requested categories', () => {
  assert.deepEqual(Object.keys(BLOCKED_ELEMENTS).sort(), ['AudioInputElm', 'DataInputElm', 'DataRecorderElm']);
  const names = PART_CATEGORIES.map(c => c.id);
  for (const id of ['passive', 'sources', 'semis', 'opamps', 'logic', 'digital', 'switches', 'meters']) assert.ok(names.includes(id), id);
  for (const cls of ['NTransistorElm', 'NMosfetElm', 'LEDElm', 'ZenerElm', 'PotElm', 'TimerElm', 'AndGateElm', 'OrGateElm', 'InverterElm', 'NandGateElm', 'NorGateElm', 'XorGateElm', 'LogicInputElm', 'LogicOutputElm', 'SevenSegElm', 'TransformerElm', 'RelayElm', 'DACElm', 'ADCElm', 'CounterElm', 'DFlipFlopElm'])
    assert.ok(ALL_PARTS.some(p => p.cls === cls), cls);
  for (const cls of QUICK_PARTS) assert.ok(ALL_PARTS.some(p => p.cls === cls), cls);
});

test('part search matches Chinese, English, symbols and ranks exact matches for Enter', () => {
  assert.equal(bestPart('led')?.cls, 'LEDElm');
  assert.equal(bestPart('555')?.cls, 'TimerElm');
  assert.equal(bestPart('npn')?.cls, 'NTransistorElm');
  assert.equal(bestPart('与门')?.cls, 'AndGateElm');
  assert.equal(bestPart('and', cls => cls !== 'AndGateElm')?.cls !== 'AndGateElm', true);
  assert.ok(searchParts('mosfet').flatMap(c => c.parts).some(p => p.cls === 'PMosfetElm'));
  assert.equal(searchParts('').length, PART_CATEGORIES.length);
  assert.equal(searchParts('zzzz-not-a-part').length, 0);
  assert.equal(partLabel('TransistorElm'), '三极管');
  assert.equal(partLabel('ResistorElm'), '电阻');
});

const DUMP = new Map<number, string>([
  ['w'.charCodeAt(0), 'WireElm'], ['r'.charCodeAt(0), 'ResistorElm'], ['t'.charCodeAt(0), 'TransistorElm'], ['g'.charCodeAt(0), 'GroundElm'],
  ['R'.charCodeAt(0), 'RailElm'], [162, 'LEDElm'], [165, 'TimerElm'], [150, 'AndGateElm'], ['L'.charCodeAt(0), 'LogicInputElm'], ['M'.charCodeAt(0), 'LogicOutputElm'],
  [411, 'AudioInputElm'], [434, 'DataInputElm'],
]);

test('text-format check counts classes, skips options/scopes/models/sliders and reports blocked or unknown entries', () => {
  const ok = checkTextSource('$ 1 5e-6 10 50 5 50\nr 0 0 64 0 0 1000\nt 64 0 96 0 0 1 -1 0.6 0.6 100 default\n165 0 64 16 64 6 0\n150 0 128 64 128 0 2 0 5\nL 0 160 32 160 0 0 false 5 0\nM 64 160 96 160 0 2.5\no 1 64 0 4099 5 0.1 0 2 1 3\n38 0 0 1 1000 R\n34 default 0 1e-14 0 1 0 0 0\n', DUMP);
  assert.deepEqual(ok.classes, { ResistorElm: 1, TransistorElm: 1, TimerElm: 1, AndGateElm: 1, LogicInputElm: 1, LogicOutputElm: 1 });
  assert.equal(describeCheck(ok), '');
  const blocked = checkTextSource('r 0 0 64 0 0 1000\n411 0 0 64 0 0 song.wav\n', DUMP);
  assert.deepEqual(blocked.blocked, ['AudioInputElm']);
  assert.match(describeCheck(blocked), /音频输入/);
  const inModel = checkTextSource('. sub 0 AudioInputElm 1 2\n', DUMP);
  assert.deepEqual(inModel.blocked, ['AudioInputElm']);
  const unknown = checkTextSource('r 0 0 64 0 0 1000\nqq 0 0 1 1 0\n999 0 0 1 1 0\n', DUMP);
  assert.deepEqual(unknown.unknown, ['qq', '999']);
  assert.match(describeCheck(unknown), /不识别/);
  const large = checkTextSource(Array.from({ length: MAX_ENTRIES + 1 }, (_, i) => `w ${i} 0 ${i} 16 0`).join('\n'), DUMP);
  assert.match(describeCheck(large), /安全上限/);
  // 420-entry real-world example sizes are well inside the cap (old 0.8 build stopped at 256).
  assert.equal(describeCheck(checkTextSource(Array.from({ length: 420 }, (_, i) => `w ${i} 0 ${i} 16 0`).join('\n'), DUMP)), '');
});

test('seed is a 555 LED flasher with a slider and passes the formal validator', () => {
  assert.equal(seed.source, TIMER_SOURCE);
  const check = checkTextSource(TIMER_SOURCE, DUMP);
  assert.equal(check.classes.TimerElm, 1);
  assert.equal(check.classes.LEDElm, 1);
  assert.match(TIMER_SOURCE, /\n38 13 0 4700 220000 Timing\\sResistor\n/);
  assert.deepEqual(validateCircuit(seed), seed);
});

test('slider drafts keep unfinished text; engineering values parse like CircuitJS fields', () => {
  assert.equal(parseValue('4.7k'), 4700);
  assert.ok(Math.abs(parseValue('100n') - 100e-9) < 1e-20);
  assert.ok(Math.abs(parseValue('2.2 μF') - 2.2e-6) < 1e-18);
  assert.equal(parseValue('1e3'), 1000);
  assert.ok(Number.isNaN(parseValue('4.7 k2')));
  assert.ok(Number.isNaN(parseValue('')));
  const draft = { element: 3, item: 0, label: '定时', min: '4.7', max: '-', log: false };
  assert.deepEqual(sliderDraft(draft), draft);
  assert.equal(sliderDraft({ ...draft, element: 1.5 }), null);
  assert.equal(sliderDraft({ ...draft, min: 5 }), null);
  assert.deepEqual(suggestRange(47000, 0, 0), ['4.7k', '470k']);
  assert.deepEqual(suggestRange(5, 1, 10), ['1', '10']);
  assert.equal(si(0.0015, 'A'), '1.5 mA');
  assert.equal(si(47000, 'Ω'), '47 kΩ');
  assert.equal(si(NaN), '—');
  assert.ok(Math.abs(stepsPerSecond(117) * 5e-6 - 0.000825) < 0.00001);
});
