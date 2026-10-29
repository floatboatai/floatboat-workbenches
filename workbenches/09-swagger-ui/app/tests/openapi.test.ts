import assert from "node:assert/strict";
import { test } from "node:test";
import {
  analyzeSpec,
  convertSource,
  detectFormat,
  SOURCE_LIMIT,
  type SpecAnalysis,
} from "../src/contracts/openapi.ts";

const errors = (analysis: SpecAnalysis) =>
  analysis.diagnostics.filter((item) => item.severity === "error");
const warnings = (analysis: SpecAnalysis) =>
  analysis.diagnostics.filter((item) => item.severity === "warning");

test("识别 YAML 与 JSON", () => {
  assert.equal(detectFormat("openapi: 3.1.0", "api.yml"), "yaml");
  assert.equal(detectFormat("{}", "api.json"), "json");
  assert.equal(detectFormat('  {"openapi":"3.0.0"}'), "json");
  assert.equal(detectFormat("swagger: '2.0'"), "yaml");
});

test("YAML 语法错误指向行号", () => {
  const source = "openapi: 3.0.3\ninfo:\n  title: A\n  version: '1'\npaths:\n  /a:\n    get:\n   responses: {}\n  bad: [\n";
  const analysis = analyzeSpec(source, "yaml");
  assert.equal(analysis.spec, null);
  const first = errors(analysis)[0];
  assert.ok(first.line && first.line >= 7, JSON.stringify(analysis.diagnostics));
  assert.match(first.message, /^YAML 语法/);
});

test("缺括号的连锁错误按行去重并从首个出错行开始", () => {
  const lines = ["openapi: 3.0.3", "info: {title: A, version: '1'}", "paths:", "  /a:", "   bad: ["];
  for (let index = 0; index < 30; index++) lines.push(`  /p${index}:`, "    get: {responses: {'200': {description: ok}}}");
  const analysis = analyzeSpec(lines.join("\n") + "\n", "yaml");
  const list = errors(analysis);
  assert.ok(list.length <= 8, String(list.length));
  assert.ok(list[0].line! <= 6, String(list[0].line));
  assert.match(list[0].message, /没有用 \] 结束/);
  assert.equal(new Set(list.map((item) => item.line)).size, list.length);
});

test("文件末尾才发现的错误指向最后一行内容", () => {
  const analysis = analyzeSpec('openapi: 3.0.3\ninfo:\n  title: A\n  version: "1"\npaths:\n  /a:\n    get:\n      responses:\n        "200": {description: ok\n', "yaml");
  assert.equal(errors(analysis)[0].line, 9);
  assert.match(errors(analysis)[0].message, /没有用 \} 结束/);
});

test("YAML 重复键与多文档被拒绝", () => {
  const duplicate = analyzeSpec("openapi: 3.0.3\ninfo:\n  title: A\n  title: B\n  version: '1'\npaths: {}\n", "yaml");
  assert.equal(errors(duplicate)[0].line, 4);
  assert.match(errors(duplicate)[0].message, /重复/);
  const multi = analyzeSpec("openapi: 3.0.3\n---\nfoo: 1\n", "yaml");
  assert.ok(errors(multi).length);
});

test("JSON 语法错误给出行列", () => {
  const source = '{\n  "openapi": "3.0.3",\n  "info": {"title": "A", "version": "1"},\n  "paths": {},\n}\n';
  const analysis = analyzeSpec(source, "json");
  const first = errors(analysis)[0];
  assert.equal(first.line, 4);
  assert.match(first.message, /多了逗号/);
  const missing = analyzeSpec('{\n  "openapi": "3.0.3"\n  "info": {}\n}', "json");
  assert.equal(errors(missing)[0].line, 3);
});

