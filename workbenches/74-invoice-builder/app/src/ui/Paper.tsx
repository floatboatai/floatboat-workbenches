import { memo } from "react";
import { imageUrl, type InvoiceData } from "../contracts/document";
import { financial, lineFinancial } from "../contracts/native";
export const Paper = memo(function Paper({ data }: { data: InvoiceData }) {
  let totals: ReturnType<typeof financial> | undefined;
  try {
    totals = financial(data);
  } catch {}
  const entries = [
    ["小计", totals?.formattedSubTotalAmount],
    ...(data.discountMode === "none"
      ? []
      : [["折扣", totals?.discountAmountFormatted]]),
    ...(data.taxMode === "none"
      ? []
      : [
          [
            data.taxMode === "inclusive" ? "其中含税" : "税费",
            totals?.formattedTotalTaxAmount,
          ],
        ]),
    ...(Number(data.shipping)
      ? [["运费", totals?.shippingAmountFormatted]]
      : []),
    ["总计", totals?.totalAmountFormatted],
    ...(data.kind === "invoice"
      ? [
          ["已付", totals?.totalAmountPaidFormatted],
          ["待付", totals?.balanceDueFormatted],
        ]
      : []),
  ];
  return (
    <article
      className={"paper " + data.layout + " density-" + data.fontSize}
      style={{ "--paper-accent": data.accent } as React.CSSProperties}
      aria-label="单据纸张预览"
    >
      <div className="paper-top">
        <div className="paper-issuer">
          {data.logo ? (
            <img
              src={imageUrl(data.logo)}
              width={80}
              height={64}
              alt="出具方品牌"
            />
          ) : null}
          <h2>{data.issuer.name || "出具方名称"}</h2>
          <p>{data.issuer.address}</p>
          <p>{data.issuer.email}</p>
          <p>{data.issuer.phone}</p>
          <p>{data.issuer.registration}</p>
        </div>
        <div className="paper-identity">
          <div className="paper-kind">
            {data.kind === "quotation" ? "报价单" : "商业发票"}
          </div>
          <p className="paper-number">{data.number || "待填写编号"}</p>
          <dl>
            <dt>出具日期</dt>
            <dd>{data.issued || "—"}</dd>
            <dt>到期日期</dt>
            <dd>{data.due || "—"}</dd>
          </dl>
        </div>
      </div>
      <section className="paper-client">
        <span>客户</span>
        <h3>{data.customer.name || "客户名称"}</h3>
        <p>{data.customer.address}</p>
        <p>{data.customer.email}</p>
        <p>{data.customer.phone}</p>
        <p>{data.customer.registration}</p>
      </section>
      <table className={"paper-table header-" + data.headerStyle}>
        <thead>
          <tr>
            <th>#</th>
            <th>项目</th>
            <th>数量</th>
            <th>金额</th>
          </tr>
        </thead>
        <tbody>
          {data.items.map((l, i) => {
            let row;
            try {
              row = lineFinancial(data, i);
            } catch {}
            return (
              <tr key={l.id}>
                <td>{i + 1}</td>
                <td>
                  <strong>{l.description || "待填写项目"}</strong>
                  <small>
                    {row?.formattedUnitPrice ?? l.price} / {l.unit}
                  </small>
                </td>
                <td>
                  {l.quantity} {l.unit}
                </td>
                <td>{row?.formattedTotal ?? "待核对"}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
      <dl className="paper-totals">
        {entries.map(([key, value]) => (
          <div
            key={key}
            className={key === "总计" || key === "待付" ? "grand" : ""}
          >
            <dt>{key}</dt>
            <dd>{value ?? "待核对"}</dd>
          </div>
        ))}
      </dl>
      <div className="paper-footer">
        {data.bank ? (
          <section>
            <h3>收款信息</h3>
            <p>{data.bank}</p>
          </section>
        ) : null}
        {data.notes ? (
          <section>
            <h3>说明</h3>
            <p>{data.notes}</p>
          </section>
        ) : null}
        {data.terms ? (
          <section>
            <h3>条款</h3>
            <p>{data.terms}</p>
          </section>
        ) : null}
        {data.signature ? (
          <section className="signature">
            <img
              src={imageUrl(data.signature)}
              width={160}
              height={72}
              alt="签章图片"
            />
            <span>签章</span>
          </section>
        ) : null}
      </div>
    </article>
  );
});
