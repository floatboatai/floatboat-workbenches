export interface Point {
  x: number;
  y: number;
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
  serialize(): Record<string, unknown>;
  move(dx: number, dy: number): void;
}
export class Scene {
  static serializableDefaults: Record<string, unknown>;
  objs: NativeObject[];
  width: number;
  height: number;
  origin: Point;
  scale: number;
  showGrid: boolean;
  rayModeDensity: number;
  maxRayDepth: number;
  name: string;
  error: string | null;
  warning: string | null;
  simulator: Simulator;
  editor: Editor;
  constructor();
  loadJSON(
    source: string,
    cb: (updated: boolean, completed: boolean) => void,
  ): void;
  toJSON(): string;
  setViewportSize(w: number, h: number): void;
  pushObj(obj: NativeObject): void;
  removeObj(i: number): void;
}
export class Simulator {
  constructor(
    scene: Scene,
    main?: CanvasRenderingContext2D | null,
    below?: CanvasRenderingContext2D | null,
    above?: CanvasRenderingContext2D | null,
    grid?: CanvasRenderingContext2D | null,
    virtual?: CanvasRenderingContext2D | null,
    enableTimer?: boolean,
    rayLimit?: number,
  );
  dpr: number;
  manualLightRedraw: boolean;
  isLightLayerSynced: boolean;
  simulationTimerId: number;
  shouldSimulatorStop: boolean;
  pendingRays: unknown[];
  processedRayCount: number;
  totalTruncation: number;
  error: string | null;
  warning: string | null;
  eventListeners: Record<string, unknown[]>;
  on(event: string, cb: (data: unknown) => void): void;
  updateSimulation(
    skipLight?: boolean,
    skipGrid?: boolean,
    forceRedraw?: boolean,
  ): void;
  manualRedrawLightLayer(): void;
  stopSimulation(): void;
}
export class Editor {
  constructor(scene: Scene, canvas: HTMLCanvasElement, simulator: Simulator);
  selectedObjIndex: number;
  addingObjType: string;
  isConstructing: boolean;
  positioningObjIndex: number;
  delayedValidationTimerId: number;
  longPressTimer: number | null;
  eventListeners: Record<string, unknown[]>;
  on(event: string, cb: (data: unknown) => void): void;
  onActionComplete(fromJson?: boolean): void;
  selectObj(index: number): void;
  removeObj(index: number): void;
  undo(): void;
  redo(): void;
  setScale(scale: number): void;
  endPositioning(): void;
  moveSelected(dx: number, dy: number): void;
}
export const sceneObjs: Record<
  string,
  {
    new (scene: Scene, data: Record<string, unknown>): NativeObject;
    serializableDefaults: Record<string, unknown>;
  }
>;
