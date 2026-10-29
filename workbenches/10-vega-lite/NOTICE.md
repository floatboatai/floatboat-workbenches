# 第三方说明

使用 Vega 6.4.0、Vega-Lite 6.5.0、Vega Interpreter 2.3.2，均为 BSD-3-Clause。完整版权文本在 app/src/licenses/。

官方来源：https://vega.github.io/vega/usage/interpreter/ 与 https://vega.github.io/vega-lite/ 。规格校验使用 vega-lite 包内自带的官方 JSON Schema（`vega-lite/vega-lite-schema.json`，随 6.5.0 发布，BSD-3-Clause）；服务端仅把其中含 `<>|"` 等字符的定义名改成安全名称并同步改写 `$ref`，语义不变。

仅使用浏览器 SVG/Canvas 和 AST interpreter；未引入原生 Node canvas，也不使用 `eval`/`new Function`。

## 规格编辑器与 schema 校验（0.9.0 新增）

以下依赖均以精确版本固定在项目根与 `app/` 的 package/lock 文件中。

| 包 | 版本 | 许可证 |
| --- | --- | --- |
| @codemirror/state | 6.7.6 | MIT |
| @codemirror/view | 6.43.15 | MIT |
| @codemirror/commands | 6.11.1 | MIT |
| @codemirror/language | 6.13.1 | MIT |
| @codemirror/lint | 6.9.7 | MIT |
| @codemirror/search | 6.7.2 | MIT |
| @codemirror/autocomplete | 6.20.4 | MIT |
| @codemirror/lang-json | 6.0.2 | MIT |
| @lezer/common | 1.5.4 | MIT |
| @lezer/highlight | 1.2.5 | MIT |
| @lezer/json | 1.0.3 | MIT |
| 传递依赖：@codemirror/streamparser 6.0.0、@lezer/lr 1.4.11、style-mod 4.1.4、w3c-keyname 2.2.8、crelt 1.0.7 | — | MIT |
| @cfworker/json-schema | 4.1.1 | MIT |

CodeMirror 与 Lezer 版权属于 Marijn Haverbeke 及 contributors，许可证见 app/src/licenses/CODEMIRROR-LICENSE；@cfworker/json-schema 版权属于 Jeremy Danyow，许可证见 app/src/licenses/CFWORKER-JSON-SCHEMA-LICENSE（该包为解释型校验器，不依赖 eval，满足页面 CSP）。

schema 补全/悬停（`app/src/ui/schema-assist.ts`）与错误归纳（`app/src/contracts/spec-schema.ts`）为本项目自写代码，未引入第三方 JSON Schema 编辑器插件。

示例库中的数据（三城日气象、区域品类月销售、160 家门店）由 `app/src/contracts/samples.ts` 以固定随机种子生成，为普通演示数据，不对应真实机构。

Floatboat SDK/编译器由固定官方模板提供，不包含于本仓库源码。新增工作台代码未被此说明统一授予上游许可证。
