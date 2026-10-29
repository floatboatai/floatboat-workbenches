"""从门店 POS 同步库存快照与销售流水。"""

import logging
from datetime import date

from .models import Sku, StockLevel, Store

log = logging.getLogger(__name__)


class PosTimeout(Exception):
    pass


class InventoryClient:
    """POS 网关客户端；令牌每 30 天轮换一次。"""

    def __init__(self, gateway, token: str):
        self.gateway = gateway
        self.token = token

    def fetch_snapshot(self, store: Store, day: date) -> list[dict]:
        return self.gateway.get(f"/stores/{store.code}/stock", day=day.isoformat(), token=self.token)

    def fetch_sales(self, store: Store, day: date) -> list[dict]:
        return self.gateway.get(f"/stores/{store.code}/sales", day=day.isoformat(), token=self.token)


def load_stock_levels(rows: list[dict], store: Store, catalog: dict[str, Sku]) -> list[StockLevel]:
    levels = []
    for row in rows:
        sku = catalog.get(row["sku"])
        if sku is None:
            log.warning("unknown sku %s at %s", row["sku"], store.code)
            continue
        levels.append(StockLevel(store, sku, row["on_hand"], row.get("in_transit", 0)))
    return levels


def sync_inventory(client: InventoryClient, stores: list[Store], catalog, day: date, failures):
    """逐店同步；单店超时记入 sync_failures，不阻塞其它门店。"""
    result: dict[str, list[StockLevel]] = {}
    for store in stores:
        try:
            rows = client.fetch_snapshot(store, day)
            result[store.code] = load_stock_levels(rows, store, catalog)
        except PosTimeout:
            failures.record(store.code, day, "pos_timeout")
    return result
