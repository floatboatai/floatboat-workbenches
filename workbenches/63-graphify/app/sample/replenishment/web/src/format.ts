// 数量与库存指标的显示格式。

const number = new Intl.NumberFormat("zh-CN", { maximumFractionDigits: 1 });

export function formatCases(cases: number, units: number) {
  return `${cases} 箱（${number.format(units)} 件）`;
}

export function formatStockMetric(value: number) {
  return number.format(value);
}

export function statusLabel(status: string) {
  switch (status) {
    case "approved":
      return "已批准";
    case "rejected":
      return "已驳回";
    case "merge_next":
      return "合并到下次";
    default:
      return "待审批";
  }
}
