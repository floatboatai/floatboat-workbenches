"""夜间批处理与失败重试。"""

import argparse
from datetime import date

from .approval import ApprovalQueue
from .forecast import choose_forecaster
from .inventory import InventoryClient, sync_inventory
from .policy import ReorderPolicy


def nightly_run(ctx, day: date, dry_run: bool = False) -> dict:
    """同步库存 → 预测 → 生成建议 → 提交审批。"""
    client = InventoryClient(ctx.gateway, ctx.pos_token)
    levels_by_store = sync_inventory(client, ctx.stores, ctx.catalog, day, ctx.failures)
    policy = ReorderPolicy(lambda sku: choose_forecaster(sku, ctx.sales, ctx.seasonal_factors))
    suggestions = []
    for levels in levels_by_store.values():
        for level in levels:
            suggestions.append(policy.suggest(level, day))
    missing_factors = [s for s in suggestions if s.sku.category.value in ctx.factor_gaps]
    if dry_run:
        return {"suggestions": len(suggestions), "missing_factors": len(missing_factors)}
    queue = ApprovalQueue(ctx.repository, ctx.audit, ctx.notifier)
    submitted = queue.submit(suggestions)
    return {"suggestions": len(suggestions), "submitted": submitted, "missing_factors": len(missing_factors)}


def retry_failed_orders(ctx, day: date) -> int:
    """06:00 重试夜间同步失败的门店。"""
    failed = [s for s in ctx.stores if ctx.failures.has(s.code, day)]
    if not failed:
        return 0
    client = InventoryClient(ctx.gateway, ctx.pos_token)
    recovered = sync_inventory(client, failed, ctx.catalog, day, ctx.failures)
    for code in recovered:
        ctx.failures.clear(code, day)
    return len(recovered)


def main(argv=None):
    parser = argparse.ArgumentParser(prog="replenish.jobs")
    parser.add_argument("--date", type=date.fromisoformat, default=date.today())
    parser.add_argument("--dry-run", action="store_true")
    parser.add_argument("--only-failed", action="store_true")
    args = parser.parse_args(argv)
    from .context import load_context

    ctx = load_context()
    if args.only_failed:
        return retry_failed_orders(ctx, args.date)
    return nightly_run(ctx, args.date, dry_run=args.dry_run)


if __name__ == "__main__":
    main()
