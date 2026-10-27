import { RecordFields } from "./RecordFields";
import { MapSheet } from "./MapSheet";
import { PlotRegister } from "./PlotRegister";
import { CoordinateEditor } from "./CoordinateEditor";
import { ExportBar } from "./ExportBar";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  importDocument,
  seed,
  validate,
  type Model,
  type Plot,
  type Position,
} from "../contracts/model";
import { useProjects, ProjectPicker, Notice } from "./workspace";
import type { MapHandle, MapMode } from "./FieldMap";
const rowsFor = (plot: Plot | undefined): [string, string][] =>
  plot
    ? plot.coordinates
        .slice(0, -1)
        .map((point) => [String(point[0]), String(point[1])])
    : [];
export function App() {
  const project = useProjects(seed, validate, "河湾地块记录（示例）");
  const [selected, setSelected] = useState(seed.plots[0].id),
    [mode, setMode] = useState<MapMode>("browse"),
    [fitToken, setFitToken] = useState(0),
    [ready, setReady] = useState(false),
    [feedback, setFeedback] = useState(""),
    [coordinateError, setCoordinateError] = useState(""),
    [vertices, setVertices] = useState<[string, string][]>(() =>
      rowsFor(seed.plots[0]),
    );
  const map = useRef<MapHandle>(null),
    file = useRef<HTMLInputElement>(null),
    latest = useRef({ project, pending: false });
  const active = project.data.plots.find((plot) => plot.id === selected),
    coordinateDirty =
      JSON.stringify(vertices) !== JSON.stringify(rowsFor(active)),
    pending = coordinateDirty || mode === "draw";
  latest.current = { project, pending };
  const valid = useMemo(() => {
    try {
      return { data: validate(project.data), error: "" };
    } catch (error) {
      return {
        data: null,
        error: error instanceof Error ? error.message : "项目格式错误。",
      };
    }
  }, [project.data]);
  useEffect(() => {
    if (!project.data.plots.some((plot) => plot.id === selected))
      setSelected(project.data.plots[0]?.id ?? "");
  }, [project.data, selected]);
  useEffect(() => {
    setVertices(rowsFor(active));
    setCoordinateError("");
  }, [active?.id, active?.coordinates]);
  useEffect(() => {
    setFitToken((value) => value + 1);
    setMode("browse");
  }, [project.current?.id]);
  useEffect(() => {
    if (!pending) return;
    const before = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", before);
    return () => window.removeEventListener("beforeunload", before);
  }, [pending]);
  function report(error: unknown) {
    project.report(error);
  }
  function discardPending() {
    if (pending && !confirm("有未应用的坐标或未完成的圈绘，确定放弃吗？"))
      return false;
    setVertices(rowsFor(active));
    setCoordinateError("");
    map.current?.cancel();
    setMode("browse");
    return true;
  }
  function leaveProject() {
    if (
      (project.dirty || pending) &&
      !confirm("有未保存或未应用的修改，确定放弃并切换项目吗？")
    )
      return false;
    map.current?.cancel();
    setMode("browse");
    setVertices(rowsFor(active));
    setCoordinateError("");
    setFeedback("");
    return true;
  }
  function selectPlot(id: string) {
    if (id === selected || !discardPending()) return;
    setSelected(id);
  }
  function applyModel(data: Model, message: string) {
    project.setData(validate(data));
    project.setError("");
    setFeedback(message);
  }
  function updateRecord(key: "name" | "note", value: string) {
    project.setData((old) => ({
      ...old,
      plots: old.plots.map((plot) =>
        plot.id === selected ? { ...plot, [key]: value } : plot,
      ),
    }));
    setFeedback("");
  }
  function addPlot(coordinates: Position[]) {
    try {
      const id = crypto.randomUUID();
      applyModel(
        {
          ...project.data,
          plots: [
            ...project.data.plots,
            {
              id,
              name: `分区 ${project.data.plots.length + 1}`,
              note: "",
              coordinates,
            },
          ],
        },
        "分区已加入，请命名并保存。",
      );
      setSelected(id);
    } catch (error) {
      report(error);
    } finally {
      setMode("browse");
    }
  }
  function newCoordinates() {
    if (!discardPending()) return;
    const [x, y] = active?.coordinates[0] ?? [120.15, 30.25];
    const dx = x < 179.998 ? 0.001 : -0.001,
      dy = y < 84.998 ? 0.001 : -0.001;
    addPlot([
      [x, y],
      [x + dx, y],
      [x + dx, y + dy],
      [x, y + dy],
      [x, y],
    ]);
    setFitToken((value) => value + 1);
  }
  function applyCoordinates() {
    if (!active) return;
    try {
      const points: Position[] = vertices.map((point, index) => {
        if (
          point.some(
            (value) => !value.trim() || !Number.isFinite(Number(value)),
          )
        )
          throw new Error(`第${index + 1}个顶点需要有效的经度与纬度。`);
        return [Number(point[0]), Number(point[1])];
      });
      const coordinates = [...points, points[0]];
      applyModel(
        {
          ...project.data,
          plots: project.data.plots.map((plot) =>
            plot.id === selected ? { ...plot, coordinates } : plot,
          ),
        },
        "坐标已应用，面积已重新计算。",
      );
      setCoordinateError("");
      setFitToken((value) => value + 1);
    } catch (error) {
      setCoordinateError(
        error instanceof Error ? error.message : "坐标未应用。",
      );
    }
  }
  async function importFile(selectedFile: File) {
    const targetId = latest.current.project.current?.id;
    try {
      if (selectedFile.size > 700000)
        throw new Error("文件超过700KB，请减少分区或顶点。");
      const raw: unknown = JSON.parse(await selectedFile.text());
      const imported = importDocument(raw);
      const state = latest.current;
      if (state.project.current?.id !== targetId)
        throw new Error("项目已切换，请在当前项目重新导入文件。");
      if (
        (state.project.dirty || state.pending) &&
        !confirm("导入将替换当前全部分区和未应用修改，是否继续？")
      )
        return;
      map.current?.cancel();
      setMode("browse");
      state.project.setData(imported.data);
      if (imported.title) state.project.setTitle(imported.title);
      setSelected(imported.data.plots[0]?.id ?? "");
      setFitToken((value) => value + 1);
      setFeedback(`已导入${imported.data.plots.length}个分区，请检查后保存。`);
      state.project.setError("");
    } catch (error) {
      report(
        error instanceof SyntaxError
          ? new Error("JSON无法解析，原项目未更改。请检查文件。")
          : error,
      );
    }
  }
  const blocked =
    pending || !valid.data || !project.title.trim() || project.busy;
  return (
    <main className="field-desk" aria-busy={project.busy}>
      <a className="skip" href="#plot-record">
        跳到分区记录与坐标编辑
      </a>
      <header className="desk-header">
        <div className="wordmark">
          <span aria-hidden="true">▱</span>
          <div>
            <strong>田块记录台</strong>
            <small>FIELD ATLAS</small>
          </div>
        </div>
        <ProjectPicker
          items={project.items}
          id={project.current?.id}
          disabled={project.busy}
          onOpen={(id) => {
            if (leaveProject()) void project.open(id, true);
          }}
        />
        <div className="header-buttons">
          <button
            disabled={project.busy}
            onClick={() => {
              if (leaveProject()) project.fresh(true);
            }}
          >
            新建项目
          </button>
          <button
            className="primary"
            disabled={project.busy || blocked}
            onClick={() => {
              setFeedback("");
              void project.save();
            }}
          >
            {project.busy ? "处理中…" : "保存记录"}
          </button>
        </div>
      </header>
      <section className="project-heading">
        <div>
          <p className="eyebrow">地块边界 · 分区记录 · 面积核对</p>
          <label>
            <span className="sr-only">项目名称</span>
            <input
              aria-label="项目名称"
              name="title"
              disabled={project.busy}
              autoComplete="off"
              value={project.title}
              onChange={(event) => project.setTitle(event.target.value)}
              maxLength={120}
            />
          </label>
        </div>
        <div className="project-state" role="status">
          <span
            className={
              project.dirty || pending ? "state-dot changed" : "state-dot"
            }
          />
          {pending
            ? "有编辑尚未应用"
            : project.dirty
              ? "有未保存的修改"
              : project.current
                ? "记录已保存"
                : "示例项目，尚未保存"}
        </div>
      </section>
      <Notice
        error={
          project.error ||
          (!project.title.trim() ? "请填写项目名称后保存或导出。" : "")
        }
        notice={feedback || (!project.dirty ? project.notice : "")}
      />
      {valid.error ? (
        <p className="notice error" role="alert">
          {valid.error}
        </p>
      ) : null}
      <div className="workspace-grid" inert={project.busy}>
        <PlotRegister
          plots={project.data.plots}
          selected={selected}
          busy={project.busy}
          onSelect={selectPlot}
          onNew={newCoordinates}
          onImport={() => file.current?.click()}
        />
        <MapSheet
          mapRef={map}
          data={project.data}
          selected={selected}
          mode={mode}
          ready={ready}
          fitToken={fitToken}
          onReady={() => setReady(true)}
          onSelect={selectPlot}
          onDraw={addPlot}
          onError={(message) => project.setError(message)}
          onMode={(next) => {
            if (next === "browse" || discardPending()) setMode(next);
          }}
          onModify={(changes) => {
            try {
              applyModel(
                {
                  ...project.data,
                  plots: project.data.plots.map((plot) => {
                    const change = changes.find((item) => item.id === plot.id);
                    return change
                      ? { ...plot, coordinates: change.coordinates }
                      : plot;
                  }),
                },
                "边界已调整，面积已更新。",
              );
            } catch (error) {
              report(error);
            }
          }}
        />
      </div>
      <section id="plot-record" className="plot-record" inert={project.busy}>
        <header>
          <div>
            <p className="eyebrow">FIELD NOTES</p>
            <h2>{active ? "分区记录" : "新增或选择一个分区"}</h2>
          </div>
          {active ? (
            <button
              className="danger"
              onClick={() => {
                if (confirm("删除此分区及未应用的坐标修改？")) {
                  applyModel(
                    {
                      ...project.data,
                      plots: project.data.plots.filter(
                        (plot) => plot.id !== selected,
                      ),
                    },
                    "分区已移除，保存后生效。",
                  );
                  setMode("browse");
                }
              }}
            >
              移除分区
            </button>
          ) : null}
        </header>
        {active ? (
          <>
            <RecordFields active={active} onChange={updateRecord} />
            <CoordinateEditor
              vertices={vertices}
              onVertices={setVertices}
              dirty={coordinateDirty}
              error={coordinateError}
              drawing={mode !== "browse"}
              onApply={applyCoordinates}
              onReset={() => {
                setVertices(rowsFor(active));
                setCoordinateError("");
              }}
            />
            <p className="area-method">
              面积按半径6,371,008.8m的球面计算，1ha =
              10,000m²。结果用于边界核对，不替代实地测绘；显示投影不参与面积计算。
            </p>
          </>
        ) : (
          <p>使用「坐标新增分区」创建可编辑边界，或在地图上圈绘。</p>
        )}
      </section>
      <ExportBar
        title={project.title}
        data={project.data}
        blocked={blocked}
        canDelete={!!project.current && !project.busy}
        onDelete={() => void project.remove()}
      />
      <input
        className="sr-only"
        type="file"
        accept=".json,.geojson,application/json,application/geo+json"
        ref={file}
        tabIndex={-1}
        onChange={(event) => {
          const selectedFile = event.target.files?.[0];
          event.target.value = "";
          if (selectedFile) void importFile(selectedFile);
        }}
      />
    </main>
  );
}
