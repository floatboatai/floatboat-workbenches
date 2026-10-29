import { useEffect, useState } from "react";
import { approveLowRisk, approveSuggestion, fetchSuggestions, rejectSuggestion, type Suggestion } from "./api";
import { formatCases, formatStockMetric, statusLabel } from "./format";

type Props = { store: string };

/** 采购员审批表：显示安全库存与补货点，支持逐条与批量批准。 */
export function SuggestionTable({ store }: Props) {
  const [rows, setRows] = useState<Suggestion[]>([]);
  const [error, setError] = useState("");

  useEffect(() => {
    fetchSuggestions(store).then(setRows, (e) => setError(e.message));
  }, [store]);

  const replace = (next: Suggestion) => setRows((all) => all.map((r) => (r.id === next.id ? next : r)));

  async function onApprove(row: Suggestion, cases?: number) {
    replace(await approveSuggestion(row.id, cases));
  }

  async function onReject(row: Suggestion) {
    const reason = window.prompt("驳回原因") ?? "";
    try {
      replace(await rejectSuggestion(row.id, reason));
    } catch (e) {
      setError(e instanceof Error ? e.message : "驳回失败");
    }
  }

  async function onBatch() {
    const { approved } = await approveLowRisk(store);
    setError(approved ? "" : "没有可批量批准的低风险建议");
    setRows(await fetchSuggestions(store));
  }

  return (
    <section>
      <header>
        <h2>{store} 待审批建议</h2>
        <button onClick={onBatch}>批量批准低风险建议</button>
      </header>
      {error ? <p role="alert">{error}</p> : null}
      <table>
        <thead>
          <tr>
            <th>商品</th>
            <th>建议量</th>
            <th>安全库存</th>
            <th>补货点</th>
            <th>状态</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <SuggestionRow key={row.id} row={row} onApprove={onApprove} onReject={onReject} />
          ))}
        </tbody>
      </table>
    </section>
  );
}

function SuggestionRow({ row, onApprove, onReject }: {
  row: Suggestion;
  onApprove: (row: Suggestion, cases?: number) => void;
  onReject: (row: Suggestion) => void;
}) {
  const [cases, setCases] = useState(row.cases);
  return (
    <tr>
      <td>{row.name}{row.reason ? <small>{row.reason}</small> : null}</td>
      <td><input type="number" min={0} value={cases} onChange={(e) => setCases(Number(e.target.value))} /> {formatCases(row.cases, row.units)}</td>
      <td>{formatStockMetric(row.safetyStock)}</td>
      <td>{formatStockMetric(row.reorderPoint)}</td>
      <td>{statusLabel(row.status)}</td>
      <td>
        <button onClick={() => onApprove(row, cases === row.cases ? undefined : cases)}>批准</button>
        <button onClick={() => onReject(row)}>驳回</button>
      </td>
    </tr>
  );
}
