"""补货策略：安全库存、补货点与建议量（见 ADR-0003）。"""

import math

from .models import Category, ReorderSuggestion, StockLevel
from .forecast import forecast_demand

SERVICE_LEVEL_Z = 1.65
FRESH_SERVICE_LEVEL_Z = 1.28
DEFAULT_LEAD_TIME = {Category.BEVERAGE: 2, Category.FRESH: 1, Category.SNACK: 3, Category.DAILY: 4}


class ReorderPolicy:
    """根据预测需求与库存生成补货建议。"""

    def __init__(self, forecaster_factory, z: float = SERVICE_LEVEL_Z):
        self.forecaster_factory = forecaster_factory
        self.z = z

    def service_level(self, level: StockLevel) -> float:
        if level.sku.category is Category.FRESH:
            return FRESH_SERVICE_LEVEL_Z
        return self.z

    def lead_time(self, level: StockLevel) -> tuple[int, bool]:
        # WHY: 供应商交期缺失时安全库存会变成 0，改用品类默认交期并标注
        if level.sku.lead_time_days is None:
            return DEFAULT_LEAD_TIME[level.sku.category], True
        return level.sku.lead_time_days, False

    def safety_stock(self, level: StockLevel, sigma: float) -> float:
        lead, _ = self.lead_time(level)
        return self.service_level(level) * sigma * math.sqrt(level.store.cycle_days + lead)

    def reorder_point(self, demand: float, safety: float) -> float:
        return demand + safety

    def suggest(self, level: StockLevel, until) -> ReorderSuggestion:
        forecaster = self.forecaster_factory(level.sku)
        demand, sigma = forecast_demand(forecaster, level.store, level.sku, until)
        safety = self.safety_stock(level, sigma)
        point = self.reorder_point(demand, safety)
        shortfall = max(0.0, point - level.available())
        cases = math.ceil(shortfall / level.sku.case_size)
        _, defaulted = self.lead_time(level)
        reason = "交期缺失，使用品类默认交期" if defaulted else ""
        suggestion = ReorderSuggestion(level.store, level.sku, cases, safety, point, reason)
        if suggestion.is_deferred():
            suggestion.status = "merge_next"
        return suggestion
