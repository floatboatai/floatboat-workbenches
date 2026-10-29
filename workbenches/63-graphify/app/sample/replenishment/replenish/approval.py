"""采购员审批队列。"""

from datetime import datetime

from .models import ReorderSuggestion

BACKLOG_ALERT = 500


class ApprovalError(ValueError):
    pass


class ApprovalQueue:
    """待审批的补货建议；所有操作写入审计日志。"""

    def __init__(self, repository, audit, notifier):
        self.repository = repository
        self.audit = audit
        self.notifier = notifier

    def submit(self, suggestions: list[ReorderSuggestion]) -> int:
        pending = [s for s in suggestions if s.cases > 0 and s.status == "pending"]
        self.repository.save_all(pending)
        if self.repository.count_pending() > BACKLOG_ALERT:
            self.audit.alert("approval_backlog", self.repository.count_pending())
        return len(pending)

    def approve(self, suggestion_id: str, buyer: str, cases: int | None = None):
        suggestion = self.repository.get(suggestion_id)
        if cases is not None:
            suggestion.cases = cases
        suggestion.status = "approved"
        self.repository.update(suggestion)
        self.audit.log(buyer, "approve", suggestion_id, datetime.now())
        notify_buyer(self.notifier, suggestion)
        return suggestion

    def reject(self, suggestion_id: str, buyer: str, reason: str):
        if not reason.strip():
            raise ApprovalError("驳回必须填写原因")
        suggestion = self.repository.get(suggestion_id)
        suggestion.status = "rejected"
        suggestion.reason = reason
        self.repository.update(suggestion)
        self.audit.log(buyer, "reject", suggestion_id, datetime.now())
        return suggestion

    def approve_low_risk(self, store_code: str, buyer: str, max_cases: int = 2) -> int:
        approved = 0
        for suggestion in self.repository.pending_for_store(store_code):
            if suggestion.cases <= max_cases:
                self.approve(suggestion.id, buyer)
                approved += 1
        return approved


def notify_buyer(notifier, suggestion: ReorderSuggestion):
    """批准后通知供应商对接人。"""
    notifier.send(
        to=suggestion.sku.code,
        subject=f"补货确认 {suggestion.store.code}",
        body=f"{suggestion.sku.name} × {suggestion.cases} 箱",
    )
