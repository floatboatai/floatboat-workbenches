// ABOUTME: 元件库目录：CircuitJS1 原生类名、中文名称、分类与检索词。启用范围以原生引擎回报的可放置类为准。

export type Part = { cls: string; name: string; en: string; symbol: string; keywords?: string };
export type PartCategory = { id: string; name: string; en: string; parts: Part[] };

const p = (cls: string, name: string, en: string, symbol: string, keywords = ''): Part => ({ cls, name, en, symbol, keywords });

export const PART_CATEGORIES: PartCategory[] = [
  { id: 'wiring', name: '导线与标注', en: 'Wiring & labels', parts: [
    p('WireElm', '导线', 'Wire', '╱', 'wire line'),
    p('RoutedWireElm', '自动布线导线', 'Routed wire', '┐', 'route'),
    p('LabeledNodeElm', '标号节点', 'Labeled node', '◁', 'net label node'),
    p('TextElm', '文字', 'Text', 'T', 'note label'),
    p('BoxElm', '方框', 'Box', '▭', 'frame'),
    p('LineElm', '线条', 'Line', '—', 'draw'),
  ] },
  { id: 'passive', name: '无源元件', en: 'Passive', parts: [
    p('ResistorElm', '电阻', 'Resistor', 'R', 'ohm'),
    p('CapacitorElm', '电容', 'Capacitor', 'C', 'cap farad'),
    p('PolarCapacitorElm', '电解电容', 'Polarized capacitor', 'C+', 'electrolytic'),
    p('InductorElm', '电感', 'Inductor', 'L', 'coil henry'),
    p('PotElm', '电位器', 'Potentiometer', 'RV', 'pot variable resistor'),
    p('TransformerElm', '变压器', 'Transformer', 'TR', 'xfmr'),
    p('TappedTransformerElm', '中心抽头变压器', 'Tapped transformer', 'TR⊥', 'center tap'),
    p('CustomTransformerElm', '自定义变压器', 'Custom transformer', 'TR*', 'windings'),
    p('TransLineElm', '传输线', 'Transmission line', '≡', 'coax'),
    p('LDRElm', '光敏电阻', 'Photoresistor', 'LDR', 'light'),
    p('ThermistorNTCElm', '热敏电阻', 'Thermistor (NTC)', 'NTC', 'temperature'),
    p('MemristorElm', '忆阻器', 'Memristor', 'M', ''),
    p('SparkGapElm', '火花隙', 'Spark gap', '⚡', ''),
    p('FuseElm', '保险丝', 'Fuse', 'F', ''),
    p('CrystalElm', '晶振', 'Crystal', 'XT', 'quartz oscillator'),
    p('GyratorElm', '回转器', 'Gyrator', 'GY', ''),
  ] },
  { id: 'sources', name: '电源与信号源', en: 'Sources', parts: [
    p('GroundElm', '接地', 'Ground', '⏚', 'gnd'),
    p('DCVoltageElm', '直流电压源', 'DC voltage source', 'V', 'dc supply'),
    p('BatteryElm', '电池', 'Battery', 'B', 'cell'),
    p('ACVoltageElm', '交流电压源', 'AC voltage source', 'V~', 'sine ac'),
    p('RailElm', '电压轨（单端）', 'Voltage rail', 'V+', 'vcc rail'),
    p('ACRailElm', '交流电压轨', 'AC rail', '~+', ''),
    p('SquareRailElm', '方波源', 'Square wave', '⊓', 'pulse'),
    p('ClockElm', '时钟', 'Clock', 'CLK', 'clock digital'),
    p('SweepElm', '扫频源', 'A/C sweep', '∿', 'chirp'),
    p('VarRailElm', '可调电压', 'Variable voltage', 'V↕', 'adjustable'),
    p('AntennaElm', '天线信号', 'Antenna', 'ANT', 'radio'),
    p('AMElm', '调幅源', 'AM source', 'AM', 'modulation'),
    p('FMElm', '调频源', 'FM source', 'FM', 'modulation'),
    p('CurrentElm', '电流源', 'Current source', 'I', 'amp'),
    p('NoiseElm', '噪声源', 'Noise generator', 'N', 'random'),
  ] },
  { id: 'semis', name: '半导体', en: 'Semiconductors', parts: [
    p('DiodeElm', '二极管', 'Diode', 'D', 'rectifier'),
    p('ZenerElm', '稳压二极管', 'Zener diode', 'DZ', 'zener'),
    p('LEDElm', '发光二极管', 'LED', 'LED', 'light'),
    p('NTransistorElm', 'NPN 三极管', 'NPN transistor', 'NPN', 'bjt bipolar'),
    p('PTransistorElm', 'PNP 三极管', 'PNP transistor', 'PNP', 'bjt bipolar'),
    p('NMosfetElm', 'N 沟道 MOSFET', 'N-MOSFET', 'NMOS', 'fet'),
    p('PMosfetElm', 'P 沟道 MOSFET', 'P-MOSFET', 'PMOS', 'fet'),
    p('NJfetElm', 'N 沟道 JFET', 'N-JFET', 'NJF', 'fet'),
    p('PJfetElm', 'P 沟道 JFET', 'P-JFET', 'PJF', 'fet'),
    p('NDarlingtonElm', 'NPN 达林顿', 'Darlington (NPN)', 'NDA', ''),
    p('PDarlingtonElm', 'PNP 达林顿', 'Darlington (PNP)', 'PDA', ''),
    p('SCRElm', '晶闸管 SCR', 'SCR', 'SCR', 'thyristor'),
    p('DiacElm', '双向触发二极管', 'DIAC', 'DIAC', ''),
    p('TriacElm', '双向晶闸管', 'TRIAC', 'TRI', ''),
    p('VaractorElm', '变容二极管', 'Varactor', 'VC', 'varicap'),
    p('TunnelDiodeElm', '隧道二极管', 'Tunnel diode', 'TD', ''),
    p('UnijunctionElm', '单结晶体管', 'Unijunction', 'UJT', ''),
    p('TriodeElm', '电子管三极管', 'Triode', 'VT', 'tube valve'),
  ] },
  { id: 'opamps', name: '运放与模拟模块', en: 'Op-amps & analog blocks', parts: [
    p('OpAmpElm', '理想运放（−在上）', 'Op amp (ideal)', '▷', 'opamp'),
    p('OpAmpSwapElm', '理想运放（+在上）', 'Op amp (+ on top)', '▷+', 'opamp'),
    p('OpAmpRealElm', '实际运放', 'Op amp (real)', '▷R', 'opamp 741 lm324'),
    p('ComparatorElm', '比较器', 'Comparator', 'CMP', ''),
    p('SchmittElm', '施密特触发器', 'Schmitt trigger', 'ST', 'hysteresis'),
    p('InvertingSchmittElm', '反相施密特触发器', 'Inverting Schmitt', 'ST̄', 'hysteresis'),
    p('OTAElm', '跨导放大器 OTA', 'OTA (LM13700)', 'OTA', ''),
    p('NortonAmpElm', '诺顿放大器', 'Norton amp (LM3900)', 'NA', ''),
    p('CC2Elm', '电流传输器 CCII+', 'CCII+', 'CC+', 'conveyor'),
    p('CC2NegElm', '电流传输器 CCII−', 'CCII-', 'CC−', 'conveyor'),
    p('AnalogSwitchElm', '模拟开关 SPST', 'Analog switch', 'AS', ''),
    p('AnalogSwitch2Elm', '模拟开关 SPDT', 'Analog switch SPDT', 'AS2', ''),
    p('AnalogMuxElm', '模拟多路器', 'Analog multiplexer', 'AMX', 'mux'),
    p('TriStateElm', '三态缓冲器', 'Tristate buffer', '▷z', ''),
    p('DelayBufferElm', '延迟缓冲器', 'Delay buffer', 'DLY', ''),
    p('ControlledVoltageElm', '受控电压源', 'Controlled voltage source', 'CV', 'dependent'),
    p('ControlledCurrentElm', '受控电流源', 'Controlled current source', 'CI', 'dependent'),
    p('VCVSElm', '压控电压源 VCVS', 'VCVS', 'E', 'dependent'),
    p('VCCSElm', '压控电流源 VCCS', 'VCCS', 'G', 'dependent'),
    p('CCVSElm', '流控电压源 CCVS', 'CCVS', 'H', 'dependent'),
    p('CCCSElm', '流控电流源 CCCS', 'CCCS', 'F', 'dependent'),
    p('OptocouplerElm', '光耦', 'Optocoupler', 'OC', 'opto isolator'),
    p('SubcircuitElm:~LM317-v2', 'LM317 稳压器', 'LM317', '317', 'regulator'),
    p('SubcircuitElm:~TL431', 'TL431 基准', 'TL431', '431', 'reference shunt'),
  ] },
  { id: 'logic', name: '逻辑门与 I/O', en: 'Logic gates & I/O', parts: [
    p('LogicInputElm', '逻辑输入', 'Logic input', 'IN', 'switch high low'),
    p('LogicOutputElm', '逻辑输出', 'Logic output', 'OUT', 'probe'),
    p('BusLogicInputElm', '总线输入', 'Bus input', 'BUS', ''),
    p('InverterElm', '非门', 'Inverter (NOT)', 'NOT', 'not'),
    p('AndGateElm', '与门', 'AND gate', 'AND', 'and'),
    p('NandGateElm', '与非门', 'NAND gate', 'NAND', 'nand'),
    p('OrGateElm', '或门', 'OR gate', 'OR', 'or'),
    p('NorGateElm', '或非门', 'NOR gate', 'NOR', 'nor'),
    p('XorGateElm', '异或门', 'XOR gate', 'XOR', 'xor'),
    p('XnorGateElm', '同或门', 'XNOR gate', 'XNOR', 'xnor'),
  ] },
  { id: 'digital', name: '数字芯片', en: 'Digital chips', parts: [
    p('DFlipFlopElm', 'D 触发器', 'D flip-flop', 'DFF', 'flipflop register'),
    p('JKFlipFlopElm', 'JK 触发器', 'JK flip-flop', 'JK', 'flipflop'),
    p('TFlipFlopElm', 'T 触发器', 'T flip-flop', 'TFF', 'flipflop toggle'),
    p('SevenSegElm', '七段数码管', '7-segment LED', '8.', 'display'),
    p('SevenSegDecoderElm', '七段译码器', '7-segment decoder', 'DEC', 'bcd'),
    p('MultiplexerElm', '多路选择器', 'Multiplexer', 'MUX', ''),
    p('DeMultiplexerElm', '多路分配器', 'Demultiplexer', 'DMX', ''),
    p('SipoShiftElm', '串入并出移位寄存器', 'SIPO shift register', 'SIPO', ''),
    p('PisoShiftElm', '并入串出移位寄存器', 'PISO shift register', 'PISO', ''),
    p('CounterElm', '计数器', 'Counter', 'CNT', ''),
    p('Counter2Elm', '可预置计数器', 'Counter w/ load', 'CNT↓', ''),
    p('DecadeElm', '环形计数器', 'Ring counter', 'RING', 'decade 4017'),
    p('LatchElm', '锁存器 / 寄存器', 'Latch', 'LAT', 'register'),
    p('SeqGenElm', '序列发生器', 'Sequence generator', 'SEQ', ''),
    p('FullAdderElm', '全加器', 'Full adder', 'ADD', ''),
    p('HalfAdderElm', '半加器', 'Half adder', 'HA', ''),
    p('UserDefinedLogicElm', '自定义逻辑', 'Custom logic', 'f(x)', 'truth table'),
    p('SRAMElm', '静态 RAM', 'Static RAM', 'RAM', 'memory'),
    p('ROMElm', 'ROM', 'ROM', 'ROM', 'memory'),
    p('BusTransceiverElm', '总线收发器', 'Bus transceiver', 'BTX', ''),
    p('BusSplitterElm', '总线拆分器', 'Bus splitter', 'SPL', ''),
  ] },
  { id: 'mixed', name: '定时与混合信号芯片', en: 'Timers & mixed-signal', parts: [
    p('TimerElm', '555 定时器', '555 timer', '555', 'timer astable'),
    p('MonostableElm', '单稳态', 'Monostable', 'MONO', 'one-shot'),
    p('PhaseCompElm', '鉴相器', 'Phase comparator', 'PC', 'pll'),
    p('VCOElm', '压控振荡器 VCO', 'VCO', 'VCO', 'oscillator'),
    p('DACElm', '数模转换 DAC', 'DAC', 'DAC', 'converter'),
    p('ADCElm', '模数转换 ADC', 'ADC', 'ADC', 'converter'),
  ] },
  { id: 'switches', name: '开关与继电器', en: 'Switches & relays', parts: [
    p('SwitchElm', '开关', 'Switch (SPST)', 'S', 'toggle'),
    p('PushSwitchElm', '按钮开关', 'Push switch', 'PB', 'button momentary'),
    p('Switch2Elm', '单刀双掷开关', 'SPDT switch', 'S2', 'spdt'),
    p('DPDTSwitchElm', '双刀双掷开关', 'DPDT switch', 'DPDT', ''),
    p('MBBSwitchElm', '先合后断开关', 'Make-before-break switch', 'MBB', ''),
    p('CrossSwitchElm', '交叉开关', 'Cross switch', '✕', ''),
    p('RelayElm', '继电器', 'Relay', 'K', ''),
    p('RelayCoilElm', '继电器线圈', 'Relay coil', 'K○', ''),
    p('RelayContactElm', '继电器触点', 'Relay contact', 'K/', ''),
    p('TimeDelayRelayElm', '时间继电器', 'Time delay relay', 'KT', 'timer'),
    p('MotorProtectionSwitchElm', '电机保护开关', 'Motor protection switch', 'MPS', 'breaker'),
  ] },
  { id: 'meters', name: '仪表与输出', en: 'Meters & outputs', parts: [
    p('ProbeElm', '电压表 / 示波探针', 'Voltmeter / scope probe', 'VM', 'voltmeter'),
    p('AmmeterElm', '电流表', 'Ammeter', 'A', 'current meter'),
    p('OhmMeterElm', '欧姆表', 'Ohmmeter', 'Ω', ''),
    p('WattmeterTrueElm', '功率表', 'Wattmeter', 'W', 'power'),
    p('WattmeterElm', '功率表（旧版）', 'Wattmeter (old)', 'W⁰', 'power'),
    p('OutputElm', '模拟输出', 'Analog output', '○', 'node'),
    p('TestPointElm', '测试点', 'Test point', 'TP', ''),
    p('LampElm', '灯泡', 'Lamp', '◎', 'bulb'),
    p('LEDArrayElm', 'LED 阵列', 'LED array', '⁘', 'matrix'),
    p('DecimalDisplayElm', '十进制显示', 'Decimal display', '123', ''),
    p('InstructionDisplayElm', '指令显示', 'Instruction display', 'ASM', ''),
    p('DCMotorElm', '直流电机', 'DC motor', 'M', ''),
    p('ThreePhaseMotorElm', '三相电机', '3-phase motor', 'M3', ''),
    p('StopTriggerElm', '停止触发器', 'Stop trigger', '■', 'halt'),
  ] },
];

