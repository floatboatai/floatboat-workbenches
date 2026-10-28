export interface NodeRow {
  index: number;
  name: string;
  mesh: string;
  children: number;
  translation: number[];
  extras: string;
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
}
export interface Inspection {
  engine: string;
  bytes: number;
  vertices: number;
  instancedVertices: number;
  meshes: number;
  skins: number;
  animations: { name: string; duration: number }[];
  pixels: number;
  nodes: NodeRow[];
  materials: MaterialRow[];
  images: { name: string; bytes: number; mime: string; hash: string }[];
  scenes: string[];
  geometryBytes: number;
  rootExtras: string;
}
