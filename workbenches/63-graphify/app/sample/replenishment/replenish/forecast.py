"""需求预测：移动平均与季节系数。"""

import math
from datetime import date, timedelta

from .models import Category, Sku, Store

WINDOW_DAYS = 28


class MovingAverageForecast:
    """最近 28 天日均销量；同时给出预测误差（均方根误差）。"""

    def __init__(self, sales_history, window_days: int = WINDOW_DAYS):
        self.sales_history = sales_history
        self.window_days = window_days

    def daily_sales(self, store: Store, sku: Sku, until: date) -> list[float]:
        start = until - timedelta(days=self.window_days)
        days = self.sales_history.between(store.code, sku.code, start, until)
        if store.promotion_isolation:
            days = [d for d in days if not d.on_promotion]
        return [d.units for d in days]

    def predict(self, store: Store, sku: Sku, until: date, horizon_days: int) -> float:
        sales = self.daily_sales(store, sku, until)
        if not sales:
            return 0.0
        return sum(sales) / len(sales) * horizon_days

    def error(self, store: Store, sku: Sku, until: date) -> float:
        """预测误差：日销量相对均值的均方根误差。"""
        sales = self.daily_sales(store, sku, until)
        if len(sales) < 2:
            return 0.0
        mean = sum(sales) / len(sales)
        return math.sqrt(sum((s - mean) ** 2 for s in sales) / (len(sales) - 1))


class SeasonalForecast(MovingAverageForecast):
    """在移动平均上乘以季节系数；系数按品类与月份维护。"""

    def __init__(self, sales_history, factors: dict[tuple[Category, int], float]):
        super().__init__(sales_history)
        self.factors = factors

    def factor(self, sku: Sku, month: int) -> float:
        # NOTE: 缺少当月系数时回退到 1.0，并由 nightly_run 汇总提醒
        return self.factors.get((sku.category, month), 1.0)

    def predict(self, store: Store, sku: Sku, until: date, horizon_days: int) -> float:
        base = super().predict(store, sku, until, horizon_days)
        return base * self.factor(sku, until.month)


def forecast_demand(forecaster, store: Store, sku: Sku, until: date) -> tuple[float, float]:
    """返回补货周期内的预测需求与预测误差。"""
    demand = forecaster.predict(store, sku, until, store.cycle_days)
    sigma = forecaster.error(store, sku, until)
    return demand, sigma


def choose_forecaster(sku: Sku, sales_history, factors):
    if sku.category in (Category.BEVERAGE, Category.FRESH):
        return SeasonalForecast(sales_history, factors)
    return MovingAverageForecast(sales_history)
