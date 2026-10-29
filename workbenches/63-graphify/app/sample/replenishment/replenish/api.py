"""审批界面使用的 HTTP 接口。"""

from .approval import ApprovalError, ApprovalQueue


def register(app, queue: ApprovalQueue):
    @app.get("/api/suggestions")
    def list_suggestions(request):
        store = request.query.get("store")
        rows = queue.repository.pending_for_store(store) if store else queue.repository.pending()
        return [serialize(s) for s in rows]

    @app.post("/api/suggestions/<suggestion_id>/approve")
    def approve(request, suggestion_id):
        body = request.json()
        return serialize(queue.approve(suggestion_id, request.user, body.get("cases")))

    @app.post("/api/suggestions/<suggestion_id>/reject")
    def reject(request, suggestion_id):
        try:
            return serialize(queue.reject(suggestion_id, request.user, request.json().get("reason", "")))
        except ApprovalError as error:
            return {"error": str(error)}, 400

    @app.post("/api/stores/<store_code>/approve-low-risk")
    def approve_low_risk(request, store_code):
        return {"approved": queue.approve_low_risk(store_code, request.user)}


def serialize(s) -> dict:
    return {
        "id": s.id,
        "store": s.store.code,
        "sku": s.sku.code,
        "name": s.sku.name,
        "cases": s.cases,
        "units": s.units(),
        "safetyStock": round(s.safety_stock, 1),
        "reorderPoint": round(s.reorder_point, 1),
        "reason": s.reason,
        "status": s.status,
    }
