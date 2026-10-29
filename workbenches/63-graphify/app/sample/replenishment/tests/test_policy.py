from datetime import date

from replenish.models import Category, Sku, StockLevel, Store
from replenish.policy import ReorderPolicy


class FlatForecast:
    def predict(self, store, sku, until, horizon_days):
        return 10.0 * horizon_days

    def error(self, store, sku, until):
        return 4.0


def make_level(lead_time=2, on_hand=20):
    sku = Sku("6901", "矿泉水 550ml", Category.BEVERAGE, case_size=24, lead_time_days=lead_time)
    return StockLevel(Store("SH-021", "华东"), sku, on_hand)


def test_safety_stock_follows_service_level():
    policy = ReorderPolicy(lambda sku: FlatForecast())
    assert round(policy.safety_stock(make_level(), 4.0), 2) == 19.8


def test_missing_lead_time_uses_category_default():
    policy = ReorderPolicy(lambda sku: FlatForecast())
    suggestion = policy.suggest(make_level(lead_time=None), date(2026, 10, 28))
    assert suggestion.reason == "交期缺失，使用品类默认交期"


def test_suggestion_rounds_up_to_case_size():
    policy = ReorderPolicy(lambda sku: FlatForecast())
    suggestion = policy.suggest(make_level(on_hand=0), date(2026, 10, 28))
    assert suggestion.cases == 4