export const ALL_PARTS: Part[] = PART_CATEGORIES.flatMap(c => c.parts);
const BY_CLASS = new Map(ALL_PARTS.map(part => [part.cls, part]));
export const QUICK_PARTS = ['WireElm', 'ResistorElm', 'CapacitorElm', 'InductorElm', 'DCVoltageElm', 'GroundElm', 'SwitchElm'];
/** Loaded dumps construct the generic base class (e.g. TransistorElm for both NPN and PNP). */
const LIVE_NAMES: Record<string, string> = {
  VoltageElm: '电压源', TransistorElm: '三极管', MosfetElm: 'MOSFET', JfetElm: 'JFET', DarlingtonElm: '达林顿管',
  RingCounterElm: '环形计数器', CustomLogicElm: '自定义逻辑', SubcircuitElm: '子电路', ScopeElm: '画布示波器', ExtVoltageElm: '外部电压',
};
export function partFor(cls: string): Part | undefined {
  return BY_CLASS.get(cls);
}
/** Readable label for a live element's constructor name. */
export function partLabel(cls: string): string {
  return BY_CLASS.get(cls)?.name ?? LIVE_NAMES[cls] ?? cls.replace(/Elm$/, '');
}
const normalize = (s: string) => s.toLowerCase().replace(/[\s\-_/()（）]+/g, '');
export function searchParts(query: string, categories: PartCategory[] = PART_CATEGORIES): PartCategory[] {
  const q = normalize(query);
  if (!q) return categories;
  return categories.map(c => ({ ...c, parts: c.parts.filter(part => [part.name, part.en, part.symbol, part.cls, part.keywords ?? '', c.name].some(text => normalize(text).includes(q))) })).filter(c => c.parts.length);
}
/** Best single match for keyboard Enter: exact name/symbol beats prefix beats substring. */
export function bestPart(query: string, usable: (cls: string) => boolean = () => true): Part | undefined {
  const q = normalize(query);
  if (!q) return undefined;
  let best: Part | undefined, bestScore = 0;
  for (const part of ALL_PARTS) {
    if (!usable(part.cls)) continue;
    const fields = [part.name, part.en, part.symbol, part.cls.replace(/Elm$/, '')].map(normalize);
    const score = fields.some(f => f === q) ? 4 : fields.some(f => f.startsWith(q)) ? 3 : fields.some(f => f.includes(q)) ? 2 : normalize(part.keywords ?? '').includes(q) ? 1 : 0;
    if (score > bestScore) { best = part; bestScore = score; }
  }
  return best;
}
