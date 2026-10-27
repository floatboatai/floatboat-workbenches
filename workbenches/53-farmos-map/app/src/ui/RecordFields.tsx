import { area, type Plot } from "../contracts/model";
const numeric = new Intl.NumberFormat("zh-CN", { maximumFractionDigits: 2 });
export function RecordFields({
  active,
  onChange,
}: {
  active: Plot;
  onChange: (key: "name" | "note", value: string) => void;
}) {
  return (
    <div className="record-grid">
      <label>
        分区名称
        <input
          name="plotName"
          autoComplete="off"
          aria-label="分区名称"
          value={active.name}
          maxLength={80}
          onChange={(event) => onChange("name", event.target.value)}
        />
      </label>
      <div className="area-readout">
        <small>当前边界估算面积</small>
        <strong>
          {numeric.format(area(active.coordinates))} <span>m²</span>
        </strong>
        <span>{numeric.format(area(active.coordinates) / 10000)} ha</span>
      </div>
      <label className="note-field">
        分区备注
        <textarea
          name="plotNote"
          autoComplete="off"
          aria-label="分区备注"
          value={active.note}
          maxLength={2000}
          onChange={(event) => onChange("note", event.target.value)}
          placeholder="记录种植批次、现场情况或分区用途…"
        />
      </label>
    </div>
  );
}
