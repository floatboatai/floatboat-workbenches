# 第三方声明

API 参考台采用以下开源组件：

| 组件 | 版本 | 许可 | 用途 |
| --- | --- | --- | --- |
| [swagger-ui-dist](https://github.com/swagger-api/swagger-ui) | 5.34.0 | Apache-2.0 | 原生接口文档与 Try it out（未修改上游发布的 JS/CSS） |
| [yaml](https://github.com/eemeli/yaml) | 2.8.2 | ISC | 解析 YAML/JSON 原文、定位诊断行号、YAML ↔ JSON 转换 |

页面、项目存储、试调代理、内置示例服务与同源资源路由由本仓库实现。上游 LICENSE / NOTICE 保留在 `app/src/licenses/`（SWAGGER-UI-LICENSE、SWAGGER-UI-NOTICE、YAML-LICENSE），随源码和工作台打包。Swagger 名称只用于说明技术来源。
