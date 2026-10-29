"""补货领域的数据结构。"""

from dataclasses import dataclass, field
from datetime import date
from enum import Enum


class Category(Enum):
    BEVERAGE = "beverage"
    FRESH = "fresh"
    SNACK = "snack"
    DAILY = "daily"


@dataclass(frozen=True)
class Sku:
    """商品主数据：箱规与最小起订量来自供应商合同。"""

    code: str
    name: str
    category: Category
    case_size: int
    min_order_cases: int = 1
    lead_time_days: int | None = None


@dataclass(frozen=True)
class Store:
    """门店与其补货配置。"""

    code: str
    region: str
    cycle_days: int = 7
    promotion_isolation: bool = False


@dataclass
class StockLevel:
    """某门店某商品在快照时刻的库存。"""

    store: Store
    sku: Sku
    on_hand: int
    in_transit: int = 0
    snapshot_date: date = field(default_factory=date.today)

    def available(self) -> int:
        return self.on_hand + self.in_transit


@dataclass
class ReorderSuggestion:
    """一条补货建议；数量以箱为单位。"""

    store: Store
    sku: Sku
    cases: int
    safety_stock: float
    reorder_point: float
    reason: str = ""
    status: str = "pending"

    def units(self) -> int:
        return self.cases * self.sku.case_size

    def is_deferred(self) -> bool:
        return self.cases < self.sku.min_order_cases
