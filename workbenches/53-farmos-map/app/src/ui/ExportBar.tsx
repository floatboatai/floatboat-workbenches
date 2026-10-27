import {
  areaCsv,
  geojson,
  projectDocument,
  type Model,
} from "../contracts/model";
import { download } from "./workspace";
interface Props {
  title: string;
  data: Model;
  blocked: boolean;
  canDelete: boolean;
  onDelete: () => void;
}
export function ExportBar({
  title,
  data,
  blocked,
  canDelete,
  onDelete,
}: Props) {
  return (
    <footer className="export-bar">
      <div>
        <strong>带走这份记录</strong>
        <p>
          {blocked
            ? "请先应用坐标、结束圈绘并修正错误，再保存或导出。"
            : "GeoJSON仅保留分区编号、名称、备注、边界与估算面积。"}
        </p>
      </div>
      <div className="export-actions">
        <button
          disabled={blocked}
          onClick={() =>
            download(
              new Blob([JSON.stringify(geojson(data), null, 2)], {
                type: "application/geo+json",
              }),
              title + ".geojson",
            )
          }
        >
          导出 GeoJSON
        </button>
        <button
          disabled={blocked}
          onClick={() =>
            download(
              new Blob(
                [JSON.stringify(projectDocument(title, data), null, 2)],
                { type: "application/json" },
              ),
              title + ".field.json",
            )
          }
        >
          导出项目 JSON
        </button>
        <button
          disabled={blocked}
          onClick={() =>
            download(
              new Blob([areaCsv(data)], {
                type: "text/csv;charset=utf-8",
              }),
              title + "-面积.csv",
            )
          }
        >
          导出面积表
        </button>
        <button className="danger" disabled={!canDelete} onClick={onDelete}>
          删除项目
        </button>
      </div>
    </footer>
  );
}
