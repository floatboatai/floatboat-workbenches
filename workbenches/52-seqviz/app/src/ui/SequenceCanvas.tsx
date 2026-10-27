import { memo, useMemo } from "react";
import { SeqViz, type SeqVizProps } from "seqviz";
import type { Feature, Range } from "../contracts/sequence";
import { toViewerRange, toViewerBounds } from "../contracts/sequence";
import "@fontsource/roboto-mono/latin-300.css";
import "@fontsource/roboto-mono/latin-400.css";
import "@fontsource/roboto-mono/latin-500.css";
export const SequenceCanvas = memo(function SequenceCanvas({
  sequence,
  features,
  range,
  view,
  onSelection,
}: {
  sequence: string;
  features: Feature[];
  range: Range | null;
  view: "circular" | "linear" | "both";
  onSelection: NonNullable<SeqVizProps["onSelection"]>;
}) {
  const annotations = useMemo(
    () =>
      features.map((feature) => ({
        id: feature.id,
        name: feature.name,
        start: toViewerBounds(feature, sequence.length).start,
        end: toViewerBounds(feature, sequence.length).end,
        direction: feature.strand,
        color: feature.color,
      })),
    [features, sequence.length],
  );
  const selection = useMemo(
    () => (range ? toViewerRange(range, sequence.length) : undefined),
    [range, sequence.length],
  );
  return (
    <div className="sequence-canvas" data-view={view}>
      <SeqViz
        seq={sequence}
        name=""
        seqType="dna"
        viewer={view}
        annotations={annotations}
        primers={[]}
        selection={selection}
        onSelection={onSelection}
        disableExternalFonts
        rotateOnScroll={false}
        showComplement
        showIndex
        style={{ width: "100%", height: "100%" }}
      />
    </div>
  );
});
