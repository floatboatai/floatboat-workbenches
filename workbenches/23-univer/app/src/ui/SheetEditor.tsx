import { useEffect, useRef } from "react";
import {
  createUniver,
  LocaleType,
  type IWorkbookData,
  type ICellData,
} from "@univerjs/presets";
import { UniverSheetsCorePreset } from "@univerjs/preset-sheets-core";
import zhCN from "@univerjs/preset-sheets-core/locales/zh-CN";
import "@univerjs/preset-sheets-core/lib/index.css";
import {
  inputCell,
  type SheetModel,
  type CellDraft,
} from "../contracts/workbook";
export interface EditorHandle {
  snapshot: () => Promise<{ workbook: IWorkbookData; sheetId: string }>;
  apply: (draft: CellDraft) => Promise<void>;
}
interface Props {
  initial: SheetModel;
  onChange: (model: SheetModel) => void;
  onDraft: (draft: CellDraft | null) => void;
  onReady: (handle: EditorHandle | null) => void;
  onError: (error: unknown) => void;
}
export function SheetEditor(props: Props) {
  const container = useRef<HTMLDivElement>(null),
    latest = useRef(props);
  latest.current = props;
  useEffect(() => {
    if (!container.current) return;
    const { univer, univerAPI: api } = createUniver({
      locale: LocaleType.ZH_CN,
      locales: { [LocaleType.ZH_CN]: zhCN },
      presets: [
        UniverSheetsCorePreset({
          container: container.current,
          header: true,
          toolbar: true,
          formulaBar: true,
          disableAutoFocus: true,
        }),
      ],
    });
    const book = api.createWorkbook(structuredClone(props.initial.workbook));
    let timer: ReturnType<typeof setTimeout> | undefined,
      disposed = false;
    const capture = () => {
      if (disposed) return;
      try {
        latest.current.onChange({ workbook: book.save() });
      } catch (e) {
        latest.current.onError(e);
      }
    };
    const defer = () => {
      clearTimeout(timer);
      timer = setTimeout(capture, 100);
    };
    const listeners = [
      book.onCommandExecuted((c) => {
        if (c.id.includes("mutation")) defer();
      }),
      api.addEvent(api.Event.SheetEditChanging, (e) =>
        latest.current.onDraft({
          sheetId: e.worksheet.getSheetId(),
          sheetName: e.worksheet.getSheetName(),
          row: e.row,
          column: e.column,
          text: e.value.toPlainText(),
        }),
      ),
      api.addEvent(api.Event.SheetEditEnded, () => {
        latest.current.onDraft(null);
        defer();
      }),
      api.getFormula().calculationEnd(() => defer()),
    ];
    const dark = matchMedia("(prefers-color-scheme: dark)");
    const theme = () =>
      api.toggleDarkMode(
        document.documentElement.dataset.theme === "dark" ||
          (document.documentElement.dataset.theme !== "light" && dark.matches),
      );
    theme();
    dark.addEventListener("change", theme);
    const observer = new MutationObserver(theme);
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["data-theme", "class"],
    });
    async function calculate() {
      // An all-values workbook reports NOT_EXECUTED; it has no result to await.
      const hasFormula = Object.values(book.save().sheets).some((sheet) =>
        Object.values(sheet.cellData ?? {}).some((row) =>
          (Object.values(row) as Array<ICellData | null>).some(
            (cell) => cell?.f,
          ),
        ),
      );
      if (!hasFormula) return;
      await new Promise<void>((resolve, reject) => {
        const timeout = setTimeout(() => {
          end.dispose();
          reject(new Error("公式计算尚未完成，请稍后重试导出。"));
        }, 5000);
        const end = api.getFormula().calculationEnd((state) => {
          if (state === 3) {
            clearTimeout(timeout);
            end.dispose();
            resolve();
          }
        });
        api.getFormula().executeCalculation();
      });
    }
    latest.current.onReady({
      snapshot: async () => {
        await book.endEditingAsync(true);
        await calculate();
        clearTimeout(timer);
        const workbook = book.save();
        latest.current.onChange({ workbook });
        return { workbook, sheetId: book.getActiveSheet().getSheetId() };
      },
      apply: async (draft) => {
        const sheet = book.getSheetBySheetId(draft.sheetId);
        if (!sheet)
          throw new Error("草稿对应的工作表已不存在，请复制文本后放弃草稿。");
        await book.endEditingAsync(true);
        sheet.getRange(draft.row, draft.column).setValue(inputCell(draft.text));
        latest.current.onDraft(null);
        capture();
      },
    });
    api.getFormula().executeCalculation();
    return () => {
      disposed = true;
      clearTimeout(timer);
      listeners.forEach((x) => x.dispose());
      observer.disconnect();
      dark.removeEventListener("change", theme);
      latest.current.onReady(null);
      univer.dispose();
    };
  }, []);
  return (
    <div
      className="sheet-scroll"
      tabIndex={0}
      role="region"
      aria-label="电子表格编辑区，可横向滚动"
    >
      <div ref={container} className="univer-editor" />
    </div>
  );
}
