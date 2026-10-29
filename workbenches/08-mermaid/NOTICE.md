# 第三方说明

本工作台使用 Mermaid 12.2.0，MIT License，版权属于 Mermaid contributors。完整声明见 app/src/licenses/MERMAID-LICENSE。

上游：https://github.com/mermaid-js/mermaid
官方 API：https://mermaid.js.org/config/usage.html

`app/src/contracts/mermaid-source.ts` 中的 frontmatter 匹配与指令/注释清理规则按 Mermaid 12.2.0 `src/diagram-api/regexes.ts`、`src/preprocess.ts`（MIT）移植，用于把解析错误行号映射回原始源码。

## 源码编辑器（0.9.0 新增）

以下依赖均为 MIT License，版权属于 Marijn Haverbeke 及 CodeMirror contributors（https://codemirror.net），以精确版本固定在项目根与 `app/` 的 package/lock 文件中。完整许可证文本见 app/src/licenses/CODEMIRROR-LICENSE。

| 包 | 版本 |
| --- | --- |
| @codemirror/state | 6.7.6 |
| @codemirror/view | 6.43.15 |
| @codemirror/commands | 6.11.1 |
| @codemirror/language | 6.13.1 |
| @codemirror/lint | 6.9.7 |
| @codemirror/search | 6.7.2 |
| @codemirror/autocomplete | 6.20.4 |
| @lezer/highlight | 1.2.5 |
| 传递依赖：@codemirror/streamparser 6.0.0、@lezer/common 1.5.4、@lezer/lr 1.4.11、style-mod 4.1.4、w3c-keyname 2.2.8、crelt 1.0.7 | MIT |

Mermaid 语法高亮（`app/src/ui/mermaid-language.ts`）为本项目自写的 CodeMirror 流式分词器，未引入第三方 Mermaid 语言包。

Floatboat SDK/编译器由固定官方模板提供，不包含于本仓库源码。新增工作台代码未被此说明统一授予上游许可证。
