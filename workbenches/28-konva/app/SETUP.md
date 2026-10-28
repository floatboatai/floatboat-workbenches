# 本地与 Floatboat

使用 Node 22 和锁定依赖，在项目根执行 pnpm workbench:check、pnpm test、pnpm dev -- --no-watch。无需模型、密钥或远程服务。

资源：originals 是应用数据目录，自动建立；third-party-notices 是 app/licenses 固定目录，随源码包交付。默认 .fbworkbench 不包含原图或业务数据。迁移已有内容请先导出完整工程 JSON，再在新实例导入；恢复稿只在原件仍存在时完整恢复。

Floatboat → My → Workbenches → Import workbench。实际客户端导入尚未验收，不能用本地打包成功代替。
