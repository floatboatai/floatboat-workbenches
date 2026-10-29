// Builds an original Word sample (headings, numbered/bulleted lists, merged-cell tables, header/footer).
import { writeFileSync } from "node:fs";
// Usage: node app/tools/make-sample-docx.mjs app/fixtures/examples/pump-inspection.docx
import { zipSync, strToU8 } from "fflate";
const esc = (s) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const run = (t, b) => `<w:r>${b ? "<w:rPr><w:b/></w:rPr>" : ""}<w:t xml:space="preserve">${esc(t)}</w:t></w:r>`;
const p = (t, style, extra = "") => `<w:p><w:pPr>${style ? `<w:pStyle w:val="${style}"/>` : ""}${extra}</w:pPr>${Array.isArray(t) ? t.map(([x, b]) => run(x, b)).join("") : run(t)}</w:p>`;
const li = (t, num, lvl = 0) => p(t, "ListParagraph", `<w:numPr><w:ilvl w:val="${lvl}"/><w:numId w:val="${num}"/></w:numPr>`);
const tc = (t, { span, vmerge, w = 1800, head } = {}) => `<w:tc><w:tcPr><w:tcW w:w="${w}" w:type="dxa"/>${span ? `<w:gridSpan w:val="${span}"/>` : ""}${vmerge ? `<w:vMerge${vmerge === "restart" ? ' w:val="restart"' : ""}/>` : ""}</w:tcPr>${String(t).split("\n").map((x) => p(head ? [[x, true]] : x)).join("")}</w:tc>`;
const tr = (cells, header) => `<w:tr>${header ? "<w:trPr><w:tblHeader/></w:trPr>" : ""}${cells.join("")}</w:tr>`;
const tbl = (grid, rows) => `<w:tbl><w:tblPr><w:tblStyle w:val="TableGrid"/><w:tblW w:w="0" w:type="auto"/></w:tblPr><w:tblGrid>${grid.map((g) => `<w:gridCol w:w="${g}"/>`).join("")}</w:tblGrid>${rows.join("")}</w:tbl>`;
const body = [
  p("二号泵房设备巡检作业指导书", "Title"),
  p("文件编号：SC-OPS-017　版本：C/2　生效日期：2026 年 9 月 1 日　适用范围：城东水厂二号取水泵房"),
  p("1　目的与适用范围", "Heading1"),
  p("本指导书规定二号取水泵房日常巡检、周检和月度检查的项目、方法、判定标准与记录要求，用于保证取水泵组、配电和附属设施连续稳定运行。适用于当班运行人员和设备维护班组。"),
  p("2　职责", "Heading1"),
  li("当班运行人员：按本指导书完成每 2 小时一次的日常巡检，填写巡检记录并及时报告异常。", 1),
  li("设备维护班组：负责周检、月检及缺陷处理，在 24 小时内反馈处理结果。", 1),
  li("运行主管：每周抽查巡检记录不少于 3 份，组织对重复缺陷进行原因分析。", 1),
  p("3　安全要求", "Heading1"),
  p("进入泵房前确认通风设备运行，地下泵坑作业前检测氧气和硫化氢浓度。巡检过程中不得触碰旋转部件，不得跨越防护栏；发现电气设备冒烟、异响或漏电时立即按下紧急停机按钮并报告值班调度。"),
  p("4　巡检流程", "Heading1"),
  li("到达泵房后在门禁终端签到，领取红外测温仪和巡检终端。", 2),
  li("按“配电室—泵组—真空系统—排水坑—起重设备”的固定路线巡视，不得跳项。", 2),
  li("逐台记录水泵出口压力、电机电流、轴承温度和振动值，与上次记录比较。", 2),
  li("对超出判定标准的项目拍照上传，并在终端中选择缺陷等级。", 2),
  li("巡检结束后核对记录完整性，在交接班会上报告当班缺陷。", 2),
  p("4.1　检查项目与判定标准", "Heading2"),
  p("表 1 列出泵组日常巡检的主要项目。判定标准依据设备制造商说明书和近三年运行统计确定，如设备更换须同步修订。"),
  p("表 1　泵组日常巡检项目", "Caption"),
  tbl([1600, 2200, 2600, 1800], [
    tr([tc("部位", { w: 1600, head: 1 }), tc("检查项目", { w: 2200, head: 1 }), tc("判定标准", { w: 2600, head: 1 }), tc("检查方法", { w: 1800, head: 1 })], true),
    tr([tc("电机", { vmerge: "restart", w: 1600 }), tc("运行电流", { w: 2200 }), tc("不超过额定电流 186 A", { w: 2600 }), tc("配电屏读数", { w: 1800 })]),
    tr([tc("", { vmerge: "continue", w: 1600 }), tc("轴承温度", { w: 2200 }), tc("≤ 75 ℃，温升 ≤ 40 K", { w: 2600 }), tc("红外测温", { w: 1800 })]),
    tr([tc("", { vmerge: "continue", w: 1600 }), tc("振动速度", { w: 2200 }), tc("≤ 4.5 mm/s", { w: 2600 }), tc("便携测振仪", { w: 1800 })]),
    tr([tc("水泵", { vmerge: "restart", w: 1600 }), tc("出口压力", { w: 2200 }), tc("0.32～0.38 MPa", { w: 2600 }), tc("就地压力表", { w: 1800 })]),
    tr([tc("", { vmerge: "continue", w: 1600 }), tc("机械密封泄漏", { w: 2200 }), tc("每分钟不超过 10 滴", { w: 2600 }), tc("目视计数", { w: 1800 })]),
    tr([tc("真空系统", { w: 1600 }), tc("真空度", { w: 2200 }), tc("−0.06 MPa 以下", { w: 2600 }), tc("真空表", { w: 1800 })]),
    tr([tc("排水坑", { w: 1600 }), tc("液位与排水泵自启", { w: 2200 }), tc("液位低于报警线，浮球动作灵活", { span: 2, w: 4400 })]),
  ]),
  p("4.2　缺陷分级", "Heading2"),
  p("缺陷按对供水安全的影响分为三级，处理时限从发现时起计算。"),
  p("表 2　缺陷等级与处理时限", "Caption"),
  tbl([1500, 4200, 2500], [
    tr([tc("等级", { w: 1500, head: 1 }), tc("典型情形", { w: 4200, head: 1 }), tc("处理时限", { w: 2500, head: 1 })], true),
    tr([tc("一级", { w: 1500 }), tc("可能导致停泵或减产的缺陷，如轴承温度超过 85 ℃、电缆接头发热", { w: 4200 }), tc("立即处理，2 小时内恢复或切换备用泵", { w: 2500 })]),
    tr([tc("二级", { w: 1500 }), tc("影响设备寿命但暂不影响运行，如密封泄漏超标、振动值接近上限", { w: 4200 }), tc("24 小时内处理", { w: 2500 })]),
    tr([tc("三级", { w: 1500 }), tc("外观、标识、照明等一般问题", { w: 4200 }), tc("7 天内处理", { w: 2500 })]),
  ]),
  p("5　记录与归档", "Heading1"),
  p("巡检记录以电子方式保存于设备管理系统，保存期限不少于三年。纸质应急记录在系统恢复后 24 小时内补录。月末由运行主管导出缺陷统计，提交设备管理部。"),
  li("日常巡检记录：每班 1 份，系统自动归档。", 1),
  li("缺陷处理单：按缺陷编号归档，附处理前后照片。", 1),
  li("月度检查报告：每月 5 日前完成。", 1),
  p("6　附则", "Heading1"),
  p("本指导书由设备管理部负责解释，自发布之日起执行，原 SC-OPS-017 C/1 版同时废止。本文件为演示用原创资料。"),
].join("");
const doc = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><w:body>${body}<w:sectPr><w:headerReference w:type="default" r:id="rIdH"/><w:footerReference w:type="default" r:id="rIdF"/><w:pgSz w:w="11906" w:h="16838"/><w:pgMar w:top="1440" w:right="1440" w:bottom="1440" w:left="1440" w:header="720" w:footer="720" w:gutter="0"/></w:sectPr></w:body></w:document>`;
const style = (id, name, size, bold, outline, extra = "") => `<w:style w:type="paragraph" w:styleId="${id}"><w:name w:val="${name}"/><w:basedOn w:val="Normal"/><w:next w:val="Normal"/><w:qFormat/><w:pPr><w:keepNext/><w:spacing w:before="240" w:after="120"/>${outline !== undefined ? `<w:outlineLvl w:val="${outline}"/>` : ""}${extra}</w:pPr><w:rPr>${bold ? "<w:b/>" : ""}<w:sz w:val="${size}"/></w:rPr></w:style>`;
const styles = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:docDefaults><w:rPrDefault><w:rPr><w:rFonts w:ascii="Calibri" w:eastAsia="SimSun" w:hAnsi="Calibri"/><w:sz w:val="21"/></w:rPr></w:rPrDefault><w:pPrDefault><w:pPr><w:spacing w:after="120" w:line="300" w:lineRule="auto"/></w:pPr></w:pPrDefault></w:docDefaults><w:style w:type="paragraph" w:default="1" w:styleId="Normal"><w:name w:val="Normal"/><w:qFormat/></w:style>${style("Title", "Title", 40, true)}${style("Heading1", "heading 1", 30, true, 0)}${style("Heading2", "heading 2", 26, true, 1)}${style("Caption", "caption", 19, true)}<w:style w:type="paragraph" w:styleId="ListParagraph"><w:name w:val="List Paragraph"/><w:basedOn w:val="Normal"/><w:pPr><w:ind w:left="720"/></w:pPr></w:style><w:style w:type="paragraph" w:styleId="Header"><w:name w:val="header"/><w:basedOn w:val="Normal"/></w:style><w:style w:type="paragraph" w:styleId="Footer"><w:name w:val="footer"/><w:basedOn w:val="Normal"/></w:style><w:style w:type="table" w:styleId="TableGrid"><w:name w:val="Table Grid"/><w:tblPr><w:tblBorders><w:top w:val="single" w:sz="4" w:space="0" w:color="auto"/><w:left w:val="single" w:sz="4" w:space="0" w:color="auto"/><w:bottom w:val="single" w:sz="4" w:space="0" w:color="auto"/><w:right w:val="single" w:sz="4" w:space="0" w:color="auto"/><w:insideH w:val="single" w:sz="4" w:space="0" w:color="auto"/><w:insideV w:val="single" w:sz="4" w:space="0" w:color="auto"/></w:tblBorders></w:tblPr></w:style></w:styles>`;
const numbering = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:numbering xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:abstractNum w:abstractNumId="0"><w:lvl w:ilvl="0"><w:start w:val="1"/><w:numFmt w:val="bullet"/><w:lvlText w:val="•"/><w:lvlJc w:val="left"/><w:pPr><w:ind w:left="720" w:hanging="360"/></w:pPr></w:lvl></w:abstractNum><w:abstractNum w:abstractNumId="1"><w:lvl w:ilvl="0"><w:start w:val="1"/><w:numFmt w:val="decimal"/><w:lvlText w:val="%1."/><w:lvlJc w:val="left"/><w:pPr><w:ind w:left="720" w:hanging="360"/></w:pPr></w:lvl></w:abstractNum><w:num w:numId="1"><w:abstractNumId w:val="0"/></w:num><w:num w:numId="2"><w:abstractNumId w:val="1"/></w:num></w:numbering>`;
const hf = (tag, text) => `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:${tag} xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:p><w:pPr><w:pStyle w:val="${tag === "hdr" ? "Header" : "Footer"}"/></w:pPr>${run(text)}</w:p></w:${tag}>`;
const files = {
  "[Content_Types].xml": `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/><Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/><Override PartName="/word/numbering.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.numbering+xml"/><Override PartName="/word/header1.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.header+xml"/><Override PartName="/word/footer1.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.footer+xml"/><Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/></Types>`,
  "_rels/.rels": `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/></Relationships>`,
  "word/_rels/document.xml.rels": `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rIdS" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/><Relationship Id="rIdN" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/numbering" Target="numbering.xml"/><Relationship Id="rIdH" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/header" Target="header1.xml"/><Relationship Id="rIdF" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/footer" Target="footer1.xml"/></Relationships>`,
  "word/document.xml": doc, "word/styles.xml": styles, "word/numbering.xml": numbering,
  "word/header1.xml": hf("hdr", "城东水厂 · 作业指导书 SC-OPS-017"), "word/footer1.xml": hf("ftr", "受控文件，打印后不受控"),
  "docProps/core.xml": `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:dcterms="http://purl.org/dc/terms/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"><dc:title>二号泵房设备巡检作业指导书</dc:title><dc:creator>设备管理部</dc:creator><dcterms:created xsi:type="dcterms:W3CDTF">2026-08-20T09:00:00Z</dcterms:created></cp:coreProperties>`,
};
const zip = zipSync(Object.fromEntries(Object.entries(files).map(([k, v]) => [k, strToU8(v)])), { level: 9, mtime: new Date("2026-08-20T09:00:00Z") });
writeFileSync(process.argv[2], zip);
console.log(zip.length);
