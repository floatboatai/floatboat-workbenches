# Swagger UI 工作台

状态：计划中，尚未实现。

目标：OpenAPI工作台：导入接口定义、浏览调用、Agent生成请求示例

上游：https://github.com/swagger-api/swagger-ui

适配路线：嵌入发布的JS/CSS或React组件，SQLite保存规格，Node层处理必要的请求代理

限制：需验证所选发布包的React19依赖；外部接口调用仍取决于CORS/鉴权，文档浏览不等于自动化测试套件

许可：Apache-2.0
