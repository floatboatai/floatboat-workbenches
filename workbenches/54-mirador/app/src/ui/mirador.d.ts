declare module "mirador" {
  export interface MiradorInstance {
    store: {
      getState(): unknown;
      subscribe(callback: () => void): () => void;
      dispatch(action: unknown): unknown;
    };
    unmount(): void;
  }
  export function updateConfig(config: Record<string, unknown>): unknown;
  export function updateViewport(
    id: string,
    payload: Record<string, unknown>,
  ): unknown;
  export function viewer(config: Record<string, unknown>): MiradorInstance;
}
