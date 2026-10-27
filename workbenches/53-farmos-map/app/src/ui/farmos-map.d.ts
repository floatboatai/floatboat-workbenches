declare module "@farmos.org/farmos-map" {
  import type Map from "ol/Map.js";
  import type VectorLayer from "ol/layer/Vector.js";
  import type VectorSource from "ol/source/Vector.js";
  import type Feature from "ol/Feature.js";
  import type Geometry from "ol/geom/Geometry.js";
  import type Interaction from "ol/interaction/Interaction.js";
  interface Instance {
    map: Map;
    addLayer(
      type: "vector",
      options: { title: string; color?: string },
    ): VectorLayer<VectorSource<Feature<Geometry>>>;
  }
  export class MapInstanceManager {
    behaviors: Record<string, unknown>;
    create(
      target: string,
      options: {
        units: "metric";
        controls: false;
        interactions: Interaction[];
      },
    ): Instance;
    destroy(target: string): void;
  }
}
