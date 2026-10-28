import {
  getFinancialData,
  getItemFinancialData,
  type NativeItem,
  type FinancialInput,
} from "../vendor/money.js";
import {
  currencies,
  minor,
  validateInvoice,
  imageUrl,
  type InvoiceData,
} from "./document.ts";
export const SOURCE_COMMIT = "2979d91742008be0d2376e919be9e404657a900b";
export function nativeItems(d: InvoiceData): NativeItem[] {
  return d.items.map((l) => ({
    quantity: Number(l.quantity),
    taxRate: 0,
    invoiceItemSnapshot: {
      itemName: l.description,
      unitName: l.unit,
      unitPriceCents: String(minor(l.price, d.currency, "单价")),
    },
  }));
}
export function financeInput(raw: InvoiceData): FinancialInput {
  const d = validateInvoice(raw),
    c = currencies[d.currency];
  return {
    storeSettings: {
      amountFormat: d.currency === "JPY" ? "en-US-no-decimal" : "en-US",
    },
    currencySymbol: c.symbol,
    currencyCode: d.currency,
    currencySubunit: c.subunit,
    currencyFormat: "{code} {amount}",
    invoiceItems: nativeItems(d),
    invoicePayments: [
      { amountCents: String(minor(d.paid, d.currency, "已付")) },
    ],
    discountType: d.discountMode === "none" ? undefined : d.discountMode,
    discountAmount:
      d.discountMode === "fixed" ? minor(d.discount, d.currency, "折扣") : 0,
    discountPercent: d.discountMode === "percentage" ? Number(d.discount) : 0,
    taxRate: Number(d.taxRate),
    taxType: d.taxMode === "none" ? undefined : d.taxMode,
    shippingAmount: minor(d.shipping, d.currency, "运费"),
  };
}
export function financial(raw: InvoiceData) {
  const result = getFinancialData(financeInput(raw));
  if (
    !Number.isFinite(result.totalAmount) ||
    !Number.isFinite(result.balanceDue)
  )
    throw Error("金额无法计算。");
  if (result.balanceDue < -0.00001) throw Error("已付金额不能超过单据总计。");
  return result;
}
export function toNative(raw: InvoiceData) {
  const d = validateInvoice(raw);
  financial(d);
  const c = currencies[d.currency];
  const first = {
    type: "row",
    justify: "between",
    children: [
      {
        type: "column",
        width: "50%",
        children: [{ type: "logo" }, { type: "businessInfo" }],
      },
      {
        type: "invoiceMeta",
        width: "50%",
        showTitle: true,
        showInvoiceLabel: true,
      },
    ],
  };
  const header =
    d.layout === "classic"
      ? [first, { type: "clientInfo", paddingTop: 20, paddingBottom: 20 }]
      : [
          {
            type: "row",
            justify: "between",
            children: [
              { type: "businessInfo", width: "60%" },
              { type: "logo", width: "20%" },
            ],
          },
          {
            type: "row",
            justify: "between",
            paddingTop: 20,
            paddingBottom: 20,
            children: [
              { type: "clientInfo", width: "50%" },
              {
                type: "invoiceMeta",
                width: "50%",
                showTitle: true,
                showInvoiceLabel: true,
              },
            ],
          },
        ];
  const invoiceForm = {
    invoiceType: d.kind,
    status: "open",
    invoiceNumber: d.number,
    invoicePrefix: "",
    invoiceSuffix: "",
    issuedAt: d.issued,
    dueDate: d.due,
    layoutId: 1,
    currencyFormat: "{code} {amount}",
    invoiceCurrencySnapshot: {
      currencyCode: d.currency,
      currencySymbol: c.symbol,
      currencySubunit: c.subunit,
    },
    invoiceItems: nativeItems(d),
    invoicePayments: [
      { amountCents: String(minor(d.paid, d.currency, "已付")) },
    ],
    discountType: d.discountMode === "none" ? undefined : d.discountMode,
    discountAmountCents: String(
      d.discountMode === "fixed" ? minor(d.discount, d.currency, "折扣") : 0,
    ),
    discountPercent: d.discountMode === "percentage" ? Number(d.discount) : 0,
    taxType: d.taxMode === "none" ? undefined : d.taxMode,
    taxRate: Number(d.taxRate),
    shippingFeeCents: String(minor(d.shipping, d.currency, "运费")),
    invoiceBusinessSnapshot: {
      businessName: d.issuer.name,
      businessAddress: d.issuer.address,
      businessEmail: d.issuer.email,
      businessPhone: d.issuer.phone,
      businessCode: d.issuer.registration,
      businessPaymentInformation: d.bank,
    },
    invoiceBankSnapshot: d.bank ? { accountHolder: d.bank } : undefined,
    invoiceClientSnapshot: {
      clientName: d.customer.name,
      clientAddress: d.customer.address,
      clientEmail: d.customer.email,
      clientPhone: d.customer.phone,
      clientCode: d.customer.registration,
    },
    customerNotes: d.notes,
    termsConditionNotes: d.terms,
    signatureData: d.signature ? "workbench-managed-image" : null,
    invoiceCustomization: {
      fontFamily: "Roboto",
      fontSize: d.fontSize,
      pageFormat: d.pageSize,
      showRowNo: true,
      showQuantity: true,
      showUnit: true,
      tableHeaderStyle: d.headerStyle,
      tableRowStyle: "stripped",
      color: d.accent,
    },
    invoiceLayoutSnapshot: {
      layoutSchema: {
        schemaVersion: 1,
        sections: [
          { type: "header", blocks: header },
          { type: "itemsTable", columnSizing: "proportional" },
          { type: "financialTotals" },
          { type: "paymentInfo" },
          { type: "notes" },
          { type: "signature" },
          { type: "pageCounter" },
        ],
      },
    },
  };
  return {
    invoiceForm,
    storeSettings: {
      amountFormat: d.currency === "JPY" ? "en-US-no-decimal" : "en-US",
      dateFormat: "yyyy-MM-dd",
    },
    pdfTexts,
    attachmentUrls: [] as [],
    layoutRequired: "请选择单据版式",
    logoUrl: imageUrl(d.logo),
    signatureUrl: imageUrl(d.signature),
  };
}
export const pdfTexts = {
  billTo: "客户",
  invoiceNo: "编号",
  quoteNo: "报价编号",
  date: "出具日期",
  dueDate: "到期日期",
  customerNote: "说明",
  termsConditions: "条款",
  of: "/",
  page: "页",
  paymentInfo: "收款信息",
  pdfINVOICE: "商业发票",
  pdfQUOTE: "报价单",
  subTotalLabel: "小计",
  discountLabel: "折扣",
  surchargeLabel: "附加费",
  incLabel: "已含",
  taxLabel: "税费",
  taxExclusivePerItemLabel: "额外税",
  taxInclusivePerItemLabel: "含税",
  shippingFeeLabel: "运费",
  totalLabel: "总计",
  paidLabel: "已付",
  balanceDueLabel: "待付",
  itemLabel: "项目",
  unitLabel: "单位",
  qtyLabel: "数量",
  unitCostLabel: "单价",
  authorisedSignatoryLabel: "签章",
};
export function validateDocument(raw: unknown) {
  const data = validateInvoice(raw);
  financial(data);
  return data;
}

export function lineFinancial(d: InvoiceData, index: number) {
  const input = financeInput(d),
    item = input.invoiceItems[index];
  return getItemFinancialData({
    ...input,
    taxType: undefined,
    taxRate: 0,
    unitPrice: Number(item.invoiceItemSnapshot.unitPriceCents),
    quantity: item.quantity,
  });
}
