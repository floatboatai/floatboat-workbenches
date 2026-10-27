import { area, type Plot } from "../contracts/model";
const numeric = new Intl.NumberFormat("zh-CN", { maximumFractionDigits: 2 });
interface Props {
  plots: Plot[];
  draftIds?:string[];
  selected: string;
  busy: boolean;
  onSelect: (id: string) => void;
  onNew: () => void;
  onImport: () => void;
}
export function PlotRegister({
  plots,
  draftIds=[],
  selected,
  busy,
  onSelect,
  onNew,
  onImport,
}: Props) {
  const total = plots.reduce((sum, plot) => sum + area(plot.coordinates), 0);
  return (
    <aside className="plot-register" aria-label="分区清册">
      <div className="register-heading">
        <h1>分区清册</h1>
        <span>{plots.length}/30</span>
      </div>
      <div className="total">
        <small>面积合计</small>
        <strong>
          {numeric.format(total / 10000)} <span>ha</span>
        </strong>
        <p>球面估算 · 分区重叠不去重</p>
      </div>
      <ol className="plot-list">
        {plots.map((plot, index) => (
          <li key={plot.id}>
            <button
              className={plot.id === selected ? "selected" : ""}
              aria-pressed={plot.id === selected}
              onClick={() => onSelect(plot.id)}
            >
              <span className="plot-number">
                {String(index + 1).padStart(2, "0")}
              </span>
              <span className="plot-name">
                {plot.name || "未命名分区"}
                <small>
                  {numeric.format(area(plot.coordinates) / 10000)} ha ·{" "}
                  {plot.coordinates.length - 1}个顶点{draftIds.includes(plot.id)?" · 坐标草稿":""}
                </small>
              </span>
              <span aria-hidden="true">↗</span>
            </button>
          </li>
        ))}
      </ol>
      {!plots.length ? (
        <p className="empty">
          还没有分区。可导入GeoJSON，或使用地图/坐标新增。
        </p>
      ) : null}
      <button
        className="register-add"
        onClick={onNew}
        disabled={plots.length >= 30 || busy}
      >
        ＋ 坐标新增分区
      </button>
      <p className="register-note">
        支持单外环Polygon。用坐标表也能完整创建与修改边界。
      </p>
      <button onClick={() => onImport()} disabled={busy}>
        导入 GeoJSON / 项目
      </button>
    </aside>
  );
}
