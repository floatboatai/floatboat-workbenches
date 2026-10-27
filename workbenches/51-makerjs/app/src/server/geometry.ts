import makerjs from "makerjs";
import { validateDrawing, type DrawingResult } from "../contracts/drawing.ts";
export function makeDrawing(value: unknown): DrawingResult {
  const d = validateDrawing(value),
    model: makerjs.IModel = {
      units: makerjs.unitType.Millimeter,
      models: {
        outline: new makerjs.models.RoundRectangle(d.width, d.height, d.radius),
      },
      paths: {},
    };
  let holes = 0;
  const hole = (x: number, y: number) => {
    model.paths![`hole_${++holes}`] = new makerjs.paths.Circle(
      [x, y],
      d.diameter / 2,
    );
  };
  if (d.template === "panel") {
    for (const x of [d.inset, d.width - d.inset])
      for (const y of [d.inset, d.height - d.inset]) hole(x, y);
  } else if (d.template === "perforated") {
    const x0 = (d.width - (d.columns - 1) * d.pitchX) / 2,
      y0 = (d.height - (d.rows - 1) * d.pitchY) / 2;
    for (let row = 0; row < d.rows; row++)
      for (let column = 0; column < d.columns; column++)
        hole(x0 + column * d.pitchX, y0 + row * d.pitchY);
  } else {
    const inner = new makerjs.models.RoundRectangle(
      d.width - 2 * d.wall,
      d.height - 2 * d.wall,
      Math.max(0, d.radius - d.wall),
    );
    inner.origin = [d.wall, d.wall];
    model.models!.opening = inner;
  }
  const svg = makerjs.exporter.toSVG(model, {
    units: makerjs.unitType.Millimeter,
    stroke: "#26384b",
    strokeWidth: "1",
    fill: "none",
  });
  const dxf = makerjs.exporter.toDXF(model, {
    units: makerjs.unitType.Millimeter,
  });
  return {
    svg,
    dxf,
    width: d.width,
    height: d.height,
    holes,
    cutLength: makerjs.measure.modelPathLength(model),
  };
}
