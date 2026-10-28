// The npm release declares types/index.d.ts but does not ship that directory.
// This narrow declaration follows the 0.14.0-fix.3 source methods used here.
declare module "simple-mind-map" {
  export interface NativeNode {
    getData(key: string): unknown;
    active(): void;
    isRoot: boolean;
    nodeData: unknown;
  }
  export default class MindMap {
    constructor(options: Record<string, unknown>);
    static defineTheme(name: string, config: Record<string, unknown>): void;
    on(event: string, handler: (...args: unknown[]) => void): void;
    getData(withConfig?: boolean): unknown;
    setData(data: unknown): void;
    setTheme(name: string): void;
    setLayout(name: string): void;
    getSvgData(options?: Record<string, unknown>): {
      svgHTML: string;
      svg: { remove(): void };
      rect: { width: number; height: number };
    };
    execCommand(name: string, ...args: unknown[]): void;
    setMode(mode: "readonly" | "edit"): void;
    resize(): void;
    render(callback: () => void): void;
    destroy(): void;
    renderer: {
      root: NativeNode;
      findNodeByUid(uid: string): NativeNode | null;
      goTargetNode(uid: string): void;
      textEdit: {
        hideEditTextBox(): void;
        isShowTextEdit(): boolean;
        textEditNode: HTMLElement | null;
      };
    };
    command: { originAddHistory(): void };
    keyCommand: {
      removeShortcut(key: string): void;
      addShortcut(key: string, fn: () => void): void;
    };
    view: { fit(): void; enlarge(): void; narrow(): void };
  }
}
