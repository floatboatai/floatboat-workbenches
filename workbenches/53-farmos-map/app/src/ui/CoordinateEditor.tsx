import type { Dispatch, SetStateAction } from "react";
interface Props {
  vertices: [string, string][];
  onVertices: Dispatch<SetStateAction<[string, string][]>>;
  dirty: boolean;
  error: string;
  drawing: boolean;
  onApply: () => void;
  onReset: () => void;
}
export function CoordinateEditor({
  vertices,
  onVertices,
  dirty,
  error,
  drawing,
  onApply,
  onReset,
}: Props) {
  return (
    <details className="coordinate-editor" open={dirty || undefined}>
      <summary>
        坐标编辑 · {vertices.length}个顶点{" "}
        <span>{dirty ? "待应用" : "键盘可操作"}</span>
      </summary>
      <p>
        {drawing
          ? "请先结束地图编辑，再输入坐标。"
          : "按边界顺序输入经纬度，首尾自动闭合。应用后才更新地图、面积和导出。"}
      </p>
      <div className="coordinate-scroll">
        <table>
          <thead>
            <tr>
              <th>顶点</th>
              <th>经度 / °</th>
              <th>纬度 / °</th>
              <th>
                <span className="sr-only">操作</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {vertices.map((point, index) => (
              <tr key={index}>
                <td>{index + 1}</td>
                <td>
                  <input
                    aria-label={`顶点 ${index + 1} 经度`}
                    name={`lon-${index}`}
                    autoComplete="off"
                    inputMode="decimal"
                        maxLength={64}
                    disabled={drawing}
                    value={point[0]}
                    onChange={(event) =>
                      onVertices((old) =>
                        old.map((value, i) =>
                          i === index ? [event.target.value, value[1]] : value,
                        ),
                      )
                    }
                  />
                </td>
                <td>
                  <input
                    aria-label={`顶点 ${index + 1} 纬度`}
                    name={`lat-${index}`}
                    autoComplete="off"
                    inputMode="decimal"
                        maxLength={64}
                    disabled={drawing}
                    value={point[1]}
                    onChange={(event) =>
                      onVertices((old) =>
                        old.map((value, i) =>
                          i === index ? [value[0], event.target.value] : value,
                        ),
                      )
                    }
                  />
                </td>
                <td>
                  <button
                    aria-label={`删除顶点 ${index + 1}`}
                    disabled={drawing || vertices.length <= 3}
                    onClick={() =>
                      onVertices((old) => old.filter((_, i) => i !== index))
                    }
                  >
                    ×
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="coordinate-actions">
        <button
          disabled={drawing || vertices.length >= 200}
          onClick={() =>
            onVertices((old) => {
              const first = old[0],
                last = old[old.length - 1];
              return [
                ...old,
                [
                  String((Number(first[0]) + Number(last[0])) / 2),
                  String((Number(first[1]) + Number(last[1])) / 2),
                ],
              ];
            })
          }
        >
          添加顶点
        </button>
        <button className="primary" onClick={onApply} disabled={drawing}>
          应用坐标
        </button>
        <button disabled={drawing || !dirty} onClick={onReset}>
          还原坐标
        </button>
      </div>
      {error ? (
        <p className="error" role="alert">
          坐标未应用：{error}
        </p>
      ) : null}
    </details>
  );
}
