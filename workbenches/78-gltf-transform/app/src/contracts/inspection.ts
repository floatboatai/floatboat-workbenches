import type { StageReport } from "./pipeline.ts";

export interface NodeRow {
  index: number;
  name: string;
  mesh: string;
  parent: number;
  depth: number;
  children: number;
  translation: [number, number, number];
  /** Quaternion XYZW as stored. */
  quaternion: [number, number, number, number];
  /** Euler XYZ degrees derived from the quaternion for editing. */
  rotation: [number, number, number];
  scale: [number, number, number];
  extras: string;
  animated: boolean;
  skinned: boolean;
  instances: number;
}
export interface MaterialRow {
  index: number;
  name: string;
  color: string;
  factor: number[];
  opacity: string;
  metallic: string;
  roughness: string;
  alphaMode: "OPAQUE" | "MASK" | "BLEND";
  doubleSided: boolean;
  extras: string;
  texture: string;
  textures: number[];
  extensions: string[];
}
export interface TextureRow {
  index: number;
  name: string;
  mime: string;
  width: number;
  height: number;
  bytes: number;
  gpuBytes: number;
  slots: string[];
  materials: string[];
  hash: string;
}
export interface MeshRow {
  name: string;
  primitives: number;
  vertices: number;
  triangles: number;
  instances: number;
  bytes: number;
  attributes: string[];
}
export interface AnimationRow {
  name: string;
  duration: number;
  channels: number;
  samplers: number;
  keyframes: number;
  bytes: number;
  targets: string[];
}
export interface Inspection {
  engine: string;
  bytes: number;
  report: StageReport;
  skins: number;
  scenes: string[];
  bounds: { min: number[]; max: number[] } | null;
  nodes: NodeRow[];
  meshes: MeshRow[];
  materials: MaterialRow[];
  textures: TextureRow[];
  animations: AnimationRow[];
  extensions: { name: string; required: boolean }[];
  warnings: string[];
  rootExtras: string;
  generator: string;
}
