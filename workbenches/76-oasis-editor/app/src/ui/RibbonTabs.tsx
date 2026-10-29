import { useRef, useState } from "react";
import {
  BetweenHorizontalEnd, BetweenHorizontalStart, BetweenVerticalEnd, BetweenVerticalStart, Columns3, FileMinus,
  Grid3x3, Image, Link, Omega, PaintBucket, Pilcrow, RectangleHorizontal, RectangleVertical, Rows3, Ruler,
  SeparatorHorizontal, Sigma, SquareDashed, TableCellsMerge, TableCellsSplit, Trash2, Unlink,
} from "lucide-react";
import type { OasisEditorClient } from "oasis-editor";
import {
  MARGIN_PRESETS, PAGE_SIZES, marginPresetId, pageSizeId, withPageSize,
} from "../contracts/review";
import { Group, Popover, SHADES, Swatches, Tool, type EditorSnapshot, type Run } from "./ribbon-kit";

function TableGrid({ onPick }: { onPick: (rows: number, columns: number) => void }) {
  const [hover, setHover] = useState<[number, number]>([0, 0]);
  return (
    <div className="table-grid-picker">
      <p aria-live="polite">{hover[0] ? `${hover[0]} 行 × ${hover[1]} 列` : "选择表格大小"}</p>
      <div className="table-grid" role="grid" aria-label="表格行列">
        {Array.from({ length: 8 }, (_, r) => (
          <div role="row" key={r}>
            {Array.from({ length: 8 }, (_, c) => (
              <button
                type="button"
                role="gridcell"
                key={c}
                aria-label={`${r + 1} 行 ${c + 1} 列`}
                className={r < hover[0] && c < hover[1] ? "on" : undefined}
                onMouseEnter={() => setHover([r + 1, c + 1])}
                onFocus={() => setHover([r + 1, c + 1])}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => onPick(r + 1, c + 1)}
              />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

export function InsertTools({
  snapshot,
  disabled,
  run,
  onImage,
}: {
  snapshot: EditorSnapshot;
  disabled: boolean;
  run: Run;
  onImage: (file: File) => void;
}) {
  const s = snapshot.states;
  const picker = useRef<HTMLInputElement>(null);
  const linkHint = snapshot.collapsed && !s.link?.active ? "先选中要设置链接的文字" : "插入链接 (Ctrl+K)";
  return (
    <>
      <Group label="插图">
        <Tool label="图片" wide icon={<Image size={16} />} disabled={disabled} title="插入图片（大照片会按文档尺寸压缩）" onClick={() => picker.current?.click()} />
        <input
          ref={picker}
          hidden
          type="file"
          accept="image/png,image/jpeg,image/gif,image/webp,image/bmp"
          aria-label="选择图片"
          onChange={(event) => {
            const file = event.target.files?.[0];
            event.target.value = "";
            if (file) onImage(file);
          }}
        />
        <Popover label="插入表格" wide trigger={<><Grid3x3 size={16} /><span>表格</span></>} disabled={disabled}>
          {(close) => (
            <TableGrid
              onPick={(rows, columns) => {
                close();
                run("insertTable", { rows, columns });
              }}
            />
          )}
        </Popover>
      </Group>
      <Group label="链接与引用">
        <Tool label="链接" wide icon={<Link size={16} />} title={linkHint} disabled={disabled || !s.link?.enabled} onClick={() => run("link")} />
        <Tool label="取消链接" icon={<Unlink size={16} />} disabled={disabled || !s.link?.active} onClick={() => run("unlink")} />
        <Tool label="脚注" wide icon={<span className="glyph">ab¹</span>} title="在光标处插入脚注" disabled={disabled || s.insertFootnote?.enabled === false} onClick={() => run("insertFootnote")} />
      </Group>
      <Group label="符号">
        <Tool label="公式" wide icon={<Sigma size={16} />} disabled={disabled} onClick={() => run("openEquationDialog")} />
        <Tool label="符号" wide icon={<Omega size={16} />} disabled={disabled} onClick={() => run("openSymbolDialog")} />
      </Group>
      <Group label="页面">
        <Tool label="分页符" wide icon={<FileMinus size={16} />} title="分页符 (Ctrl+Enter)" disabled={disabled} onClick={() => run("pageBreak")} />
        <Tool label="分节符" wide icon={<SeparatorHorizontal size={16} />} title="分节符（下一页）" disabled={disabled} onClick={() => run("sectionBreakNextPage")} />
      </Group>
    </>
  );
}

export function TableTools({ snapshot, disabled, run }: { snapshot: EditorSnapshot; disabled: boolean; run: Run }) {
  const s = snapshot.states;
  const tableStyles = snapshot.styles.filter((x) => x.type === "table" && x.id !== "TableNormal");
  const current = String(s.setTableStyle?.value ?? "");
  return (
    <>
      <Group label="行和列">
        <Tool label="在上方插入行" icon={<BetweenHorizontalStart size={16} />} disabled={disabled} onClick={() => run("tableInsertRowBefore")} />
        <Tool label="在下方插入行" icon={<BetweenHorizontalEnd size={16} />} disabled={disabled} onClick={() => run("tableInsertRowAfter")} />
        <Tool label="在左侧插入列" icon={<BetweenVerticalStart size={16} />} disabled={disabled} onClick={() => run("tableInsertColumnBefore")} />
        <Tool label="在右侧插入列" icon={<BetweenVerticalEnd size={16} />} disabled={disabled} onClick={() => run("tableInsertColumnAfter")} />
        <Tool label="删除行" wide icon={<Trash2 size={16} />} disabled={disabled || s.tableDeleteRow?.enabled === false} onClick={() => run("tableDeleteRow")} />
        <Tool label="删除列" wide icon={<Trash2 size={16} />} disabled={disabled || s.tableDeleteColumn?.enabled === false} onClick={() => run("tableDeleteColumn")} />
      </Group>
      <Group label="合并">
        <Tool label="合并单元格" icon={<TableCellsMerge size={16} />} title="先拖选多个单元格" disabled={disabled || !s.tableMerge?.enabled} onClick={() => run("tableMerge")} />
        <Tool label="拆分单元格" icon={<TableCellsSplit size={16} />} disabled={disabled || !s.tableSplit?.enabled} onClick={() => run("tableSplit")} />
        <Tool label="平均分布各列" icon={<Columns3 size={16} />} disabled={disabled} onClick={() => run("tableDistributeColumns")} />
        <Tool label="平均分布各行" icon={<Rows3 size={16} />} disabled={disabled} onClick={() => run("tableDistributeRows")} />
      </Group>
      <Group label="样式">
        <Popover label="单元格底纹" trigger={<PaintBucket size={16} />} disabled={disabled}>
          {(close) => (
            <Swatches
              colors={SHADES}
              none="无底纹"
              onPick={(c) => {
                close();
                run("tableCellShading", c);
              }}
            />
          )}
        </Popover>
        <Tool label="所有框线" icon={<Grid3x3 size={16} />} disabled={disabled} onClick={() => run("tableCellBorders")} />
        <Tool label="无框线" icon={<SquareDashed size={16} />} disabled={disabled} onClick={() => run("tableCellNoBorders")} />
        <Tool label="标题行" wide active={!!s.tableToggleHeaderRow?.active} disabled={disabled} onClick={() => run("tableToggleHeaderRow")} />
        <Tool label="镶边行" wide active={!!s.tableToggleBandedRows?.active} disabled={disabled} onClick={() => run("tableToggleBandedRows")} />
        <select
          className="ribbon-select table-style-select"
          aria-label="表格样式"
          title="表格样式"
          value={tableStyles.some((x) => x.id === current) ? current : ""}
          disabled={disabled}
          onChange={(e) => run("setTableStyle", e.target.value)}
        >
          <option value="" disabled>
            表格样式
          </option>
          {tableStyles.map((x) => (
            <option key={x.id} value={x.id}>
              {tableStyleName(x.id, x.name)}
            </option>
          ))}
        </select>
        <Tool label="宽度 100%" wide disabled={disabled} onClick={() => run("tableWidth100")} />
      </Group>
    </>
  );
}
const ACCENTS = ["蓝色", "橙色", "灰色", "金色", "蓝灰", "绿色"];
function tableStyleName(id: string, name: string) {
  if (id === "TableGrid") return "网格型";
  const m = /^(Light|Medium)Shading1?-Accent(\d)$/.exec(id);
  if (m) return `${m[1] === "Light" ? "浅色底纹" : "中等深浅底纹"} · ${ACCENTS[Number(m[2]) - 1] ?? m[2]}`;
  return name;
}

const toCm = (px: number) => Math.round((px * 2.54 * 100) / 96) / 100;
const toPx = (cm: number) => Math.round((cm * 96) / 2.54);
export function LayoutTools({
  client,
  snapshot,
  disabled,
  run,
}: {
  client: OasisEditorClient | null;
  snapshot: EditorSnapshot;
  disabled: boolean;
  run: Run;
}) {
  const page = snapshot.page ?? undefined;
  const landscape = !!page && (page.orientation === "landscape" || page.width > page.height);
  const margin = marginPresetId(page);
  const size = pageSizeId(page);
  return (
    <>
      <Group label="页面设置">
        <Popover label="页边距" wide trigger={<><Ruler size={16} /><span>页边距</span></>} disabled={disabled}>
          {(close) => (
            <div className="menu-list">
              {MARGIN_PRESETS.map((p) => (
                <button
                  type="button"
                  key={p.id}
                  aria-pressed={margin === p.id}
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => {
                    close();
                    run("setPageMargins", { top: p.top, bottom: p.bottom, left: p.left, right: p.right });
                  }}
                >
                  <strong>{p.label}</strong>
                  <small>{p.detail}</small>
                </button>
              ))}
              {page && (
                <form
                  className="custom-margins"
                  onSubmit={(e) => {
                    e.preventDefault();
                    const f = new FormData(e.currentTarget);
                    const value = (k: string) => Number(f.get(k));
                    const next = { top: value("top"), bottom: value("bottom"), left: value("left"), right: value("right") };
                    if (Object.values(next).some((v) => !Number.isFinite(v) || v < 0 || v > 10)) return;
                    close();
                    run("setPageMargins", {
                      top: toPx(next.top), bottom: toPx(next.bottom), left: toPx(next.left), right: toPx(next.right),
                    });
                  }}
                >
                  <fieldset>
                    <legend>自定义（厘米）</legend>
                    {(["top", "bottom", "left", "right"] as const).map((k) => (
                      <label key={k}>
                        {{ top: "上", bottom: "下", left: "左", right: "右" }[k]}
                        <input name={k} type="number" min="0" max="10" step="0.01" inputMode="decimal" autoComplete="off" defaultValue={toCm(page.margins[k])} />
                      </label>
                    ))}
                  </fieldset>
                  <button type="submit">应用</button>
                </form>
              )}
            </div>
          )}
        </Popover>
        <Tool label="纵向" wide icon={<RectangleVertical size={16} />} active={!landscape} disabled={disabled} onClick={() => run("setOrientation", "portrait")} />
        <Tool label="横向" wide icon={<RectangleHorizontal size={16} />} active={landscape} disabled={disabled} onClick={() => run("setOrientation", "landscape")} />
        <Popover label="纸张大小" wide trigger={<span>纸张大小：{size ?? "自定义"}</span>} disabled={disabled}>
          {(close) => (
            <div className="menu-list">
              {PAGE_SIZES.map((p) => (
                <button
                  type="button"
                  key={p.id}
                  aria-pressed={size === p.id}
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => {
                    close();
                    client?.updateDocument((doc) => withPageSize(doc, p.id));
                  }}
                >
                  <strong>{p.label}</strong>
                  <small>{p.detail}</small>
                </button>
              ))}
            </div>
          )}
        </Popover>
      </Group>
      <Group label="显示">
        <Tool label="边距线" wide icon={<SquareDashed size={16} />} active={snapshot.showMargins} disabled={disabled} onClick={() => run("toggleShowMargins")} />
        <Tool label="段落标记" wide icon={<Pilcrow size={16} />} active={snapshot.showMarks} disabled={disabled} onClick={() => run("toggleShowParagraphMarks")} />
      </Group>
    </>
  );
}
