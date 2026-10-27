# DuckDB-Wasm 工作台

状态：计划中，尚未实现。

目标：文件数据分析台：CSV/JSON/Parquet查询、关联与聚合

上游：https://github.com/duckdb/duckdb-wasm

适配路线：选浏览器WASM发布包，在React补文件导入、SQL编辑和结果预览，SQLite保存分析项目

限制：它是引擎而非现成工作台；WASM/Worker、扩展加载、浏览器内存与CORS需要专项验证

许可：MIT
