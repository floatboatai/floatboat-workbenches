# 门店补货助手

为连锁便利店生成每日补货建议：读取门店库存与销售流水，预测未来需求，按**安全库存**与**补货点**计算建议量，交由采购员审批后推送给供应商。

- 架构与数据流见 [架构说明](docs/architecture.md)
- 安全库存的取值依据见 [ADR-0003](docs/adr/0003-safety-stock.md)
- 值班处理见 [运维手册](docs/runbook.md)

## 模块

| 模块 | 职责 |
| --- | --- |
| `replenish/models.py` | 商品、门店、库存快照与补货建议的数据结构 |
| `replenish/forecast.py` | 需求预测：`MovingAverageForecast` 与带季节系数的 `SeasonalForecast` |
| `replenish/policy.py` | `ReorderPolicy`：安全库存、补货点与建议量 |
| `replenish/inventory.py` | 从门店 POS 同步库存：`sync_inventory` |
| `replenish/approval.py` | 采购员审批队列 `ApprovalQueue` |
| `replenish/jobs.py` | 夜间批处理 `nightly_run` 与失败重试 |
| `web/src/` | 采购员审批界面 |

## 本地运行

```bash
python -m replenish.jobs --date 2026-10-28 --dry-run
```

夜间任务的输出写入 `suggestions` 表，审批界面通过 `/api/suggestions` 读取。**补货周期**默认 7 天，可在门店配置中覆盖。
