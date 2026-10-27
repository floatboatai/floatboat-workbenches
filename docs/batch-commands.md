# 批量验证

```sh
pnpm batch check --from 2 --to 11
pnpm batch test --from 2 --to 11
pnpm batch package --from 2 --to 11
```

命令按 catalog 顺序运行，独立记录每个项目的通过或失败。完整输出保存在忽略提交的 `.cache/batch/`。单个项目失败不会隐藏其他结果，最终退出码仍为失败。

不指定范围时只选择已经记录为 `local-verified` 的项目。使用 `--dry-run` 可以检查选择范围而不执行命令。源包使用带时间戳的路径，保留已有产物。

运行前应对相应项目执行 `pnpm workbench prepare <slug>`。批量脚本不会自动修改 catalog；浏览器、实际 Host 调用与客户端导入仍要分别验收。
