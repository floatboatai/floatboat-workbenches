import assert from "node:assert/strict";
import { test } from "node:test";
import { seed, validatePdf, pdfInput } from "../src/contracts/domain.ts";
test("导出使用新字段默认内容并保留明确填写的空字符串", () => {
  const doc = structuredClone(seed);
  doc.template.schemas[0].push({
    name: "added",
    type: "text",
    content: "新增字段内容",
    position: { x: 10, y: 10 },
    width: 30,
    height: 10,
  });
  doc.values.customer = "";
  const input = pdfInput(doc);
  assert.equal(input.added, "新增字段内容");
  assert.equal(input.customer, "");
  assert.equal("heading" in input, false);
});
test("模板恢复保留多页和自定义纸张，过滤未知字段", () => {
  const data = structuredClone(seed);
  data.template.basePdf = {
    width: 148,
    height: 210,
    padding: [10, 10, 10, 10],
  };
  data.template.schemas.push([
    {
      name: "page2",
      type: "text",
      content: "第二页中文",
      position: { x: 12, y: 20 },
      width: 120,
      height: 20,
    },
  ]);
  data.values.unknown = "忽略";
  const result = validatePdf(data);
  assert.equal(result.template.schemas.length, 2);
  assert.equal(result.template.schemas[1][0].fontName, "NotoSansSC");
  assert.equal("unknown" in result.values, false);
  assert.equal(data.template.schemas[1][0].fontName, undefined);
});
test("拒绝重复字段、外部PDF背景、远程字体和非有限尺寸", () => {
  const reserved = structuredClone(seed);
  reserved.template.schemas[0][0].name = "constructor";
  assert.throws(() => validatePdf(reserved));
  const duplicate = structuredClone(seed);
  duplicate.template.schemas[0].push(duplicate.template.schemas[0][0]);
  assert.throws(() => validatePdf(duplicate));
  assert.throws(() =>
    validatePdf({
      ...seed,
      template: { ...seed.template, basePdf: "https://external.test/file.pdf" },
    }),
  );
  const invalid = structuredClone(seed);
  invalid.template.schemas[0][0].fontName = "Remote";
  assert.throws(() => validatePdf(invalid));
  invalid.template.schemas[0][0].fontName = "NotoSansSC";
  invalid.template.schemas[0][0].position.x = Infinity;
  assert.throws(() => validatePdf(invalid));
});

test("恢复未完成字段名及越界位置草稿，不放宽字体与原型保留名称", async () => {
  const { restorePdfDraft } = await import("../src/contracts/domain.ts");
  const draft = structuredClone(seed);
  draft.template.schemas[0][0].name = "";
  draft.template.schemas[0][0].position.x = -1;
  assert.equal(restorePdfDraft(draft).template.schemas[0][0].name, "");
  assert.throws(() => validatePdf(draft));
  draft.template.schemas[0][0].name = "constructor";
  assert.throws(() => restorePdfDraft(draft));
});

test("设计器未应用属性保留原字符串，修正后才变更模板", async()=>{
 const {readDesignerDrafts,applyDesignerDrafts,designerDraftApplied}=await import('../src/contracts/designer-draft.ts');
 const raw={field:'customer',property:'position_x',value:'-1'};
 const draft=readDesignerDrafts([raw]);assert.equal(draft.length,1);
 assert.throws(()=>applyDesignerDrafts(seed,draft));
 assert.equal(seed.template.schemas[0].find(field=>field.name==='customer')?.position.x,22);
 const applied=applyDesignerDrafts(seed,[{...draft[0],value:'28'}]);
 assert.equal(applied.template.schemas[0].find(field=>field.name==='customer')?.position.x,28);
 assert.equal(designerDraftApplied(applied.template,{...draft[0],value:'28'}),true);
 assert.throws(()=>applyDesignerDrafts(seed,[{...draft[0],value:''}]));
 assert.throws(()=>applyDesignerDrafts(seed,[{...draft[0],field:'missing',value:'28'}]));
 assert.throws(()=>applyDesignerDrafts(seed,[{...draft[0],property:'name',value:'__proto__'}]));
 assert.deepEqual(readDesignerDrafts([{...raw,property:'__proto__'}, {...raw,value:{}}]),[]);
});
