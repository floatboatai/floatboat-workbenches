// 审批界面的接口封装；所有请求带上当前门店。

export type Suggestion = {
  id: string;
  store: string;
  sku: string;
  name: string;
  cases: number;
  units: number;
  safetyStock: number;
  reorderPoint: number;
  reason: string;
  status: "pending" | "approved" | "rejected" | "merge_next";
};

export class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

async function send<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(path, {
    ...init,
    headers: { "Content-Type": "application/json", ...init?.headers },
  });
  const body = await response.json();
  if (!response.ok) throw new ApiError(response.status, body.error ?? "请求失败");
  return body as T;
}

/** 读取待审批建议；store 为空时返回全部门店。 */
export function fetchSuggestions(store?: string) {
  const query = store ? `?store=${encodeURIComponent(store)}` : "";
  return send<Suggestion[]>(`/api/suggestions${query}`);
}

export function approveSuggestion(id: string, cases?: number) {
  return send<Suggestion>(`/api/suggestions/${id}/approve`, {
    method: "POST",
    body: JSON.stringify({ cases }),
  });
}

export function rejectSuggestion(id: string, reason: string) {
  // NOTE: 驳回原因由服务端校验，这里只做空值提示
  if (!reason.trim()) return Promise.reject(new ApiError(400, "请填写驳回原因"));
  return send<Suggestion>(`/api/suggestions/${id}/reject`, {
    method: "POST",
    body: JSON.stringify({ reason }),
  });
}

export function approveLowRisk(store: string) {
  return send<{ approved: number }>(`/api/stores/${store}/approve-low-risk`, { method: "POST" });
}
