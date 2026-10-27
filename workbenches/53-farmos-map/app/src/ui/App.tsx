import { AutosaveStatus } from "./AutosaveStatus";
import { coordinateEditor } from "./coordinate-draft";
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
  restoreDraftData,
  type Model,
  type Position,
} from "../contracts/model";
import { useProjects, ProjectPicker, Notice } from "./workspace";
import type { MapHandle, MapMode } from "./FieldMap";
export function App() {
  const project = useProjects(seed, validate, "河湾地块记录（示例）", {
    storageKey: "farmos-map-studio",
    restoreDraftData,
  });
  const [mode, setMode] = useState<MapMode>("browse"),
    [fitToken, setFitToken] = useState(0),
    [ready, setReady] = useState(false),
    [feedback, setFeedback] = useState(""),
    [coordinateError, setCoordinateError] = useState("");
  const {
    selected,
    setSelected,
    active,
    vertices,
    draftIds,
    coordinateDirty,
    setVertices,
    clearCoordinates,
  } = coordinateEditor(project);
  const pending = draftIds.length > 0 || mode === "draw";
  const map = useRef<MapHandle>(null),
    file = useRef<HTMLInputElement>(null),
    latest = useRef({ project, pending: false });
  const saveState =
    draftIds.length > 0 && project.autoState.phase === "saved"
      ? {
          ...project.autoState,
          phase: "draft" as const,
          message: `${draftIds.length}个分区的坐标草稿已自动保存，尚未应用边界。`,
        }
      : project.autoState;
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
    setFitToken((value) => value + 1);
    setMode("browse");
    setCoordinateError("");
  }, [project.documentKey, project.loadEpoch]);
  useEffect(() => {
    setCoordinateError("");
  }, [selected]);
  useEffect(() => {
    if (mode !== "draw") return;
    const before = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", before);
    return () => window.removeEventListener("beforeunload", before);
  }, [mode]);
  function report(error: unknown) {
    project.report(error);
  }
  function cancelSketch() {
    if (mode === "draw" && !confirm("当前圈绘尚未闭合，确定取消这次圈绘吗？"))
      return false;
    map.current?.cancel();
    setMode("browse");
    return true;
  }
  function discardPending() {
    if (
      coordinateDirty &&
      !confirm("当前分区坐标尚未应用，确定还原后编辑地图吗？")
    )
      return false;
    if (!cancelSketch()) return false;
    clearCoordinates(selected);
    setCoordinateError("");
    return true;
  }
  function selectPlot(id: string) {
    if (id === selected || !cancelSketch()) return;
    setSelected(id);
  }
  function applyModel(data: Model, message: string) {
    project.setData(restoreDraftData(data));
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
        "分区已加入，可继续编辑名称和备注。",
      );
      setSelected(id);
    } catch (error) {
      report(error);
    } finally {
      setMode("browse");
    }
  }
  function newCoordinates() {
    if (!cancelSketch()) return;
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
      clearCoordinates(selected);
      setCoordinateError("");
      setFitToken((value) => value + 1);
    } catch (error) {
      setCoordinateError(
        error instanceof Error ? error.message : "坐标未应用。",
      );
    }
  }
  async function importFile(selectedFile: File) {
    const targetId = latest.current.project.documentKey;
    try {
      if (selectedFile.size > 700000)
        throw new Error("文件超过700KB，请减少分区或顶点。");
      const raw: unknown = JSON.parse(await selectedFile.text());
      const imported = importDocument(raw);
      const state = latest.current;
      if (state.project.documentKey !== targetId)
        throw new Error("项目已切换，请在当前项目重新导入文件。");
      if (!cancelSketch()) return;
      const title =
        imported.title ??
        (selectedFile.name
          .replace(/\.[^.]+$/, "")
          .trim()
          .slice(0, 120) ||
          "导入地块");
      if (
        await state.project.replace(imported.data, title, {
          selectedId: imported.data.plots[0]?.id ?? "",
        })
      )
        setFeedback(`已导入${imported.data.plots.length}个分区为新项目。`);
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
            if (cancelSketch())
              void project.open(id).then((opened) => {
                if (opened) setFeedback("");
              });
          }}
        />
        <div className="header-buttons">
          <button
            disabled={project.busy}
            onClick={() => {
              if (cancelSketch())
                void project.fresh().then((opened) => {
                  if (opened) setFeedback("");
                });
            }}
          >
            新建项目
          </button>
          <button
            className="primary"
            disabled={project.busy}
            onClick={() => {
              setFeedback("");
              void project.save();
            }}
          >
            {project.busy ? "处理中…" : "立即保存"}
          </button>
        </div>
      </header>
      <section className="project-heading">
        <div>
          <p className="eyebrow">当前地块项目</p>
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
        <AutosaveStatus
          state={saveState}
          onRetry={() => void project.save()}
          onExport={project.exportDraft}
          onReload={
            project.current
              ? () => void project.open(project.current!.id)
              : undefined
          }
        />
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
        <div className="field-sidebar">
          <PlotRegister
            plots={project.data.plots}
            draftIds={draftIds}
            selected={selected}
            busy={project.busy}
            onSelect={selectPlot}
            onNew={newCoordinates}
            onImport={() => file.current?.click()}
          />
          <section
            id="plot-record"
            className="plot-record"
            inert={project.busy}
          >
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
                        "分区已移除。",
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
                    clearCoordinates(selected);
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
        </div>
      </div>
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
