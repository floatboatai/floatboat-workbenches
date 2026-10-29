export interface Point {
  x: number;
  y: number;
}
export interface PropertyDescriptor {
  key: string;
  type: string;
  label: string;
}
export interface NativeObject {
  [key: string]: unknown;
  p1?: Point;
  p2?: Point;
  x?: number;
  y?: number;
  power?: number;
  normal?: number;
  shear?: number;
  error?: string | null;
  warning?: string | null;
  name: string;
  scene: Scene;
  constructor: NativeObjectClass;
  serialize(): Record<string, unknown>;
  move(dx: number, dy: number): void;
  populateObjBar(objBar: unknown): void;
}
export interface NativeObjectClass {
  new (scene: Scene, data: Record<string, unknown>): NativeObject;
  type: string;
  isOptical: boolean;
  serializableDefaults: Record<string, unknown>;
  getPropertySchema(objData: Record<string, unknown>, scene: Scene): PropertyDescriptor[];
}
export interface Observer {
  c: Point;
  r: number;
}
export class Scene {
  static serializableDefaults: Record<string, unknown>;
  objs: NativeObject[];
  width: number;
  height: number;
  origin: Point;
  scale: number;
  mode: string;
  showGrid: boolean;
  snapToGrid: boolean;
  lockObjs: boolean;
  gridSize: number;
  rayModeDensity: number;
  imageModeDensity: number;
  simulateColors: boolean;
  colorMode: string;
  redWavelength: number;
  violetWavelength: number;
  showRayArrows: boolean;
  maxRayDepth: number | null;
  observer: Observer | null;
  theme: { background: { color: { r: number; g: number; b: number } } } & Record<string, unknown>;
  name: string;
  error: string | null;
  warning: string | null;
  simulator: Simulator;
  editor: Editor;
  constructor();
  loadJSON(source: string, cb: (updated: boolean, completed: boolean) => void): void;
  toJSON(): string;
  setViewportSize(w: number, h: number): void;
  pushObj(obj: NativeObject): void;
  removeObj(i: number): void;
}
export class Simulator {
  static UV_WAVELENGTH: number;
  static INFRARED_WAVELENGTH: number;
  constructor(
    scene: Scene,
    main?: CanvasRenderingContext2D | null,
    below?: CanvasRenderingContext2D | null,
    above?: CanvasRenderingContext2D | null,
    grid?: CanvasRenderingContext2D | null,
    virtual?: CanvasRenderingContext2D | null,
    enableTimer?: boolean,
    rayCountLimit?: number,
    glMain?: WebGLRenderingContext | null,
    glVirtual?: WebGLRenderingContext | null,
    tempCanvasFactory?: ((w: number, h: number) => HTMLCanvasElement) | null,
  );
  dpr: number;
  rayCountLimit: number;
  manualLightRedraw: boolean;
  isLightLayerSynced: boolean;
  simulationTimerId: number;
  shouldSimulatorStop: boolean;
  pendingRays: unknown[];
  processedRayCount: number;
  totalTruncation: number;
  brightnessScale: number;
  simulationStartTime: Date;
  error: string | null;
  warning: string | null;
  eventListeners: Record<string, unknown[]>;
  canvasRendererMain: { destroy?: () => void } | null;
  on(event: string, cb: (data: unknown) => void): void;
  updateSimulation(skipLight?: boolean, skipGrid?: boolean, forceRedraw?: boolean): void;
  stopSimulation(): void;
}
export class Editor {
  constructor(scene: Scene, canvas: HTMLCanvasElement, simulator: Simulator);
  selectedObjIndex: number;
  isConstructing: boolean;
  positioningObjIndex: number;
  delayedValidationTimerId: number;
  longPressTimer: number | null;
  undoIndex: number;
  undoLBound: number;
  undoUBound: number;
  eventListeners: Record<string, unknown[]>;
  on(event: string, cb: (data: unknown) => void): void;
  onActionComplete(fromJson?: boolean): void;
  loadJSON(json: string): void;
  selectObj(index: number): void;
  removeObj(index: number): void;
  undo(): void;
  redo(): void;
  setScale(scale: number): void;
  setScaleWithCenter(scale: number, x: number, y: number): void;
  endPositioning(): void;
}
export const sceneObjs: Record<string, NativeObjectClass>;
export const geometry: Record<string, (...args: never[]) => unknown>;
export const i18next: { t(key: string, options?: Record<string, unknown>): string };
