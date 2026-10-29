// ABOUTME: 图表文件生命周期动作：新建、示例、导入规格/项目包/数据文件、恢复稿与项目包导出；切换期间锁定工作区。
import { useRef, useState } from "react";
import { encodeBundle } from "../contracts/bundle";
import { datasetName, MAX_DATASETS, type DatasetRef } from "../contracts/datasets";
import type { GalleryExample } from "../contracts/gallery";
import { blankSpec, exampleModel, validate, type Model } from "../contracts/model";
import { datasetText, uploadDataset } from "./data-client";
import { safeFileName } from "./ExportControl";
import { classifyFile } from "./files";
import { readWorkingCopy } from "./recovery";
import { download, type ChartFiles } from "./workspace";

export function useChartActions(
  project: ChartFiles,
  ui: { closeDialog: () => void; showPane: (pane: "chart" | "data") => void },
) {
  const [switching, setSwitching] = useState(false);
  const [importing, setImporting] = useState("");
  const navigation = useRef(false);
  async function navigate(action: () => Promise<boolean>): Promise<boolean> {
    if (navigation.current) return false;
    navigation.current = true;
    setSwitching(true);
    try {
      return await action();
    } catch (error) {
      project.report(error);
      return false;
    } finally {
      navigation.current = false;
      setSwitching(false);
    }
  }
  async function createFrom(model: Model, title: string, notice: string, extra: Record<string, unknown> = {}) {
    if (await navigate(() => project.replace(model, title, extra))) {
      ui.closeDialog();
      ui.showPane("chart");
      project.setNotice(notice);
    }
  }
  const newBlank = () => void createFrom({ spec: blankSpec(), datasets: [] }, "未命名图表", "已新建空白图表。导入数据或在规格中编辑，修改会自动保存。");
  const fromExample = (example: GalleryExample) =>
    void createFrom(exampleModel(example.id), example.title, `已从示例「${example.title}」新建，示例数据已附在数据窗。`);

  async function addDatasets(files: File[]) {
    const taken = new Set(project.data.datasets.map((item) => item.name));
    const added: DatasetRef[] = [];
    try {
      for (const file of files) {
        if (project.data.datasets.length + added.length >= MAX_DATASETS)
          throw new Error(`每张图表最多 ${MAX_DATASETS} 个数据集。`);
        const head = new Uint8Array(await file.slice(0, 512).arrayBuffer());
        if (/\.(xlsx?|xlsm|numbers|ods|et)$/i.test(file.name) || head.includes(0))
          throw new Error(`“${file.name}”是表格软件或二进制文件。请在 Excel / WPS 中“另存为 CSV（UTF-8）”后再导入。`);
        setImporting(`正在导入 ${file.name}…`);
        const uploaded = await uploadDataset(file.name, new Uint8Array(await file.arrayBuffer()), (fraction) =>
          setImporting(`正在上传 ${file.name} ${Math.round(fraction * 100)}%`),
        );
        const name = datasetName(file.name, taken);
        taken.add(name);
        added.push({ ...uploaded, file: uploaded.file.slice(0, 160), name });
      }
    } catch (error) {
      project.report(error);
    } finally {
      setImporting("");
    }
    if (!added.length) return;
    project.setData((old) => ({ ...old, datasets: [...old.datasets, ...added] }));
    const last = added[added.length - 1];
    project.setDraft((old) => ({ ...old, dataTab: last.name }));
    ui.showPane("data");
    project.setNotice(
      `已导入 ${added.map((item) => `${item.file}（${item.rows.toLocaleString("zh-CN")} 行，名称 ${item.name}）`).join("、")}。点“设为规格数据”或在规格中写 data: {"name": "${last.name}"}。`,
    );
  }

  async function importFiles(files: File[]) {
    const data: File[] = [];
    for (const file of files) {
      try {
        const found = await classifyFile(file);
        if (found.kind === "data") data.push(file);
        else if (found.kind === "spec")
          await createFrom({ spec: found.spec, datasets: [] }, found.title, `已导入规格为新图表「${found.title}」。`);
        else {
          setImporting(`正在导入项目包 ${file.name}…`);
          const refs: DatasetRef[] = [];
          try {
            for (const item of found.datasets) {
              const uploaded = await uploadDataset(item.file, new TextEncoder().encode(item.content));
              refs.push({ ...uploaded, name: item.name, file: item.file });
            }
          } finally {
            setImporting("");
          }
          await createFrom(
            validate({ spec: found.spec, datasets: refs }),
            found.title,
            `已导入项目包为新图表「${found.title}」（${refs.length} 个数据集）。`,
          );
        }
      } catch (error) {
        project.report(error);
      }
    }
    if (data.length) await addDatasets(data);
  }

  async function importRecovery(file: File) {
    await navigate(async () => {
      const copy = await readWorkingCopy(file, validate);
      const done = await project.replace(copy.data, copy.title, copy.extra);
      if (done) {
        ui.closeDialog();
        project.setNotice(`已把恢复稿导入为新图表「${copy.title}」。`);
      }
      return done;
    });
  }

  async function exportBundle() {
    try {
      const name = project.title.trim() || "未命名图表";
      const contents = await Promise.all(project.data.datasets.map(async (ref) => ({ ref, content: await datasetText(ref.id) })));
      const bundle = encodeBundle(name, project.data.spec, contents);
      download(new Blob([bundle], { type: "application/json" }), safeFileName(name, "vlproject.json"));
      project.setNotice(`已导出项目包（规格 + ${contents.length} 个数据集）。`);
    } catch (error) {
      project.report(error);
    }
  }


  return { switching, importing, navigate, newBlank, fromExample, addDatasets, importFiles, importRecovery, exportBundle };
}