test("接受绝对 servers、Swagger 2.0 与 OpenAPI 3.1/3.2", () => {
  const oas = analyzeSpec(
    "openapi: 3.0.3\ninfo: {title: A, version: '1'}\nservers:\n  - url: https://api.example.com/v1\n  - url: '{scheme}://example.org'\n    variables: {scheme: {default: https}}\npaths:\n  /pets: {get: {responses: {'200': {description: ok}}}}\n",
    "yaml",
  );
  assert.equal(errors(oas).length, 0);
  assert.equal(warnings(oas).length, 0);
  assert.equal(oas.servers[0].url, "https://api.example.com/v1");

  const swagger = analyzeSpec(
    "swagger: '2.0'\ninfo: {title: Petstore, version: 1.0.0}\nhost: petstore.swagger.io\nbasePath: /v2\nschemes: [https]\nsecurityDefinitions:\n  api_key: {type: apiKey, name: api_key, in: header}\ndefinitions:\n  Pet: {type: object}\npaths:\n  /pet/{petId}:\n    get:\n      parameters: [{name: petId, in: path, required: true, type: integer}]\n      responses: {'200': {description: ok, schema: {$ref: '#/definitions/Pet'}}}\n",
    "yaml",
  );
  assert.equal(errors(swagger).length, 0, JSON.stringify(swagger.diagnostics));
  assert.equal(swagger.version, "2.0");
  assert.deepEqual(swagger.servers, [{ url: "https://petstore.swagger.io/v2", description: "" }]);
  assert.deepEqual(swagger.schemas, ["Pet"]);
  assert.equal(swagger.security[0].name, "api_key");

  const numeric = analyzeSpec("swagger: 2.0\ninfo: {title: A, version: '1'}\nhost: a.example.com\npaths: {}\n", "yaml");
  assert.equal(errors(numeric).length, 0);
  assert.equal(numeric.spec?.swagger, "2.0");
  assert.match(warnings(numeric)[0].message, /数字 2/);

  const webhooks = analyzeSpec(
    '{"openapi":"3.1.0","info":{"title":"Hooks","version":"1"},"webhooks":{"newPet":{"post":{"responses":{"200":{"description":"ok"}}}}}}',
    "json",
  );
  assert.equal(errors(webhooks).length, 0);
  assert.equal(errors(analyzeSpec("openapi: 3.2.0\ninfo: {title: A, version: '1'}\npaths: {}\n", "yaml")).length, 0);
  assert.ok(errors(analyzeSpec("openapi: 4.0.0\ninfo: {title: A, version: '1'}\npaths: {}\n", "yaml")).length);
  assert.ok(errors(analyzeSpec("openapi: 3.0\ninfo: {title: A, version: '1'}\npaths: {}\n", "yaml")).length);
});

test("$ref、路径参数、安全方案与 operationId 给出警告和行号", () => {
  const source = [
    "openapi: 3.0.3",
    "info: {title: A, version: '1'}",
    "servers: [{url: /v1}]",
    "security: [{missing: []}]",
    "paths:",
    "  /a/{id}:",
    "    get:",
    "      operationId: same",
    "      responses:",
    "        '200':",
    "          description: ok",
    "          content:",
    "            application/json:",
    "              schema: {$ref: '#/components/schemas/Nope'}",
    "  /b:",
    "    get:",
    "      operationId: same",
    "      responses: {'200': {$ref: 'https://example.com/r.yaml'}}",
    "",
  ].join("\n");
  const analysis = analyzeSpec(source, "yaml");
  assert.equal(errors(analysis).length, 0);
  const byText = (pattern: RegExp) => warnings(analysis).find((item) => pattern.test(item.message));
  assert.equal(byText(/找不到引用目标/)?.line, 14);
  assert.equal(byText(/外部引用/)?.line, 18);
  assert.equal(byText(/路径参数 id/)?.line, 7);
  assert.equal(byText(/operationId same/)?.line, 17);
  assert.equal(byText(/未定义的方案 missing/)?.line, 4);
  assert.equal(byText(/相对服务器地址/)?.line, 3);
});

test("结构错误阻止应用", () => {
  assert.match(errors(analyzeSpec("info: {title: A}\npaths: {}\n", "yaml"))[0].message, /版本字段/);
  assert.match(errors(analyzeSpec("openapi: 3.0.3\ninfo: {version: '1'}\npaths: {}\n", "yaml"))[0].message, /info.title/);
  assert.match(errors(analyzeSpec("openapi: 3.0.3\ninfo: {title: A, version: '1'}\n", "yaml"))[0].message, /paths/);
  assert.match(errors(analyzeSpec("- a\n- b\n", "yaml"))[0].message, /根节点/);
  const polluted = analyzeSpec('{"openapi":"3.0.3","info":{"title":"A","version":"1"},"paths":{},"__proto__":{"x":1}}', "json");
  assert.ok(errors(polluted).some((item) => /__proto__/.test(item.message)));
  assert.match(errors(analyzeSpec("a".repeat(SOURCE_LIMIT + 1), "yaml"))[0].message, /750,000/);
  assert.match(errors(analyzeSpec("  \n", "yaml"))[0].message, /为空/);
});

test("别名炸弹被限制", () => {
  const lines = ["a: &a [x, x, x, x, x, x, x, x, x, x]"];
  for (let index = 0; index < 12; index++) {
    const previous = String.fromCharCode(97 + index);
    const next = String.fromCharCode(98 + index);
    lines.push(`${next}: &${next} [${Array(10).fill("*" + previous).join(", ")}]`);
  }
  const analysis = analyzeSpec(lines.join("\n") + "\n", "yaml");
  assert.equal(analysis.spec, null);
  assert.ok(errors(analysis).length);
});

test("YAML 与 JSON 互相转换保持语义", () => {
  const yaml = "openapi: 3.0.3\ninfo:\n  title: 示例 # 注释\n  version: '1.0'\npaths:\n  /a:\n    get:\n      responses:\n        '200': {description: ok}\n";
  const spec = analyzeSpec(yaml, "yaml").spec!;
  const json = convertSource(spec, "json");
  assert.deepEqual(analyzeSpec(json, "json").spec, spec);
  const back = convertSource(analyzeSpec(json, "json").spec!, "yaml");
  assert.deepEqual(analyzeSpec(back, "yaml").spec, spec);
  assert.match(back, /["']200["']:/);
});
