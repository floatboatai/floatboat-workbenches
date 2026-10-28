// Derived from piratuks/invoice-builder commit 2979d91742008be0d2376e919be9e404657a900b; MIT. See notices/provenance.json.

// .patch-work/upstream/packages/contracts/src/types/layouts.ts
var MAX_LAYOUT_BYTES = 64 * 1024;
var validV2ContainerNodeTypes = ["row", "column", "grid"];
var validV2NodeTypes = [...validV2ContainerNodeTypes, "block", "section"];

// .patch-work/upstream/apps/renderer/src/pages/invoices/Preview/PDFDocument.tsx
import { Document, Image as Image6, Page, Text as Text11, View as View10 } from "@react-pdf/renderer";
import { Fragment as Fragment2, memo as memo16, useMemo as useMemo3 } from "react";

// .patch-work/upstream/apps/renderer/src/pages/invoices/Preview/constant.ts
import { StyleSheet } from "@react-pdf/renderer";
var createCustomFontStyles = (fontFamily) => StyleSheet.create({
  customFont: {
    fontFamily: fontFamily || "Roboto"
  }
});
var DEFAULT_FONT_SIZES = "medium" /* medium */;
var DEFAULT_LOGO_SIZES = "medium" /* medium */;
var DEFAULT_USER_COLUMN_WEIGHT = 10;
var LOGO_SIZES = {
  small: { width: 48, height: 48 },
  medium: { width: 64, height: 64 },
  large: { width: 80, height: 80 }
};
var COLUMN_WEIGHTS = {
  rowNo: 5,
  item: 35,
  quantity: 15,
  unit: 15,
  unitCost: 15,
  total: 15
};
var FIXED_COLUMNS = {
  rowNo: 30,
  quantity: 55,
  unit: 55,
  unitCost: 65,
  total: 75
};
var FONT_WIDTH_MULTIPLIERS = {
  Helvetica: 6,
  Roboto: 6,
  "Times-Roman": 7,
  Courier: 10,
  Inter: 6
};
var FONT_SIZES = {
  small: {
    page: 10,
    business: 12,
    businessText: 8,
    title: 16,
    regular: 8,
    regularBold: 8,
    tableCellHeader: 8,
    tableCell: 7,
    tableCellSubtle: 6,
    pageCounter: 8
  },
  medium: {
    page: 12,
    business: 14,
    businessText: 10,
    title: 20,
    regular: 10,
    regularBold: 10,
    tableCellHeader: 10,
    tableCell: 9,
    tableCellSubtle: 8,
    pageCounter: 10
  },
  large: {
    page: 14,
    business: 16,
    businessText: 12,
    title: 24,
    regular: 12,
    regularBold: 12,
    tableCellHeader: 12,
    tableCell: 11,
    tableCellSubtle: 10,
    pageCounter: 12
  }
};
var PDF_STYLES = StyleSheet.create({
  page: {
    padding: 32
  },
  header: { paddingBottom: 16 },
  row: { flexDirection: "row" },
  spaceBetween: { justifyContent: "space-between" },
  flexGrow: { flexGrow: 1 },
  gap3: { gap: 3 },
  gap4: { gap: 4 },
  gap5: { gap: 5 },
  gap10: { gap: 10 },
  pt20: { paddingTop: 20 },
  pb20: { paddingBottom: 20 },
  pt10: { paddingTop: 10 },
  pb10: { paddingBottom: 10 },
  pb5: { paddingBottom: 5 },
  pt5: { paddingTop: 5 },
  w100: { width: "100%" },
  headerBlockWidth: { flexShrink: 1, minWidth: 0 },
  invoiceMeta: { width: "100%", minWidth: 0 },
  invoiceMetaRow: { flexDirection: "row", justifyContent: "flex-end", width: "100%", minWidth: 0 },
  invoiceMetaRowWrap: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "flex-end",
    width: "100%",
    minWidth: 0
  },
  invoiceMetaValue: { flexShrink: 1, minWidth: 0, textAlign: "right" },
  w40: { width: "40%" },
  textEnd: { textAlign: "right" },
  w60: { width: "60%" },
  w50: { width: "50%" },
  w5: { width: "5%" },
  w35: { width: "35%" },
  w20: { width: "20%" },
  w15: { width: "15%" },
  border: { height: 1, backgroundColor: "#e0e0e0" },
  maxw50: { maxWidth: "50%" },
  alignStart: { alignItems: "flex-start" },
  alignCenter: { alignItems: "center" },
  alignEnd: { alignItems: "flex-end" },
  business: { fontWeight: 500 },
  businessText: { fontWeight: 400, color: "#808080" },
  title: { fontWeight: 700 },
  regular: { fontWeight: 400 },
  regularBold: { fontWeight: 600, color: "#333333" },
  italic: { fontStyle: "italic" },
  layoutRequired: { color: "#d32f2f", fontWeight: 700 },
  table: {
    width: "100%",
    paddingTop: 10
  },
  tableCol: {
    padding: 6,
    overflow: "hidden",
    textOverflow: "ellipsis"
  },
  tableCellHeader: {
    fontWeight: "bold"
  },
  tableCellSubtle: {
    color: "#808080"
  },
  attachment: { width: "100%", height: "90%", objectFit: "contain" },
  signature: {
    width: "100px",
    objectFit: "contain"
  },
  watermark: {
    position: "absolute",
    top: "0",
    left: "0",
    height: "100%",
    width: "100%",
    opacity: 0.2,
    objectFit: "contain"
  },
  watermarkPaid: {
    position: "absolute",
    top: "50%",
    left: "50%",
    transform: "translate(-50%, -50%) rotate(-30deg)",
    width: 64,
    height: 64,
    opacity: 1
  },
  pageCounter: {
    position: "absolute",
    bottom: 20,
    right: 40,
    color: "#808080"
  }
});

// .patch-work/upstream/apps/renderer/src/pages/invoices/Preview/FinancialInfo.tsx
import { Text, View } from "@react-pdf/renderer";
import { memo, useMemo } from "react";

// .patch-work/upstream/apps/renderer/src/shared/utils/invoiceFunctions.ts
import { differenceInCalendarDays, parseISO as parseISO2 } from "date-fns";

// .patch-work/upstream/apps/renderer/src/shared/utils/formatFunctions.ts
import { format, parseISO } from "date-fns";
var formatDate = (date, pattern) => {
  if (!date) return "";
  const d = typeof date === "string" ? parseISO(date) : date;
  if (isNaN(d.getTime())) return "";
  return format(d, pattern);
};
var getFormattedCurrency = (data) => {
  const formattedAmount = formatAmount(data.amount, data.amountFormat);
  return data.format.replace("{symbol}", data.symbol).replace("{code}", data.code).replace("{amount}", formattedAmount);
};
var getFormattingMeta = (amountFormat = "en-US" /* enUS */) => {
  const hasDecimal = !amountFormat.includes("no-decimal");
  const separatorMap = {
    "en-US": { thousand: ",", decimal: "." },
    "lt-LT": { thousand: " ", decimal: "," },
    "de-DE": { thousand: ".", decimal: "," }
  };
  const baseLocale = amountFormat.replace("-no-decimal", "");
  const { thousand, decimal } = separatorMap[baseLocale] || { thousand: ",", decimal: "." };
  return { hasDecimal, thousand, decimal, baseLocale };
};
var formatAmount = (amount, amountFormat = "en-US" /* enUS */) => {
  const { hasDecimal, baseLocale } = getFormattingMeta(amountFormat);
  const options = {
    minimumFractionDigits: hasDecimal ? 2 : 0,
    maximumFractionDigits: hasDecimal ? 2 : 0,
    useGrouping: true
  };
  return new Intl.NumberFormat(baseLocale, options).format(amount);
};

// .patch-work/upstream/apps/renderer/src/shared/utils/invoiceFunctions.ts
var calcUnitPrice = (data) => {
  const { supportsSubunit, amountCents, subunit } = data;
  if (supportsSubunit && subunit === 0) return 0;
  const unitPrice = supportsSubunit ? amountCents / subunit : amountCents;
  return unitPrice;
};
var calcTax = (amount, taxRate, taxType) => {
  if (!taxType) return 0;
  switch (taxType) {
    case "exclusive" /* exclusive */:
    case "exclusive" /* exclusive */:
      return amount * taxRate / 100;
    case "inclusive" /* inclusive */:
    case "inclusive" /* inclusive */:
      return amount * taxRate / (100 + taxRate);
    case "deducted" /* deducted */:
      return -(amount * taxRate) / 100;
    default:
      return 0;
  }
};
var calcSurcharge = (data) => {
  const { subTotal, surchargeType, surchargeAmount, surchargePercent } = data;
  if (!surchargeType) return 0;
  return surchargeType === "fixed" /* fixed */ ? surchargeAmount ?? 0 : subTotal * (surchargePercent ?? 0) / 100;
};
var calcDiscount = (data) => {
  const { subTotal, discountType, discountAmount, discountPercent } = data;
  if (!discountType) return 0;
  return discountType === "fixed" /* fixed */ ? discountAmount ?? 0 : subTotal * (discountPercent ?? 0) / 100;
};
var getInvoiceItemLevelTaxDiscount = (data) => {
  const {
    unitPrice,
    quantity,
    taxRate,
    taxType,
    invoiceItems,
    discountType,
    discountAmount = 0,
    discountPercent = 0
  } = data;
  const unitTotal = unitPrice * quantity;
  let discount = 0;
  const subTotal = invoiceItems.reduce((sum, item) => {
    return sum + Number(item.invoiceItemSnapshot.unitPriceCents) * Number(item.quantity);
  }, 0) ?? 0;
  const totalDiscount = calcDiscount({ subTotal, discountType, discountAmount, discountPercent });
  if (subTotal > 0 && totalDiscount > 0) {
    discount = Math.round(unitTotal / subTotal * totalDiscount);
  }
  const taxableAmount = unitTotal - discount;
  const tax = calcTax(taxableAmount, taxRate, taxType);
  return { tax, discount };
};
var getInvoiceItemTotal = (data) => {
  const {
    unitPrice,
    quantity,
    includeTax = true,
    taxRate,
    taxType,
    invoiceItems,
    discountType,
    discountAmount = 0,
    discountPercent = 0
  } = data;
  const unitTotal = unitPrice * quantity;
  let discount = 0;
  const subTotal = invoiceItems.reduce((sum, item) => {
    return sum + Number(item.invoiceItemSnapshot.unitPriceCents) * Number(item.quantity);
  }, 0) ?? 0;
  const totalDiscount = calcDiscount({ subTotal, discountType, discountAmount, discountPercent });
  if (subTotal > 0 && totalDiscount > 0) {
    discount = Math.round(unitTotal / subTotal * totalDiscount);
  }
  const taxableAmount = unitTotal - discount;
  const tax = includeTax ? calcTax(taxableAmount, taxRate, taxType) : 0;
  return taxType === "inclusive" /* inclusive */ ? unitTotal - discount : unitTotal - discount + tax;
};
var getPaidAmount = (invoicePayments) => {
  return invoicePayments.reduce((sum, p) => sum + Number(p.amountCents), 0) ?? 0;
};
var createCurrencyFormatter = (data) => {
  const { storeSettings, currencySymbol, currencyCode, currencyFormat } = data;
  const supports = supportsCurrencySubunit(data);
  return (amount) => supports ? getFormattedCurrency({
    amount,
    amountFormat: storeSettings.amountFormat,
    format: currencyFormat,
    symbol: currencySymbol,
    code: currencyCode
  }) : formatAmount(amount, storeSettings.amountFormat);
};
var supportsCurrencySubunit = (data) => {
  const { storeSettings, currencySymbol, currencyCode, currencySubunit, currencyFormat } = data;
  return Boolean(
    storeSettings && currencySymbol !== void 0 && currencyCode !== void 0 && currencySubunit !== void 0 && currencyFormat !== void 0
  );
};
var getFinancialData = (data) => {
  const {
    storeSettings,
    currencySymbol,
    currencyCode,
    currencySubunit,
    currencyFormat,
    invoiceItems,
    discountType,
    discountAmount = 0,
    discountPercent = 0,
    shippingAmount = 0,
    surchargeAmount = 0,
    surchargeType,
    surchargePercent,
    taxRate,
    taxType,
    invoicePayments
  } = data;
  const supportsSubunit = supportsCurrencySubunit({
    storeSettings,
    currencySymbol,
    currencyCode,
    currencySubunit,
    currencyFormat
  });
  const format2 = createCurrencyFormatter({
    storeSettings,
    currencySymbol,
    currencyCode,
    currencySubunit,
    currencyFormat
  });
  let isInclusive = false;
  let subTotalAmount = 0;
  let totalItemTaxAmount = 0;
  invoiceItems?.forEach((item) => {
    const subTotal = getInvoiceItemTotal({
      taxRate: item.taxRate,
      unitPrice: Number(item.invoiceItemSnapshot.unitPriceCents),
      quantity: Number(item.quantity),
      taxType: item.taxType,
      includeTax: false,
      invoiceItems
    });
    const { tax: itemLevelTax } = getInvoiceItemLevelTaxDiscount({
      taxRate: item.taxRate,
      unitPrice: Number(item.invoiceItemSnapshot.unitPriceCents),
      quantity: Number(item.quantity),
      taxType: item.taxType,
      invoiceItems,
      discountType,
      discountAmount,
      discountPercent
    });
    totalItemTaxAmount += itemLevelTax;
    subTotalAmount += subTotal;
    if (item.taxType === "inclusive" /* inclusive */) {
      isInclusive = true;
    }
  });
  if (!isInclusive && taxType === "inclusive" /* inclusive */) {
    isInclusive = true;
  }
  const calculatedDiscountAmount = calcDiscount({
    subTotal: subTotalAmount,
    discountAmount,
    discountPercent,
    discountType
  });
  const totalAmountAfterDiscount = subTotalAmount - calculatedDiscountAmount;
  const calculatedSurchargeAmount = calcSurcharge({
    subTotal: totalAmountAfterDiscount,
    surchargeAmount,
    surchargePercent,
    surchargeType
  });
  const invoiceLevelTax = calcTax(totalAmountAfterDiscount, taxRate, taxType);
  const taxTotalAmount = totalItemTaxAmount + invoiceLevelTax;
  let totalAmount = totalAmountAfterDiscount + shippingAmount + calculatedSurchargeAmount;
  if (!isInclusive) {
    totalAmount += taxTotalAmount;
  }
  const paidAmount = getPaidAmount(invoicePayments);
  const balanceDue = totalAmount - paidAmount;
  const finalShippingAmount = calcUnitPrice({
    supportsSubunit,
    amountCents: shippingAmount,
    subunit: currencySubunit
  });
  const finalSubTotalAmount = calcUnitPrice({
    supportsSubunit,
    amountCents: subTotalAmount,
    subunit: currencySubunit
  });
  const finalTaxTotalAmount = calcUnitPrice({
    supportsSubunit,
    amountCents: taxTotalAmount,
    subunit: currencySubunit
  });
  const finalDiscountAmount = calcUnitPrice({
    supportsSubunit,
    amountCents: calculatedDiscountAmount,
    subunit: currencySubunit
  });
  const finalSurchargeAmount = calcUnitPrice({
    supportsSubunit,
    amountCents: calculatedSurchargeAmount,
    subunit: currencySubunit
  });
  const finalTotalAmount = calcUnitPrice({
    supportsSubunit,
    amountCents: totalAmount,
    subunit: currencySubunit
  });
  const finalPaidAmount = calcUnitPrice({
    supportsSubunit,
    amountCents: paidAmount,
    subunit: currencySubunit
  });
  const finalBalanceDue = calcUnitPrice({
    supportsSubunit,
    amountCents: balanceDue,
    subunit: currencySubunit
  });
  return {
    formattedSubTotalAmount: format2(finalSubTotalAmount),
    formattedTotalTaxAmount: format2(finalTaxTotalAmount),
    discountAmountFormatted: format2(finalDiscountAmount),
    shippingAmountFormatted: format2(finalShippingAmount),
    surchargeAmountFormatted: format2(finalSurchargeAmount),
    totalAmountFormatted: format2(finalTotalAmount),
    totalAmountPaidFormatted: format2(finalPaidAmount),
    balanceDueFormatted: format2(finalBalanceDue),
    subTotalAmount: finalSubTotalAmount,
    totalTax: finalTaxTotalAmount,
    discountAmount: finalDiscountAmount,
    shippingAmount: finalShippingAmount,
    surchargeAmount: finalSurchargeAmount,
    totalAmount: finalTotalAmount,
    totalAmountPaid: finalPaidAmount,
    balanceDue: finalBalanceDue
  };
};
var getItemFinancialData = (data) => {
  const {
    storeSettings,
    currencySymbol,
    currencyCode,
    currencySubunit,
    currencyFormat,
    unitPrice,
    discountType,
    discountAmount = 0,
    discountPercent = 0,
    quantity,
    taxType,
    taxRate,
    invoiceItems
  } = data;
  const supportsSubunit = supportsCurrencySubunit({
    storeSettings,
    currencySymbol,
    currencyCode,
    currencySubunit,
    currencyFormat
  });
  const format2 = createCurrencyFormatter({
    storeSettings,
    currencySymbol,
    currencyCode,
    currencySubunit,
    currencyFormat
  });
  const totalUnitPrice = unitPrice * quantity;
  const { tax: itemLevelTax, discount: itemLevelDiscount } = getInvoiceItemLevelTaxDiscount({
    taxRate,
    unitPrice,
    quantity,
    taxType,
    invoiceItems,
    discountType,
    discountAmount,
    discountPercent
  });
  const finalUnitPriceTotal = calcUnitPrice({
    supportsSubunit,
    amountCents: totalUnitPrice,
    subunit: currencySubunit
  });
  const finalUnitPrice = calcUnitPrice({
    supportsSubunit,
    amountCents: unitPrice,
    subunit: currencySubunit
  });
  const finalItemTax = calcUnitPrice({
    supportsSubunit,
    amountCents: itemLevelTax,
    subunit: currencySubunit
  });
  const finalItemDiscount = calcUnitPrice({
    supportsSubunit,
    amountCents: itemLevelDiscount,
    subunit: currencySubunit
  });
  return {
    formattedUnitPrice: format2(finalUnitPrice),
    formattedTotal: format2(finalUnitPriceTotal),
    formattedTax: format2(finalItemTax),
    formattedItemDiscountAmount: format2(finalItemDiscount),
    unitPrice: finalUnitPrice,
    totalUnitPrice: finalUnitPriceTotal,
    invoiceTaxAmount: finalItemTax,
    itemDiscountAmount: finalItemDiscount
  };
};

// .patch-work/upstream/apps/renderer/src/pages/invoices/Preview/FinancialInfo.tsx
import { jsx, jsxs } from "react/jsx-runtime";
var FinancialInfoComponent = ({ invoiceForm, storeSettings, labels, align = "end" }) => {
  const financialTextAlign = {
    textAlign: align === "start" ? "left" : align === "center" ? "center" : "right"
  };
  const financialValueAlign = align === "end" ? PDF_STYLES.alignEnd : PDF_STYLES.alignStart;
  const {
    formattedTotalTaxAmount,
    formattedSubTotalAmount,
    totalAmountFormatted,
    discountAmountFormatted,
    shippingAmountFormatted,
    surchargeAmountFormatted,
    totalAmountPaidFormatted,
    balanceDueFormatted,
    shippingAmount,
    surchargeAmount,
    discountAmount,
    totalTax,
    totalAmountPaid
  } = useMemo(
    () => getFinancialData({
      storeSettings,
      currencySymbol: invoiceForm?.invoiceCurrencySnapshot?.currencySymbol,
      currencyCode: invoiceForm?.invoiceCurrencySnapshot?.currencyCode,
      currencySubunit: invoiceForm?.invoiceCurrencySnapshot?.currencySubunit ?? 0,
      currencyFormat: invoiceForm?.currencyFormat,
      invoiceItems: invoiceForm?.invoiceItems ?? [],
      discountType: invoiceForm?.discountType,
      discountAmount: Number(invoiceForm?.discountAmountCents ?? 0),
      discountPercent: invoiceForm?.discountPercent,
      taxRate: invoiceForm?.taxRate ?? 0,
      shippingAmount: Number(invoiceForm?.shippingFeeCents ?? 0),
      surchargeType: invoiceForm?.surchargeType,
      surchargeAmount: Number(invoiceForm?.surchargeAmountCents ?? 0),
      surchargePercent: invoiceForm?.surchargePercent,
      taxType: invoiceForm?.taxType,
      invoicePayments: invoiceForm?.invoicePayments ?? []
    }),
    [storeSettings, invoiceForm]
  );
  const {
    subTotalLabel,
    discountLabel,
    surchargeLabel,
    incLabel,
    taxLabel,
    taxExclusivePerItemLabel,
    taxInclusivePerItemLabel,
    shippingFeeLabel,
    totalLabel,
    paidLabel,
    balanceDueLabel
  } = labels;
  const hasPerItemTaxExclusive = useMemo(
    () => invoiceForm?.invoiceItems?.some((item) => item.taxType === "exclusive" /* exclusive */),
    [invoiceForm]
  );
  const hasPerItemTaxInclusive = useMemo(
    () => invoiceForm?.invoiceItems?.some((item) => item.taxType === "inclusive" /* inclusive */),
    [invoiceForm]
  );
  return /* @__PURE__ */ jsxs(View, { style: PDF_STYLES.w50, children: [
    (discountAmount > 0 || Math.abs(totalTax) > 0 || shippingAmount > 0 || surchargeAmount > 0) && /* @__PURE__ */ jsxs(View, { style: [PDF_STYLES.row, PDF_STYLES.pb5], children: [
      /* @__PURE__ */ jsx(View, { style: PDF_STYLES.flexGrow }),
      /* @__PURE__ */ jsxs(View, { style: [PDF_STYLES.row, PDF_STYLES.w100, financialTextAlign], children: [
        /* @__PURE__ */ jsx(
          View,
          {
            style: [
              PDF_STYLES.regularBold,
              PDF_STYLES.w50,
              {
                fontSize: FONT_SIZES[invoiceForm?.invoiceCustomization?.fontSize ?? DEFAULT_FONT_SIZES].regularBold
              }
            ],
            children: /* @__PURE__ */ jsx(Text, { children: subTotalLabel })
          }
        ),
        /* @__PURE__ */ jsx(
          View,
          {
            style: [
              PDF_STYLES.regularBold,
              PDF_STYLES.w50,
              financialValueAlign,
              {
                fontSize: FONT_SIZES[invoiceForm?.invoiceCustomization?.fontSize ?? DEFAULT_FONT_SIZES].regularBold
              }
            ],
            children: /* @__PURE__ */ jsx(Text, { children: formattedSubTotalAmount })
          }
        )
      ] })
    ] }),
    discountAmount > 0 && /* @__PURE__ */ jsxs(View, { style: [PDF_STYLES.row, PDF_STYLES.pb5], children: [
      /* @__PURE__ */ jsx(View, { style: PDF_STYLES.flexGrow }),
      /* @__PURE__ */ jsxs(View, { style: [PDF_STYLES.row, PDF_STYLES.w100, financialTextAlign], children: [
        /* @__PURE__ */ jsx(
          View,
          {
            style: [
              PDF_STYLES.regular,
              PDF_STYLES.w50,
              {
                fontSize: FONT_SIZES[invoiceForm?.invoiceCustomization?.fontSize ?? DEFAULT_FONT_SIZES].regular
              }
            ],
            children: /* @__PURE__ */ jsxs(Text, { children: [
              invoiceForm?.discountType === "percentage" /* percentage */ && `${discountLabel} (${invoiceForm?.discountPercent}%)`,
              invoiceForm?.discountType !== "percentage" /* percentage */ && discountLabel
            ] })
          }
        ),
        /* @__PURE__ */ jsx(
          View,
          {
            style: [
              PDF_STYLES.regular,
              PDF_STYLES.w50,
              financialValueAlign,
              {
                fontSize: FONT_SIZES[invoiceForm?.invoiceCustomization?.fontSize ?? DEFAULT_FONT_SIZES].regular
              }
            ],
            children: /* @__PURE__ */ jsx(Text, { children: discountAmountFormatted })
          }
        )
      ] })
    ] }),
    Math.abs(totalTax) > 0 && /* @__PURE__ */ jsxs(View, { style: [PDF_STYLES.row, PDF_STYLES.pb5], children: [
      /* @__PURE__ */ jsx(View, { style: PDF_STYLES.flexGrow }),
      /* @__PURE__ */ jsxs(View, { style: [PDF_STYLES.row, PDF_STYLES.w100, financialTextAlign], children: [
        /* @__PURE__ */ jsx(
          View,
          {
            style: [
              PDF_STYLES.regular,
              PDF_STYLES.w50,
              {
                fontSize: FONT_SIZES[invoiceForm?.invoiceCustomization?.fontSize ?? DEFAULT_FONT_SIZES].regular
              }
            ],
            children: /* @__PURE__ */ jsxs(Text, { children: [
              (invoiceForm?.taxType === "deducted" /* deducted */ || invoiceForm?.taxType === "exclusive" /* exclusive */) && (invoiceForm.taxName ? `${invoiceForm?.taxName} (${invoiceForm?.taxRate}%)` : `${taxLabel} (${invoiceForm?.taxRate ?? 0}%)`),
              invoiceForm?.taxType === "inclusive" /* inclusive */ && (invoiceForm.taxName ? `${invoiceForm?.taxName} (${incLabel} ${invoiceForm?.taxRate}%)` : `${taxLabel} (${incLabel} ${invoiceForm?.taxRate}%)`),
              hasPerItemTaxExclusive && taxExclusivePerItemLabel,
              hasPerItemTaxInclusive && taxInclusivePerItemLabel,
              !hasPerItemTaxExclusive && !hasPerItemTaxInclusive && !invoiceForm?.taxType && `${taxLabel} (${invoiceForm?.taxRate ?? 0}%)`
            ] })
          }
        ),
        /* @__PURE__ */ jsx(
          View,
          {
            style: [
              PDF_STYLES.regular,
              PDF_STYLES.w50,
              financialValueAlign,
              {
                fontSize: FONT_SIZES[invoiceForm?.invoiceCustomization?.fontSize ?? DEFAULT_FONT_SIZES].regular
              }
            ],
            children: /* @__PURE__ */ jsx(Text, { children: formattedTotalTaxAmount })
          }
        )
      ] })
    ] }),
    shippingAmount > 0 && /* @__PURE__ */ jsxs(View, { style: [PDF_STYLES.row, PDF_STYLES.pb5], children: [
      /* @__PURE__ */ jsx(View, { style: PDF_STYLES.flexGrow }),
      /* @__PURE__ */ jsxs(View, { style: [PDF_STYLES.row, PDF_STYLES.w100, financialTextAlign], children: [
        /* @__PURE__ */ jsx(
          View,
          {
            style: [
              PDF_STYLES.regular,
              PDF_STYLES.w50,
              {
                fontSize: FONT_SIZES[invoiceForm?.invoiceCustomization?.fontSize ?? DEFAULT_FONT_SIZES].regular
              }
            ],
            children: /* @__PURE__ */ jsx(Text, { children: shippingFeeLabel })
          }
        ),
        /* @__PURE__ */ jsx(
          View,
          {
            style: [
              PDF_STYLES.regular,
              PDF_STYLES.w50,
              financialValueAlign,
              {
                fontSize: FONT_SIZES[invoiceForm?.invoiceCustomization?.fontSize ?? DEFAULT_FONT_SIZES].regular
              }
            ],
            children: /* @__PURE__ */ jsx(Text, { children: shippingAmountFormatted })
          }
        )
      ] })
    ] }),
    surchargeAmount > 0 && /* @__PURE__ */ jsxs(View, { style: [PDF_STYLES.row, PDF_STYLES.pb5], children: [
      /* @__PURE__ */ jsx(View, { style: PDF_STYLES.flexGrow }),
      /* @__PURE__ */ jsxs(View, { style: [PDF_STYLES.row, PDF_STYLES.w100, financialTextAlign], children: [
        /* @__PURE__ */ jsx(
          View,
          {
            style: [
              PDF_STYLES.regular,
              PDF_STYLES.w50,
              {
                fontSize: FONT_SIZES[invoiceForm?.invoiceCustomization?.fontSize ?? DEFAULT_FONT_SIZES].regular
              }
            ],
            children: /* @__PURE__ */ jsxs(Text, { children: [
              invoiceForm?.surchargeType === "percentage" /* percentage */ && `${surchargeLabel} (${invoiceForm?.surchargePercent}%)`,
              invoiceForm?.surchargeType !== "percentage" /* percentage */ && surchargeLabel
            ] })
          }
        ),
        /* @__PURE__ */ jsx(
          View,
          {
            style: [
              PDF_STYLES.regular,
              PDF_STYLES.w50,
              financialValueAlign,
              {
                fontSize: FONT_SIZES[invoiceForm?.invoiceCustomization?.fontSize ?? DEFAULT_FONT_SIZES].regular
              }
            ],
            children: /* @__PURE__ */ jsx(Text, { children: surchargeAmountFormatted })
          }
        )
      ] })
    ] }),
    (discountAmount > 0 || Math.abs(totalTax) > 0 || shippingAmount > 0 || surchargeAmount > 0) && /* @__PURE__ */ jsxs(View, { style: [PDF_STYLES.row, PDF_STYLES.pt5, PDF_STYLES.pb5], children: [
      /* @__PURE__ */ jsx(View, { style: PDF_STYLES.flexGrow }),
      /* @__PURE__ */ jsx(View, { style: [PDF_STYLES.border, PDF_STYLES.w100, financialTextAlign] })
    ] }),
    (totalAmountPaid > 0 || invoiceForm?.status === "paid" /* paid */ || invoiceForm?.invoiceType === "quotation" /* quotation */) && /* @__PURE__ */ jsxs(View, { style: [PDF_STYLES.row, PDF_STYLES.pb5], children: [
      /* @__PURE__ */ jsx(View, { style: PDF_STYLES.flexGrow }),
      /* @__PURE__ */ jsxs(View, { style: [PDF_STYLES.row, PDF_STYLES.w100, financialTextAlign], children: [
        /* @__PURE__ */ jsx(
          View,
          {
            style: [
              PDF_STYLES.regularBold,
              PDF_STYLES.w50,
              {
                fontSize: FONT_SIZES[invoiceForm?.invoiceCustomization?.fontSize ?? DEFAULT_FONT_SIZES].regularBold
              }
            ],
            children: /* @__PURE__ */ jsx(Text, { children: totalLabel })
          }
        ),
        /* @__PURE__ */ jsx(
          View,
          {
            style: [
              PDF_STYLES.regularBold,
              PDF_STYLES.w50,
              financialValueAlign,
              { fontSize: FONT_SIZES[invoiceForm?.invoiceCustomization?.fontSize ?? DEFAULT_FONT_SIZES].regularBold }
            ],
            children: /* @__PURE__ */ jsx(Text, { children: totalAmountFormatted })
          }
        )
      ] })
    ] }),
    totalAmountPaid > 0 && invoiceForm?.invoiceType === "invoice" /* invoice */ && invoiceForm?.status !== "paid" /* paid */ && /* @__PURE__ */ jsxs(View, { style: [PDF_STYLES.row, PDF_STYLES.pb5], children: [
      /* @__PURE__ */ jsx(View, { style: PDF_STYLES.flexGrow }),
      /* @__PURE__ */ jsxs(View, { style: [PDF_STYLES.row, PDF_STYLES.w100, financialTextAlign], children: [
        /* @__PURE__ */ jsx(
          View,
          {
            style: [
              PDF_STYLES.regular,
              PDF_STYLES.w50,
              { fontSize: FONT_SIZES[invoiceForm?.invoiceCustomization?.fontSize ?? DEFAULT_FONT_SIZES].regular }
            ],
            children: /* @__PURE__ */ jsx(Text, { children: paidLabel })
          }
        ),
        /* @__PURE__ */ jsx(
          View,
          {
            style: [
              PDF_STYLES.regular,
              PDF_STYLES.w50,
              financialValueAlign,
              { fontSize: FONT_SIZES[invoiceForm?.invoiceCustomization?.fontSize ?? DEFAULT_FONT_SIZES].regular }
            ],
            children: /* @__PURE__ */ jsx(Text, { children: totalAmountPaidFormatted })
          }
        )
      ] })
    ] }),
    invoiceForm?.invoiceType === "invoice" /* invoice */ && invoiceForm?.status !== "paid" /* paid */ && /* @__PURE__ */ jsxs(View, { style: [PDF_STYLES.row, PDF_STYLES.pb5], children: [
      /* @__PURE__ */ jsx(View, { style: PDF_STYLES.flexGrow }),
      /* @__PURE__ */ jsxs(View, { style: [PDF_STYLES.row, PDF_STYLES.w100, financialTextAlign], children: [
        /* @__PURE__ */ jsx(
          View,
          {
            style: [
              PDF_STYLES.regularBold,
              PDF_STYLES.w50,
              { fontSize: FONT_SIZES[invoiceForm?.invoiceCustomization?.fontSize ?? DEFAULT_FONT_SIZES].regularBold }
            ],
            children: /* @__PURE__ */ jsx(Text, { children: balanceDueLabel })
          }
        ),
        /* @__PURE__ */ jsx(
          View,
          {
            style: [
              PDF_STYLES.regularBold,
              PDF_STYLES.w50,
              financialValueAlign,
              {
                color: invoiceForm?.invoiceCustomization?.color,
                fontSize: FONT_SIZES[invoiceForm?.invoiceCustomization?.fontSize ?? DEFAULT_FONT_SIZES].regularBold
              }
            ],
            children: /* @__PURE__ */ jsx(Text, { children: balanceDueFormatted })
          }
        )
      ] })
    ] })
  ] });
};
var FinancialInfo = memo(FinancialInfoComponent);

// .patch-work/upstream/apps/renderer/src/pages/invoices/Preview/HeaderInfo.tsx
import { View as View6 } from "@react-pdf/renderer";
import { memo as memo9 } from "react";

// .patch-work/upstream/apps/renderer/src/pages/invoices/Preview/BusinessInfo.tsx
import { Text as Text2, View as View2 } from "@react-pdf/renderer";
import { memo as memo2 } from "react";
import { jsx as jsx2, jsxs as jsxs2 } from "react/jsx-runtime";
var BusinessInfoComponent = ({ invoiceForm }) => {
  return /* @__PURE__ */ jsxs2(View2, { style: [PDF_STYLES.gap4, PDF_STYLES.alignStart], children: [
    /* @__PURE__ */ jsx2(
      Text2,
      {
        style: [
          PDF_STYLES.business,
          { fontSize: FONT_SIZES[invoiceForm?.invoiceCustomization?.fontSize ?? DEFAULT_FONT_SIZES].business }
        ],
        children: invoiceForm?.invoiceBusinessSnapshot?.businessName
      }
    ),
    invoiceForm?.invoiceBusinessSnapshot?.businessRole && /* @__PURE__ */ jsx2(
      Text2,
      {
        style: [
          PDF_STYLES.businessText,
          { fontSize: FONT_SIZES[invoiceForm?.invoiceCustomization?.fontSize ?? DEFAULT_FONT_SIZES].businessText }
        ],
        children: invoiceForm?.invoiceBusinessSnapshot?.businessRole
      }
    ),
    invoiceForm?.invoiceBusinessSnapshot?.businessAddress && /* @__PURE__ */ jsx2(
      Text2,
      {
        style: [
          PDF_STYLES.businessText,
          {
            fontSize: FONT_SIZES[invoiceForm?.invoiceCustomization?.fontSize ?? DEFAULT_FONT_SIZES].businessText
          }
        ],
        children: invoiceForm?.invoiceBusinessSnapshot?.businessAddress
      }
    ),
    invoiceForm?.invoiceBusinessSnapshot?.businessEmail && /* @__PURE__ */ jsx2(
      Text2,
      {
        style: [
          PDF_STYLES.businessText,
          {
            fontSize: FONT_SIZES[invoiceForm?.invoiceCustomization?.fontSize ?? DEFAULT_FONT_SIZES].businessText
          }
        ],
        children: invoiceForm?.invoiceBusinessSnapshot?.businessEmail
      }
    ),
    invoiceForm?.invoiceBusinessSnapshot?.businessPhone && /* @__PURE__ */ jsx2(
      Text2,
      {
        style: [
          PDF_STYLES.businessText,
          {
            fontSize: FONT_SIZES[invoiceForm?.invoiceCustomization?.fontSize ?? DEFAULT_FONT_SIZES].businessText
          }
        ],
        children: invoiceForm?.invoiceBusinessSnapshot?.businessPhone
      }
    ),
    invoiceForm?.invoiceBusinessSnapshot?.businessCode && /* @__PURE__ */ jsx2(
      Text2,
      {
        style: [
          PDF_STYLES.businessText,
          {
            fontSize: FONT_SIZES[invoiceForm?.invoiceCustomization?.fontSize ?? DEFAULT_FONT_SIZES].businessText
          }
        ],
        children: invoiceForm?.invoiceBusinessSnapshot?.businessCode
      }
    ),
    invoiceForm?.invoiceBusinessSnapshot?.businessVatCode && /* @__PURE__ */ jsx2(
      Text2,
      {
        style: [
          PDF_STYLES.businessText,
          {
            fontSize: FONT_SIZES[invoiceForm?.invoiceCustomization?.fontSize ?? DEFAULT_FONT_SIZES].businessText
          }
        ],
        children: invoiceForm?.invoiceBusinessSnapshot?.businessVatCode
      }
    ),
    invoiceForm?.invoiceBusinessSnapshot?.businessAdditional && /* @__PURE__ */ jsx2(
      Text2,
      {
        style: [
          PDF_STYLES.businessText,
          {
            fontSize: FONT_SIZES[invoiceForm?.invoiceCustomization?.fontSize ?? DEFAULT_FONT_SIZES].businessText
          }
        ],
        children: invoiceForm?.invoiceBusinessSnapshot?.businessAdditional
      }
    )
  ] });
};
var BusinessInfo = memo2(BusinessInfoComponent);

// .patch-work/upstream/apps/renderer/src/pages/invoices/Preview/ClientInfo.tsx
import { Text as Text3, View as View3 } from "@react-pdf/renderer";
import { memo as memo3 } from "react";
import { jsx as jsx3, jsxs as jsxs3 } from "react/jsx-runtime";
var ClientInfoComponent = ({ invoiceForm, billToLabel }) => {
  return /* @__PURE__ */ jsxs3(View3, { style: [PDF_STYLES.alignStart, PDF_STYLES.gap4], children: [
    /* @__PURE__ */ jsxs3(
      Text3,
      {
        style: [
          PDF_STYLES.regularBold,
          { fontSize: FONT_SIZES[invoiceForm?.invoiceCustomization?.fontSize ?? DEFAULT_FONT_SIZES].regularBold }
        ],
        children: [
          billToLabel,
          ":"
        ]
      }
    ),
    /* @__PURE__ */ jsx3(
      Text3,
      {
        style: [
          PDF_STYLES.businessText,
          { fontSize: FONT_SIZES[invoiceForm?.invoiceCustomization?.fontSize ?? DEFAULT_FONT_SIZES].businessText }
        ],
        children: invoiceForm?.invoiceClientSnapshot?.clientName
      }
    ),
    invoiceForm?.invoiceClientSnapshot?.clientAddress && /* @__PURE__ */ jsx3(
      Text3,
      {
        style: [
          PDF_STYLES.businessText,
          { fontSize: FONT_SIZES[invoiceForm?.invoiceCustomization?.fontSize ?? DEFAULT_FONT_SIZES].businessText }
        ],
        children: invoiceForm?.invoiceClientSnapshot?.clientAddress
      }
    ),
    invoiceForm?.invoiceClientSnapshot?.clientEmail && /* @__PURE__ */ jsx3(
      Text3,
      {
        style: [
          PDF_STYLES.businessText,
          { fontSize: FONT_SIZES[invoiceForm?.invoiceCustomization?.fontSize ?? DEFAULT_FONT_SIZES].businessText }
        ],
        children: invoiceForm?.invoiceClientSnapshot?.clientEmail
      }
    ),
    invoiceForm?.invoiceClientSnapshot?.clientPhone && /* @__PURE__ */ jsx3(
      Text3,
      {
        style: [
          PDF_STYLES.businessText,
          { fontSize: FONT_SIZES[invoiceForm?.invoiceCustomization?.fontSize ?? DEFAULT_FONT_SIZES].businessText }
        ],
        children: invoiceForm?.invoiceClientSnapshot?.clientPhone
      }
    ),
    invoiceForm?.invoiceClientSnapshot?.clientCode && /* @__PURE__ */ jsx3(
      Text3,
      {
        style: [
          PDF_STYLES.businessText,
          { fontSize: FONT_SIZES[invoiceForm?.invoiceCustomization?.fontSize ?? DEFAULT_FONT_SIZES].businessText }
        ],
        children: invoiceForm?.invoiceClientSnapshot?.clientCode
      }
    ),
    invoiceForm?.invoiceClientSnapshot?.clientVatCode && /* @__PURE__ */ jsx3(
      Text3,
      {
        style: [
          PDF_STYLES.businessText,
          { fontSize: FONT_SIZES[invoiceForm?.invoiceCustomization?.fontSize ?? DEFAULT_FONT_SIZES].businessText }
        ],
        children: invoiceForm?.invoiceClientSnapshot?.clientVatCode
      }
    ),
    invoiceForm?.invoiceClientSnapshot?.clientAdditional && /* @__PURE__ */ jsx3(
      Text3,
      {
        style: [
          PDF_STYLES.businessText,
          { fontSize: FONT_SIZES[invoiceForm?.invoiceCustomization?.fontSize ?? DEFAULT_FONT_SIZES].businessText }
        ],
        children: invoiceForm?.invoiceClientSnapshot?.clientAdditional
      }
    )
  ] });
};
var ClientInfo = memo3(ClientInfoComponent);

// .patch-work/upstream/apps/renderer/src/pages/invoices/Preview/InvoiceInformationInfo.tsx
import { Text as Text5, View as View4 } from "@react-pdf/renderer";
import { memo as memo5 } from "react";

// .patch-work/upstream/apps/renderer/src/pages/invoices/Preview/TitleInfo.tsx
import { Text as Text4 } from "@react-pdf/renderer";
import { memo as memo4 } from "react";
import { jsx as jsx4 } from "react/jsx-runtime";
var TitleInfoComponent = ({ invoiceForm, labels }) => {
  const { pdfINVOICELabel, pdfQUOTELabel } = labels;
  return /* @__PURE__ */ jsx4(
    Text4,
    {
      style: [
        PDF_STYLES.title,
        {
          color: invoiceForm?.invoiceCustomization?.color,
          fontSize: FONT_SIZES[invoiceForm?.invoiceCustomization?.fontSize ?? DEFAULT_FONT_SIZES].title
        }
      ],
      children: invoiceForm?.invoiceType === "invoice" /* invoice */ ? pdfINVOICELabel : pdfQUOTELabel
    }
  );
};
var TitleInfo = memo4(TitleInfoComponent);

// .patch-work/upstream/apps/renderer/src/pages/invoices/Preview/InvoiceInformationInfo.tsx
import { jsx as jsx5, jsxs as jsxs4 } from "react/jsx-runtime";
var InvoiceInformationInfoComponent = ({
  invoiceForm,
  storeSettings,
  labels,
  showTitle,
  showInvoiceLabel
}) => {
  const { invoiceNoLabel, quoteNoLabel, dueDateLabel, dateLabel, pdfQUOTELabel, pdfINVOICELabel } = labels;
  const fontSize = invoiceForm?.invoiceCustomization?.fontSize ?? DEFAULT_FONT_SIZES;
  const invoiceMetaRowStyle = fontSize === "large" /* large */ || fontSize === "medium" /* medium */ ? PDF_STYLES.invoiceMetaRowWrap : PDF_STYLES.invoiceMetaRow;
  return /* @__PURE__ */ jsxs4(View4, { style: [PDF_STYLES.invoiceMeta, PDF_STYLES.alignEnd, PDF_STYLES.gap4], children: [
    showTitle && /* @__PURE__ */ jsx5(
      TitleInfo,
      {
        invoiceForm,
        labels: {
          pdfINVOICELabel,
          pdfQUOTELabel
        }
      }
    ),
    /* @__PURE__ */ jsxs4(View4, { style: [PDF_STYLES.invoiceMeta, PDF_STYLES.gap3, PDF_STYLES.alignEnd], children: [
      /* @__PURE__ */ jsxs4(View4, { style: invoiceMetaRowStyle, children: [
        showInvoiceLabel && /* @__PURE__ */ jsxs4(Text5, { style: [PDF_STYLES.regularBold, { fontSize: FONT_SIZES[fontSize].regularBold }], children: [
          invoiceForm?.invoiceType === "invoice" /* invoice */ ? invoiceNoLabel : quoteNoLabel,
          ":",
          " "
        ] }),
        /* @__PURE__ */ jsxs4(Text5, { style: [PDF_STYLES.regular, PDF_STYLES.invoiceMetaValue, { fontSize: FONT_SIZES[fontSize].regular }], children: [
          invoiceForm?.invoicePrefix,
          invoiceForm?.invoiceNumber,
          invoiceForm?.invoiceSuffix
        ] })
      ] }),
      storeSettings && invoiceForm?.issuedAt && /* @__PURE__ */ jsxs4(View4, { style: invoiceMetaRowStyle, children: [
        /* @__PURE__ */ jsxs4(Text5, { style: [PDF_STYLES.regularBold, { fontSize: FONT_SIZES[fontSize].regularBold }], children: [
          dateLabel,
          ": "
        ] }),
        /* @__PURE__ */ jsx5(Text5, { style: [PDF_STYLES.regular, PDF_STYLES.invoiceMetaValue, { fontSize: FONT_SIZES[fontSize].regular }], children: formatDate(invoiceForm.issuedAt, storeSettings.dateFormat) })
      ] }),
      storeSettings && invoiceForm?.dueDate && /* @__PURE__ */ jsxs4(View4, { style: invoiceMetaRowStyle, children: [
        /* @__PURE__ */ jsxs4(Text5, { style: [PDF_STYLES.regularBold, { fontSize: FONT_SIZES[fontSize].regularBold }], children: [
          dueDateLabel,
          ":",
          " "
        ] }),
        /* @__PURE__ */ jsx5(Text5, { style: [PDF_STYLES.regular, PDF_STYLES.invoiceMetaValue, { fontSize: FONT_SIZES[fontSize].regular }], children: formatDate(invoiceForm.dueDate, storeSettings.dateFormat) })
      ] })
    ] })
  ] });
};
var InvoiceInformationInfo = memo5(InvoiceInformationInfoComponent);

// .patch-work/upstream/apps/renderer/src/pages/invoices/Preview/LogoInfo.tsx
import { Image } from "@react-pdf/renderer";
import { memo as memo6 } from "react";
import { jsx as jsx6 } from "react/jsx-runtime";
var LogoInfoComponent = ({ invoiceForm, logoUrl }) => {
  if (!logoUrl) return null;
  if (!invoiceForm?.invoiceBusinessSnapshot?.businessLogo) return null;
  return /* @__PURE__ */ jsx6(
    Image,
    {
      style: [{ ...LOGO_SIZES[invoiceForm?.invoiceCustomization?.logoSize ?? DEFAULT_LOGO_SIZES] }],
      src: logoUrl
    }
  );
};
var LogoInfo = memo6(LogoInfoComponent);

// .patch-work/upstream/apps/renderer/src/pages/invoices/Preview/PaymentInfo.tsx
import { Text as Text6, View as View5 } from "@react-pdf/renderer";
import { memo as memo8 } from "react";

// .patch-work/upstream/apps/renderer/src/pages/invoices/Preview/QRCodeInfo.tsx
import { Image as Image2 } from "@react-pdf/renderer";
import { memo as memo7 } from "react";
import { jsx as jsx7 } from "react/jsx-runtime";
var QRCodeInfoComponent = ({ invoiceForm, qrCodeUrl }) => {
  if (!qrCodeUrl) return null;
  if (!invoiceForm?.invoiceBankSnapshot?.qrCode) return null;
  return /* @__PURE__ */ jsx7(Image2, { style: [{ width: 64, height: 64 }], src: qrCodeUrl });
};
var QRCodeInfo = memo7(QRCodeInfoComponent);

// .patch-work/upstream/apps/renderer/src/pages/invoices/Preview/PaymentInfo.tsx
import { jsx as jsx8, jsxs as jsxs5 } from "react/jsx-runtime";
var PaymentInfoComponent = ({ invoiceForm, qrCodeUrl, paymentInfoLabel, source = "bank" }) => {
  if (source === "legacyBusiness") {
    const paymentInformation = invoiceForm?.invoiceBusinessSnapshot?.businessPaymentInformation;
    if (!paymentInformation) return null;
    return /* @__PURE__ */ jsxs5(View5, { style: [PDF_STYLES.alignStart, PDF_STYLES.gap4], children: [
      /* @__PURE__ */ jsxs5(
        Text6,
        {
          style: [
            PDF_STYLES.regularBold,
            { fontSize: FONT_SIZES[invoiceForm?.invoiceCustomization?.fontSize ?? DEFAULT_FONT_SIZES].regularBold }
          ],
          children: [
            paymentInfoLabel,
            ":"
          ]
        }
      ),
      /* @__PURE__ */ jsx8(
        Text6,
        {
          style: [
            PDF_STYLES.businessText,
            { fontSize: FONT_SIZES[invoiceForm?.invoiceCustomization?.fontSize ?? DEFAULT_FONT_SIZES].businessText }
          ],
          children: paymentInformation
        }
      )
    ] });
  }
  if (!invoiceForm?.invoiceBankSnapshot) return null;
  return /* @__PURE__ */ jsxs5(View5, { style: [PDF_STYLES.alignStart, PDF_STYLES.gap4], children: [
    /* @__PURE__ */ jsxs5(
      Text6,
      {
        style: [
          PDF_STYLES.regularBold,
          { fontSize: FONT_SIZES[invoiceForm?.invoiceCustomization?.fontSize ?? DEFAULT_FONT_SIZES].regularBold }
        ],
        children: [
          paymentInfoLabel,
          ":"
        ]
      }
    ),
    /* @__PURE__ */ jsxs5(View5, { style: [PDF_STYLES.alignStart, PDF_STYLES.gap4, PDF_STYLES.row], children: [
      /* @__PURE__ */ jsxs5(View5, { style: [PDF_STYLES.alignStart, PDF_STYLES.gap4], children: [
        invoiceForm?.invoiceBankSnapshot?.accountHolder && /* @__PURE__ */ jsx8(
          Text6,
          {
            style: [
              PDF_STYLES.businessText,
              { fontSize: FONT_SIZES[invoiceForm?.invoiceCustomization?.fontSize ?? DEFAULT_FONT_SIZES].businessText }
            ],
            children: invoiceForm?.invoiceBankSnapshot?.accountHolder
          }
        ),
        invoiceForm?.invoiceBankSnapshot?.bankName && /* @__PURE__ */ jsx8(
          Text6,
          {
            style: [
              PDF_STYLES.businessText,
              { fontSize: FONT_SIZES[invoiceForm?.invoiceCustomization?.fontSize ?? DEFAULT_FONT_SIZES].businessText }
            ],
            children: invoiceForm?.invoiceBankSnapshot?.bankName
          }
        ),
        invoiceForm?.invoiceBankSnapshot?.sortOrder && /* @__PURE__ */ jsx8(
          Text6,
          {
            style: [
              PDF_STYLES.businessText,
              { fontSize: FONT_SIZES[invoiceForm?.invoiceCustomization?.fontSize ?? DEFAULT_FONT_SIZES].businessText }
            ],
            children: invoiceForm?.invoiceBankSnapshot?.sortOrder
          }
        ),
        invoiceForm?.invoiceBankSnapshot?.accountNumber && /* @__PURE__ */ jsx8(
          Text6,
          {
            style: [
              PDF_STYLES.businessText,
              { fontSize: FONT_SIZES[invoiceForm?.invoiceCustomization?.fontSize ?? DEFAULT_FONT_SIZES].businessText }
            ],
            children: invoiceForm?.invoiceBankSnapshot?.accountNumber
          }
        ),
        invoiceForm?.invoiceBankSnapshot?.swiftCode && /* @__PURE__ */ jsx8(
          Text6,
          {
            style: [
              PDF_STYLES.businessText,
              { fontSize: FONT_SIZES[invoiceForm?.invoiceCustomization?.fontSize ?? DEFAULT_FONT_SIZES].businessText }
            ],
            children: invoiceForm?.invoiceBankSnapshot?.swiftCode
          }
        ),
        invoiceForm?.invoiceBankSnapshot?.routingNumber && /* @__PURE__ */ jsx8(
          Text6,
          {
            style: [
              PDF_STYLES.businessText,
              { fontSize: FONT_SIZES[invoiceForm?.invoiceCustomization?.fontSize ?? DEFAULT_FONT_SIZES].businessText }
            ],
            children: invoiceForm?.invoiceBankSnapshot?.routingNumber
          }
        ),
        invoiceForm?.invoiceBankSnapshot?.branchCode && /* @__PURE__ */ jsx8(
          Text6,
          {
            style: [
              PDF_STYLES.businessText,
              { fontSize: FONT_SIZES[invoiceForm?.invoiceCustomization?.fontSize ?? DEFAULT_FONT_SIZES].businessText }
            ],
            children: invoiceForm?.invoiceBankSnapshot?.branchCode
          }
        ),
        invoiceForm?.invoiceBankSnapshot?.address && /* @__PURE__ */ jsx8(
          Text6,
          {
            style: [
              PDF_STYLES.businessText,
              { fontSize: FONT_SIZES[invoiceForm?.invoiceCustomization?.fontSize ?? DEFAULT_FONT_SIZES].businessText }
            ],
            children: invoiceForm?.invoiceBankSnapshot?.address
          }
        ),
        invoiceForm?.invoiceBankSnapshot?.upiCode && /* @__PURE__ */ jsx8(
          Text6,
          {
            style: [
              PDF_STYLES.businessText,
              { fontSize: FONT_SIZES[invoiceForm?.invoiceCustomization?.fontSize ?? DEFAULT_FONT_SIZES].businessText }
            ],
            children: invoiceForm?.invoiceBankSnapshot?.upiCode
          }
        )
      ] }),
      /* @__PURE__ */ jsx8(QRCodeInfo, { qrCodeUrl, invoiceForm })
    ] })
  ] });
};
var PaymentInfo = memo8(PaymentInfoComponent);

// .patch-work/upstream/apps/renderer/src/pages/invoices/Preview/HeaderInfo.tsx
import { jsx as jsx9 } from "react/jsx-runtime";
var HeaderInfoComponent = ({ invoiceForm, storeSettings, logoUrl, pdfTexts, blocks }) => {
  const renderBlock = (block, index) => {
    const style = [
      block.type === "row" ? PDF_STYLES.row : void 0,
      block.align === "start" ? PDF_STYLES.alignStart : block.align === "center" ? PDF_STYLES.alignCenter : block.align === "end" ? PDF_STYLES.alignEnd : void 0,
      block.justify === "between" ? PDF_STYLES.spaceBetween : void 0,
      block.width === "20%" ? PDF_STYLES.w20 : block.width === "40%" ? PDF_STYLES.w40 : block.width === "50%" ? PDF_STYLES.w50 : block.width === "60%" ? PDF_STYLES.w60 : block.width === "100%" ? PDF_STYLES.w100 : void 0,
      block.width ? PDF_STYLES.headerBlockWidth : void 0,
      block.paddingTop === 10 ? PDF_STYLES.pt10 : block.paddingTop === 20 ? PDF_STYLES.pt20 : void 0,
      block.paddingBottom === 20 ? PDF_STYLES.pb20 : void 0,
      block.gap === 5 ? PDF_STYLES.gap5 : block.gap === 10 ? PDF_STYLES.gap10 : void 0,
      block.boxed ? { backgroundColor: "#e0e0e0", padding: 5, borderRadius: 5 } : void 0
    ];
    const key = `${block.type}-${index}`;
    switch (block.type) {
      case "row":
      case "column":
        return /* @__PURE__ */ jsx9(View6, { style, children: block.children?.map(renderBlock) }, key);
      case "title":
        return /* @__PURE__ */ jsx9(View6, { style, children: /* @__PURE__ */ jsx9(
          TitleInfo,
          {
            invoiceForm,
            labels: { pdfINVOICELabel: pdfTexts.pdfINVOICE, pdfQUOTELabel: pdfTexts.pdfQUOTE }
          }
        ) }, key);
      case "logo":
        return /* @__PURE__ */ jsx9(View6, { style, children: /* @__PURE__ */ jsx9(LogoInfo, { invoiceForm, logoUrl }) }, key);
      case "businessInfo":
        return /* @__PURE__ */ jsx9(View6, { style, children: /* @__PURE__ */ jsx9(BusinessInfo, { invoiceForm }) }, key);
      case "clientInfo":
        return /* @__PURE__ */ jsx9(View6, { style, children: /* @__PURE__ */ jsx9(ClientInfo, { invoiceForm, billToLabel: pdfTexts.billTo }) }, key);
      case "invoiceMeta":
        return /* @__PURE__ */ jsx9(View6, { style, children: /* @__PURE__ */ jsx9(
          InvoiceInformationInfo,
          {
            storeSettings,
            invoiceForm,
            showTitle: block.showTitle,
            showInvoiceLabel: block.showInvoiceLabel,
            labels: {
              invoiceNoLabel: pdfTexts.invoiceNo,
              quoteNoLabel: pdfTexts.quoteNo,
              dueDateLabel: pdfTexts.dueDate,
              dateLabel: pdfTexts.date,
              pdfINVOICELabel: pdfTexts.pdfINVOICE,
              pdfQUOTELabel: pdfTexts.pdfQUOTE
            }
          }
        ) }, key);
      case "paymentInfo":
        return /* @__PURE__ */ jsx9(View6, { style, children: /* @__PURE__ */ jsx9(
          PaymentInfo,
          {
            invoiceForm,
            paymentInfoLabel: pdfTexts.paymentInfo,
            source: block.paymentSource
          }
        ) }, key);
    }
  };
  return /* @__PURE__ */ jsx9(View6, { style: PDF_STYLES.header, children: blocks.map((block, index) => renderBlock(block, index)) });
};
var HeaderInfo = memo9(HeaderInfoComponent);

// .patch-work/upstream/apps/renderer/src/pages/invoices/Preview/ItemsInfo.tsx
import { Text as Text7, View as View7 } from "@react-pdf/renderer";
import { memo as memo10, useMemo as useMemo2 } from "react";

// .patch-work/upstream/apps/renderer/src/state/constant.ts
var LANGUAGE_ITEMS = {
  ["lt" /* lt */]: { label: "Lithuanian", value: "lt" /* lt */ },
  ["en" /* en */]: { label: "English", value: "en" /* en */ },
  ["fr" /* fr */]: { label: "French", value: "fr" /* fr */ },
  ["de" /* de */]: { label: "German", value: "de" /* de */ },
  ["pt" /* pt */]: { label: "Portuguese", value: "pt" /* pt */ },
  ["cs" /* cs */]: { label: "Czech", value: "cs" /* cs */ }
};
var LANGUAGE_ITEMS_ARRAY = Object.values(LANGUAGE_ITEMS);
var AMOUNT_FORMAT_ITEMS = {
  ["en-US" /* enUS */]: { label: "1,234.10", value: "en-US" /* enUS */ },
  ["en-US-no-decimal" /* enUSnodecimal */]: { label: "1,234", value: "en-US-no-decimal" /* enUSnodecimal */ },
  ["lt-LT" /* ltLT */]: { label: "1 234,10", value: "lt-LT" /* ltLT */ },
  ["lt-LT-no-decimal" /* ltLTnodecimal */]: { label: "1 234", value: "lt-LT-no-decimal" /* ltLTnodecimal */ },
  ["de-DE" /* deDE */]: { label: "1.234,10", value: "de-DE" /* deDE */ },
  ["de-DE-no-decimal" /* deDEnodecimal */]: { label: "1.234", value: "de-DE-no-decimal" /* deDEnodecimal */ }
};
var AMOUNT_FORMAT_ITEMS_ARRAY = Object.values(AMOUNT_FORMAT_ITEMS);
var DATE_FORMAT_ITEMS = {
  ["MM/dd/yyyy" /* MMddyyyy */]: { label: "11/11/2025 (MM.dd.yyyy)", value: "MM/dd/yyyy" /* MMddyyyy */ },
  ["dd/MM/yyyy" /* ddMMyyyy */]: { label: "11/11/2025 (dd.MM.yyyy)", value: "dd/MM/yyyy" /* ddMMyyyy */ },
  ["yyyy/MM/dd" /* yyyyMMdd */]: { label: "2025/11/11 (yyyy.MM.dd)", value: "yyyy/MM/dd" /* yyyyMMdd */ },
  ["MM-dd-yyyy" /* MMddyyyyDash */]: { label: "11-11-2025 (MM-dd-yyyy)", value: "MM-dd-yyyy" /* MMddyyyyDash */ },
  ["dd-MM-yyyy" /* ddMMyyyyDash */]: { label: "11-11-2025 (dd-MM-yyyy)", value: "dd-MM-yyyy" /* ddMMyyyyDash */ },
  ["yyyy-MM-dd" /* yyyyMMddDash */]: { label: "2025-11-11 (yyyy-MM-dd)", value: "yyyy-MM-dd" /* yyyyMMddDash */ },
  ["MM.dd.yyyy" /* MMddyyyyDot */]: { label: "11.11.2025 (MM.dd.yyyy)", value: "MM.dd.yyyy" /* MMddyyyyDot */ },
  ["dd.MM.yyyy" /* ddMMyyyyDot */]: { label: "11.11.2025 (dd.MM.yyyy)", value: "dd.MM.yyyy" /* ddMMyyyyDot */ },
  ["yyyy.MM.dd" /* yyyyMMddDot */]: { label: "2025.11.2025 (yyyy.MM.dd)", value: "yyyy.MM.dd" /* yyyyMMddDot */ },
  ["MMM d, yyyy" /* MMMdyyyy */]: { label: "Nov 11, 2025 (MMM d, yyyy)", value: "MMM d, yyyy" /* MMMdyyyy */ },
  ["d MMM yyyy" /* dMMMMyyyy */]: { label: "11 Nov 2025 (d MMMM yyyy)", value: "d MMM yyyy" /* dMMMMyyyy */ },
  ["yyyy MMM d" /* yyyyMMMdd */]: { label: "2025 Nov 11 (yyyy MMM dd)", value: "yyyy MMM d" /* yyyyMMMdd */ }
};
var DATE_FORMAT_ITEMS_ARRAY = Object.values(DATE_FORMAT_ITEMS);
var CURRENCY_FORMAT_ITEMS = {
  ["{symbol}{amount}" /* symbolAmount */]: { label: "{symbol}123", value: "{symbol}{amount}" /* symbolAmount */ },
  ["{symbol} {amount}" /* symbolSpaceAmount */]: { label: "{symbol} 123", value: "{symbol} {amount}" /* symbolSpaceAmount */ },
  ["{amount}{symbol}" /* amountSymbol */]: { label: "123{symbol}", value: "{amount}{symbol}" /* amountSymbol */ },
  ["{amount} {symbol}" /* amountSpaceSymbol */]: { label: "123 {symbol}", value: "{amount} {symbol}" /* amountSpaceSymbol */ },
  ["{code}{amount}" /* codeAmount */]: { label: "{code}123", value: "{code}{amount}" /* codeAmount */ },
  ["{code} {amount}" /* codeSpaceAmount */]: { label: "{code} 123", value: "{code} {amount}" /* codeSpaceAmount */ },
  ["{amount}{code}" /* amountCode */]: { label: "123{code}", value: "{amount}{code}" /* amountCode */ },
  ["{amount} {code}" /* amountSpaceCode */]: { label: "123 {code}", value: "{amount} {code}" /* amountSpaceCode */ },
  ["{amount}" /* amountOnly */]: { label: "123", value: "{amount}" /* amountOnly */ }
};
var CURRENCY_FORMAT_ITEMS_ARRAY = Object.values(CURRENCY_FORMAT_ITEMS);
var DEFAULT_TABLE_FIELD_SORT_ORDERS = {
  no: 0,
  item: 1,
  unit: 2,
  quantity: 3,
  unitCost: 4,
  total: 5
};

// .patch-work/upstream/apps/renderer/src/pages/invoices/Preview/ItemsInfo.tsx
import { Fragment, jsx as jsx10, jsxs as jsxs6 } from "react/jsx-runtime";
var ItemsInfoComponent = ({ invoiceForm, storeSettings, labels, columnSizing = "fixedFlex" }) => {
  const { itemLabel, unitLabel, qtyLabel, unitCostLabel, totalLabel, taxLabel, discountLabel } = labels;
  const customFields = useMemo2(() => {
    const fields = invoiceForm?.invoiceItems?.map((item) => item.customField).filter((item) => typeof item?.header === "string") ?? [];
    const map = /* @__PURE__ */ new Map();
    fields.forEach((field) => {
      map.set(field.header, field);
    });
    return [...map.values()];
  }, [invoiceForm?.invoiceItems]);
  const sizes = useMemo2(() => {
    if (columnSizing === "proportional") {
      const weights2 = { ...COLUMN_WEIGHTS };
      customFields.forEach((column) => {
        weights2[column.header] = DEFAULT_USER_COLUMN_WEIGHT;
      });
      if (!invoiceForm?.invoiceCustomization?.showRowNo) delete weights2.rowNo;
      if (!invoiceForm?.invoiceCustomization?.showQuantity) delete weights2.quantity;
      if (!invoiceForm?.invoiceCustomization?.showUnit) delete weights2.unit;
      const totalWeight = Object.values(weights2).reduce((sum, weight) => sum + (weight ?? 0), 0);
      return Object.fromEntries(
        Object.entries(weights2).map(([key, weight]) => [key, { width: `${(weight ?? 0) / totalWeight * 100}%` }])
      );
    }
    const weights = {};
    if (invoiceForm?.invoiceCustomization?.showRowNo) {
      weights.rowNo = { width: FIXED_COLUMNS.rowNo };
    }
    if (invoiceForm?.invoiceCustomization?.showQuantity) {
      weights.quantity = { width: FIXED_COLUMNS.quantity };
    }
    if (invoiceForm?.invoiceCustomization?.showUnit) {
      weights.unit = { width: FIXED_COLUMNS.unit };
    }
    weights.unitCost = { width: FIXED_COLUMNS.unitCost };
    weights.total = { width: FIXED_COLUMNS.total };
    const multiplier = invoiceForm?.invoiceCustomization?.fontFamily ? FONT_WIDTH_MULTIPLIERS[invoiceForm.invoiceCustomization.fontFamily] : 6;
    const contentWeight = (values) => {
      const width = Math.max(...values.map((value) => value?.length ?? 0)) * multiplier;
      return width * width;
    };
    customFields.forEach((col) => {
      const values = invoiceForm?.invoiceItems?.filter((item) => item.customField?.header === col.header).map((item) => item.customField?.value);
      weights[col.header] = {
        minWidth: 70,
        flexGrow: contentWeight([col.header, ...values ?? []]),
        flexBasis: 0
      };
    });
    weights.item = {
      flexGrow: contentWeight([
        itemLabel,
        ...invoiceForm?.invoiceItems?.map((item) => item.invoiceItemSnapshot.itemName) ?? []
      ]),
      flexBasis: 0,
      minWidth: 70
    };
    return weights;
  }, [columnSizing, customFields, invoiceForm, itemLabel]);
  const lightenHex = (data) => {
    const { hex, amount } = data;
    if (!hex) return "inherit";
    const clean = hex.replace("#", "");
    const num = parseInt(clean, 16);
    const r = num >> 16 & 255;
    const g = num >> 8 & 255;
    const b = num & 255;
    const lighten = (c) => Math.round(c + (255 - c) * amount);
    const newR = lighten(r);
    const newG = lighten(g);
    const newB = lighten(b);
    return "#" + [newR, newG, newB].map((x) => x.toString(16).padStart(2, "0")).join("");
  };
  const headerRowStyle = useMemo2(() => {
    let rowBckgColor = "transparent";
    let rowFontColor = "inherit";
    let rowBorder = "1px solid #e0e0e0";
    let rowBorderCell = void 0;
    if (invoiceForm?.invoiceCustomization?.tableHeaderStyle === "light" /* light */) {
      rowBckgColor = lightenHex({ hex: invoiceForm?.invoiceCustomization?.color, amount: 0.9 });
      rowBorder = void 0;
    } else if (invoiceForm?.invoiceCustomization?.tableHeaderStyle === "dark" /* dark */) {
      rowFontColor = "#ffffff";
      rowBckgColor = invoiceForm?.invoiceCustomization?.color ?? "inherit";
      rowBorder = void 0;
    }
    if (invoiceForm?.invoiceCustomization?.tableRowStyle === "bordered" /* bordered */ && invoiceForm?.invoiceCustomization?.tableHeaderStyle === "outline" /* outline */) {
      rowBorder = void 0;
      rowBorderCell = "1px solid #e0e0e0";
    }
    return { bckgColor: rowBckgColor, fontColor: rowFontColor, border: rowBorder, borderCell: rowBorderCell };
  }, [invoiceForm]);
  const sortedColumns = useMemo2(() => {
    const sortOrders = invoiceForm?.invoiceCustomization?.fieldSortOrders ?? DEFAULT_TABLE_FIELD_SORT_ORDERS;
    const defaultCols = Object.entries(sortOrders).map(([key, value]) => ({
      key,
      sortOrder: value
    }));
    const customCols = customFields.map((f) => ({
      key: f.header,
      sortOrder: f.sortOrder
    }));
    const allCols = [...defaultCols, ...customCols];
    allCols.sort((a, b) => a.sortOrder - b.sortOrder);
    return allCols.map((c) => c.key);
  }, [invoiceForm?.invoiceCustomization?.fieldSortOrders, customFields]);
  const visibleColumns = useMemo2(() => {
    return sortedColumns.filter((colKey) => {
      switch (colKey) {
        case "no":
          return invoiceForm?.invoiceCustomization?.showRowNo;
        case "unit":
          return invoiceForm?.invoiceCustomization?.showUnit;
        case "quantity":
          return invoiceForm?.invoiceCustomization?.showQuantity;
        default:
          return true;
      }
    });
  }, [
    sortedColumns,
    invoiceForm?.invoiceCustomization?.showRowNo,
    invoiceForm?.invoiceCustomization?.showUnit,
    invoiceForm?.invoiceCustomization?.showQuantity
  ]);
  const rowStyle = useMemo2(() => {
    let rowBorderBottom = "1px solid #e0e0e0";
    let rowBorderCell = void 0;
    let rowColor = void 0;
    if (invoiceForm?.invoiceCustomization?.tableRowStyle === "bordered" /* bordered */) {
      rowBorderCell = "1px solid #e0e0e0";
    } else if (invoiceForm?.invoiceCustomization?.tableRowStyle === "stripped" /* stripped */) {
      rowBorderBottom = void 0;
      rowColor = "#e0e0e0";
    }
    return {
      borderBottom: rowBorderBottom,
      borderCell: rowBorderCell,
      backgroundColor: rowColor
    };
  }, [invoiceForm]);
  return /* @__PURE__ */ jsxs6(Fragment, { children: [
    /* @__PURE__ */ jsx10(
      View7,
      {
        style: [
          PDF_STYLES.row,
          {
            backgroundColor: headerRowStyle.bckgColor,
            color: headerRowStyle.fontColor,
            border: headerRowStyle.border,
            borderBottom: rowStyle.borderCell,
            borderTop: rowStyle.borderCell
          }
        ],
        children: visibleColumns.map((colKey, index) => {
          switch (colKey) {
            case "no":
              return /* @__PURE__ */ jsx10(
                View7,
                {
                  style: [
                    PDF_STYLES.tableCol,
                    sizes["rowNo"],
                    {
                      borderLeft: rowStyle.borderCell,
                      ...visibleColumns.length - 1 === index && { borderRight: rowStyle.borderCell }
                    }
                  ],
                  children: /* @__PURE__ */ jsx10(
                    Text7,
                    {
                      style: [
                        PDF_STYLES.tableCellHeader,
                        {
                          fontSize: FONT_SIZES[invoiceForm?.invoiceCustomization?.fontSize ?? DEFAULT_FONT_SIZES].tableCellHeader
                        }
                      ],
                      children: "#"
                    }
                  )
                },
                colKey
              );
            case "item":
              return /* @__PURE__ */ jsx10(
                View7,
                {
                  style: [
                    PDF_STYLES.tableCol,
                    sizes["item"],
                    {
                      borderLeft: rowStyle.borderCell,
                      ...visibleColumns.length - 1 === index && { borderRight: rowStyle.borderCell }
                    }
                  ],
                  children: /* @__PURE__ */ jsx10(
                    Text7,
                    {
                      style: [
                        PDF_STYLES.tableCellHeader,
                        {
                          fontSize: FONT_SIZES[invoiceForm?.invoiceCustomization?.fontSize ?? DEFAULT_FONT_SIZES].tableCellHeader
                        }
                      ],
                      children: itemLabel
                    }
                  )
                },
                colKey
              );
            case "unit":
              return /* @__PURE__ */ jsx10(
                View7,
                {
                  style: [
                    PDF_STYLES.tableCol,
                    sizes["unit"],
                    PDF_STYLES.textEnd,
                    {
                      borderLeft: rowStyle.borderCell,
                      ...visibleColumns.length - 1 === index && { borderRight: rowStyle.borderCell }
                    }
                  ],
                  children: /* @__PURE__ */ jsx10(
                    Text7,
                    {
                      style: [
                        PDF_STYLES.tableCellHeader,
                        {
                          fontSize: FONT_SIZES[invoiceForm?.invoiceCustomization?.fontSize ?? DEFAULT_FONT_SIZES].tableCellHeader
                        }
                      ],
                      children: unitLabel
                    }
                  )
                },
                colKey
              );
            case "quantity":
              return /* @__PURE__ */ jsx10(
                View7,
                {
                  style: [
                    PDF_STYLES.tableCol,
                    sizes["quantity"],
                    PDF_STYLES.textEnd,
                    {
                      borderLeft: rowStyle.borderCell,
                      ...visibleColumns.length - 1 === index && { borderRight: rowStyle.borderCell }
                    }
                  ],
                  children: /* @__PURE__ */ jsx10(
                    Text7,
                    {
                      style: [
                        PDF_STYLES.tableCellHeader,
                        {
                          fontSize: FONT_SIZES[invoiceForm?.invoiceCustomization?.fontSize ?? DEFAULT_FONT_SIZES].tableCellHeader
                        }
                      ],
                      children: qtyLabel
                    }
                  )
                },
                colKey
              );
            case "unitCost":
              return /* @__PURE__ */ jsx10(
                View7,
                {
                  style: [
                    PDF_STYLES.tableCol,
                    sizes["unitCost"],
                    PDF_STYLES.textEnd,
                    {
                      borderLeft: rowStyle.borderCell,
                      ...visibleColumns.length - 1 === index && { borderRight: rowStyle.borderCell }
                    }
                  ],
                  children: /* @__PURE__ */ jsx10(
                    Text7,
                    {
                      style: [
                        PDF_STYLES.tableCellHeader,
                        {
                          fontSize: FONT_SIZES[invoiceForm?.invoiceCustomization?.fontSize ?? DEFAULT_FONT_SIZES].tableCellHeader
                        }
                      ],
                      children: unitCostLabel
                    }
                  )
                },
                colKey
              );
            case "total":
              return /* @__PURE__ */ jsx10(
                View7,
                {
                  style: [
                    PDF_STYLES.tableCol,
                    sizes["total"],
                    PDF_STYLES.textEnd,
                    {
                      borderLeft: rowStyle.borderCell,
                      ...visibleColumns.length - 1 === index && { borderRight: rowStyle.borderCell }
                    }
                  ],
                  children: /* @__PURE__ */ jsx10(
                    Text7,
                    {
                      style: [
                        PDF_STYLES.tableCellHeader,
                        {
                          fontSize: FONT_SIZES[invoiceForm?.invoiceCustomization?.fontSize ?? DEFAULT_FONT_SIZES].tableCellHeader
                        }
                      ],
                      children: totalLabel
                    }
                  )
                },
                colKey
              );
            default:
              const field = customFields.find((f) => f.header === colKey);
              if (!field) return null;
              return /* @__PURE__ */ jsx10(
                View7,
                {
                  style: [
                    PDF_STYLES.tableCol,
                    sizes[field.header],
                    { textAlign: field.alignment },
                    {
                      borderLeft: rowStyle.borderCell,
                      ...visibleColumns.length - 1 === index && { borderRight: rowStyle.borderCell }
                    }
                  ],
                  children: /* @__PURE__ */ jsx10(
                    Text7,
                    {
                      style: [
                        PDF_STYLES.tableCellHeader,
                        {
                          fontSize: FONT_SIZES[invoiceForm?.invoiceCustomization?.fontSize ?? DEFAULT_FONT_SIZES].tableCellHeader
                        }
                      ],
                      children: field.header
                    }
                  )
                },
                field.header
              );
          }
        })
      }
    ),
    invoiceForm?.invoiceItems?.map((item, index1) => {
      const { quantity, taxType, taxRate, invoiceItemSnapshot, customField } = item;
      const { unitPriceCents = "0", itemName, unitName } = invoiceItemSnapshot;
      const { formattedUnitPrice, formattedTotal, formattedTax, formattedItemDiscountAmount, itemDiscountAmount } = getItemFinancialData({
        storeSettings,
        currencySymbol: invoiceForm?.invoiceCurrencySnapshot?.currencySymbol,
        currencyCode: invoiceForm?.invoiceCurrencySnapshot?.currencyCode,
        currencySubunit: invoiceForm?.invoiceCurrencySnapshot?.currencySubunit,
        currencyFormat: invoiceForm?.currencyFormat,
        unitPrice: Number(unitPriceCents),
        quantity: Number(quantity),
        taxType,
        taxRate,
        invoiceItems: invoiceForm?.invoiceItems ?? [],
        discountType: invoiceForm?.discountType,
        discountAmount: Number(invoiceForm?.discountAmountCents ?? 0),
        discountPercent: invoiceForm?.discountPercent
      });
      return /* @__PURE__ */ jsx10(
        View7,
        {
          wrap: false,
          style: [
            PDF_STYLES.row,
            {
              borderBottom: rowStyle.borderBottom,
              backgroundColor: index1 % 2 === 1 ? rowStyle.backgroundColor : void 0
            }
          ],
          children: visibleColumns.map((colKey, index2) => {
            switch (colKey) {
              case "no":
                return /* @__PURE__ */ jsx10(
                  View7,
                  {
                    style: [
                      PDF_STYLES.tableCol,
                      sizes["rowNo"],
                      {
                        borderLeft: rowStyle.borderCell,
                        ...visibleColumns.length - 1 === index2 && { borderRight: rowStyle.borderCell }
                      }
                    ],
                    children: /* @__PURE__ */ jsx10(
                      Text7,
                      {
                        style: [
                          {
                            fontSize: FONT_SIZES[invoiceForm?.invoiceCustomization?.fontSize ?? DEFAULT_FONT_SIZES].tableCell
                          }
                        ],
                        children: index1 + 1
                      }
                    )
                  },
                  colKey
                );
              case "item":
                return /* @__PURE__ */ jsxs6(
                  View7,
                  {
                    style: [
                      PDF_STYLES.tableCol,
                      sizes["item"],
                      {
                        borderLeft: rowStyle.borderCell,
                        ...visibleColumns.length - 1 === index2 && { borderRight: rowStyle.borderCell }
                      }
                    ],
                    children: [
                      /* @__PURE__ */ jsx10(
                        Text7,
                        {
                          style: [
                            {
                              fontSize: FONT_SIZES[invoiceForm?.invoiceCustomization?.fontSize ?? DEFAULT_FONT_SIZES].tableCell
                            }
                          ],
                          children: itemName
                        }
                      ),
                      taxType && /* @__PURE__ */ jsxs6(Fragment, { children: [
                        itemDiscountAmount > 0 && /* @__PURE__ */ jsx10(
                          Text7,
                          {
                            style: [
                              PDF_STYLES.tableCellSubtle,
                              {
                                fontSize: FONT_SIZES[invoiceForm?.invoiceCustomization?.fontSize ?? DEFAULT_FONT_SIZES].tableCellSubtle
                              }
                            ],
                            children: `${discountLabel}: ${formattedItemDiscountAmount}`
                          }
                        ),
                        /* @__PURE__ */ jsx10(
                          Text7,
                          {
                            style: [
                              PDF_STYLES.tableCellSubtle,
                              {
                                fontSize: FONT_SIZES[invoiceForm?.invoiceCustomization?.fontSize ?? DEFAULT_FONT_SIZES].tableCellSubtle
                              }
                            ],
                            children: `${taxLabel}(${taxRate}%): ${formattedTax}`
                          }
                        )
                      ] })
                    ]
                  },
                  colKey
                );
              case "unit":
                return /* @__PURE__ */ jsx10(
                  View7,
                  {
                    style: [
                      PDF_STYLES.tableCol,
                      sizes["unit"],
                      PDF_STYLES.textEnd,
                      {
                        borderLeft: rowStyle.borderCell,
                        ...visibleColumns.length - 1 === index2 && { borderRight: rowStyle.borderCell }
                      }
                    ],
                    children: /* @__PURE__ */ jsx10(
                      Text7,
                      {
                        style: [
                          {
                            fontSize: FONT_SIZES[invoiceForm?.invoiceCustomization?.fontSize ?? DEFAULT_FONT_SIZES].tableCell
                          }
                        ],
                        children: unitName
                      }
                    )
                  },
                  colKey
                );
              case "quantity":
                return /* @__PURE__ */ jsx10(
                  View7,
                  {
                    style: [
                      PDF_STYLES.tableCol,
                      sizes["quantity"],
                      PDF_STYLES.textEnd,
                      {
                        borderLeft: rowStyle.borderCell,
                        ...visibleColumns.length - 1 === index2 && { borderRight: rowStyle.borderCell }
                      }
                    ],
                    children: /* @__PURE__ */ jsx10(
                      Text7,
                      {
                        style: [
                          {
                            fontSize: FONT_SIZES[invoiceForm?.invoiceCustomization?.fontSize ?? DEFAULT_FONT_SIZES].tableCell
                          }
                        ],
                        children: quantity
                      }
                    )
                  },
                  colKey
                );
              case "unitCost":
                return /* @__PURE__ */ jsx10(
                  View7,
                  {
                    style: [
                      PDF_STYLES.tableCol,
                      sizes["unitCost"],
                      PDF_STYLES.textEnd,
                      {
                        borderLeft: rowStyle.borderCell,
                        ...visibleColumns.length - 1 === index2 && { borderRight: rowStyle.borderCell }
                      }
                    ],
                    children: /* @__PURE__ */ jsx10(
                      Text7,
                      {
                        style: [
                          {
                            fontSize: FONT_SIZES[invoiceForm?.invoiceCustomization?.fontSize ?? DEFAULT_FONT_SIZES].tableCell
                          }
                        ],
                        children: formattedUnitPrice
                      }
                    )
                  },
                  colKey
                );
              case "total":
                return /* @__PURE__ */ jsx10(
                  View7,
                  {
                    style: [
                      PDF_STYLES.tableCol,
                      sizes["total"],
                      PDF_STYLES.textEnd,
                      {
                        borderLeft: rowStyle.borderCell,
                        ...visibleColumns.length - 1 === index2 && { borderRight: rowStyle.borderCell }
                      }
                    ],
                    children: /* @__PURE__ */ jsx10(
                      Text7,
                      {
                        style: [
                          {
                            fontSize: FONT_SIZES[invoiceForm?.invoiceCustomization?.fontSize ?? DEFAULT_FONT_SIZES].tableCell
                          }
                        ],
                        children: formattedTotal
                      }
                    )
                  },
                  colKey
                );
              default:
                const field = customFields.find((f) => f.header === colKey);
                if (!field) return null;
                return /* @__PURE__ */ jsx10(
                  View7,
                  {
                    style: [
                      PDF_STYLES.tableCol,
                      sizes[field.header],
                      { textAlign: field.alignment },
                      {
                        borderLeft: rowStyle.borderCell,
                        ...visibleColumns.length - 1 === index2 && { borderRight: rowStyle.borderCell }
                      }
                    ],
                    children: /* @__PURE__ */ jsx10(
                      Text7,
                      {
                        style: [
                          {
                            fontSize: FONT_SIZES[invoiceForm?.invoiceCustomization?.fontSize ?? DEFAULT_FONT_SIZES].tableCell
                          }
                        ],
                        children: customField?.header === field.header && customField.value ? customField.value : " "
                      }
                    )
                  },
                  field.header
                );
            }
          })
        },
        `invoice-item-prev-${item.itemId}-${index1}`
      );
    })
  ] });
};
var ItemsInfo = memo10(ItemsInfoComponent);

// .patch-work/upstream/apps/renderer/src/pages/invoices/Preview/NotesInfo.tsx
import { Text as Text8, View as View8 } from "@react-pdf/renderer";
import { memo as memo11 } from "react";
import { jsx as jsx11, jsxs as jsxs7 } from "react/jsx-runtime";
var NotesInfoComponent = ({ invoiceForm, labels }) => {
  const { customerNoteLabel, termsConditionsLabel } = labels;
  return /* @__PURE__ */ jsxs7(View8, { style: [PDF_STYLES.pt20], children: [
    invoiceForm?.thanksNotes && /* @__PURE__ */ jsx11(
      View8,
      {
        style: [
          PDF_STYLES.regular,
          PDF_STYLES.italic,
          { fontSize: FONT_SIZES[invoiceForm?.invoiceCustomization?.fontSize ?? DEFAULT_FONT_SIZES].regular }
        ],
        children: /* @__PURE__ */ jsx11(Text8, { children: invoiceForm?.thanksNotes })
      }
    ),
    invoiceForm?.customerNotes && /* @__PURE__ */ jsxs7(View8, { style: [PDF_STYLES.pt10], children: [
      /* @__PURE__ */ jsx11(
        View8,
        {
          style: [
            PDF_STYLES.regularBold,
            { fontSize: FONT_SIZES[invoiceForm?.invoiceCustomization?.fontSize ?? DEFAULT_FONT_SIZES].regularBold }
          ],
          children: /* @__PURE__ */ jsx11(Text8, { children: customerNoteLabel })
        }
      ),
      /* @__PURE__ */ jsx11(
        View8,
        {
          style: [
            PDF_STYLES.regular,
            { fontSize: FONT_SIZES[invoiceForm?.invoiceCustomization?.fontSize ?? DEFAULT_FONT_SIZES].regular }
          ],
          children: /* @__PURE__ */ jsx11(Text8, { children: invoiceForm?.customerNotes })
        }
      )
    ] }),
    invoiceForm?.termsConditionNotes && /* @__PURE__ */ jsxs7(View8, { style: [PDF_STYLES.pt10], children: [
      /* @__PURE__ */ jsx11(
        View8,
        {
          style: [
            PDF_STYLES.regularBold,
            { fontSize: FONT_SIZES[invoiceForm?.invoiceCustomization?.fontSize ?? DEFAULT_FONT_SIZES].regularBold }
          ],
          children: /* @__PURE__ */ jsx11(Text8, { children: termsConditionsLabel })
        }
      ),
      /* @__PURE__ */ jsx11(
        View8,
        {
          style: [
            PDF_STYLES.regular,
            { fontSize: FONT_SIZES[invoiceForm?.invoiceCustomization?.fontSize ?? DEFAULT_FONT_SIZES].regular }
          ],
          children: /* @__PURE__ */ jsx11(Text8, { children: invoiceForm?.termsConditionNotes })
        }
      )
    ] })
  ] });
};
var NotesInfo = memo11(NotesInfoComponent);

// .patch-work/upstream/apps/renderer/src/pages/invoices/Preview/PageCounterInfo.tsx
import { Text as Text9 } from "@react-pdf/renderer";
import { memo as memo12 } from "react";
import { jsx as jsx12 } from "react/jsx-runtime";
var PageCounterInfoComponent = ({ invoiceForm, labels }) => {
  const { ofLabel, pageLabel } = labels;
  return /* @__PURE__ */ jsx12(
    Text9,
    {
      fixed: true,
      style: [
        PDF_STYLES.pageCounter,
        { fontSize: FONT_SIZES[invoiceForm?.invoiceCustomization?.fontSize ?? DEFAULT_FONT_SIZES].pageCounter }
      ],
      render: ({ pageNumber, totalPages }) => totalPages > 1 ? `${pageLabel} ${pageNumber} ${ofLabel} ${totalPages}` : ""
    }
  );
};
var PageCounterInfo = memo12(PageCounterInfoComponent);

// .patch-work/upstream/apps/renderer/src/pages/invoices/Preview/SignatureInfo.tsx
import { Image as Image3, Text as Text10, View as View9 } from "@react-pdf/renderer";
import { memo as memo13 } from "react";
import { jsx as jsx13, jsxs as jsxs8 } from "react/jsx-runtime";
var SignatureInfoComponent = ({ invoiceForm, signatureUrl, authorisedSignatoryLabel }) => {
  if (!signatureUrl) return null;
  if (!invoiceForm?.signatureData) return null;
  return /* @__PURE__ */ jsxs8(
    View9,
    {
      wrap: false,
      style: [PDF_STYLES.textEnd, PDF_STYLES.alignEnd, PDF_STYLES.pb20, PDF_STYLES.w100],
      minPresenceAhead: 40,
      children: [
        /* @__PURE__ */ jsx13(Image3, { src: signatureUrl, style: PDF_STYLES.signature }),
        /* @__PURE__ */ jsx13(
          Text10,
          {
            style: [
              PDF_STYLES.businessText,
              { fontSize: FONT_SIZES[invoiceForm?.invoiceCustomization?.fontSize ?? DEFAULT_FONT_SIZES].businessText }
            ],
            children: authorisedSignatoryLabel
          }
        )
      ]
    }
  );
};
var SignatureInfo = memo13(SignatureInfoComponent);

// .patch-work/upstream/apps/renderer/src/pages/invoices/Preview/WatermarkInfo.tsx
import { Image as Image4 } from "@react-pdf/renderer";
import { memo as memo14 } from "react";
import { jsx as jsx14 } from "react/jsx-runtime";
var WatermarkInfoComponent = ({ watermarkUrl, invoiceForm }) => {
  if (!watermarkUrl) return null;
  if (!invoiceForm?.invoiceCustomization?.watermarkFileData) return null;
  return /* @__PURE__ */ jsx14(Image4, { src: watermarkUrl, fixed: true, style: PDF_STYLES.watermark });
};
var WatermarkInfo = memo14(WatermarkInfoComponent);

// .patch-work/upstream/apps/renderer/src/pages/invoices/Preview/WatermarkPaidInfo.tsx
import { Image as Image5 } from "@react-pdf/renderer";
import { memo as memo15 } from "react";
import { jsx as jsx15 } from "react/jsx-runtime";
var WatermarkPaidInfoComponent = ({ watermarkPaidUrl, invoiceForm }) => {
  if (!watermarkPaidUrl) return null;
  if (!invoiceForm?.invoiceCustomization?.paidWatermarkFileData) return null;
  return /* @__PURE__ */ jsx15(Image5, { src: watermarkPaidUrl, style: PDF_STYLES.watermarkPaid });
};
var WatermarkPaidInfo = memo15(WatermarkPaidInfoComponent);

// .patch-work/upstream/apps/renderer/src/pages/invoices/Preview/PDFDocument.tsx
import { jsx as jsx16, jsxs as jsxs9 } from "react/jsx-runtime";
var PDFDocumentComponent = ({
  invoiceForm,
  storeSettings,
  logoUrl,
  qrCodeUrl,
  signatureUrl,
  attachmentUrls,
  pdfTexts,
  layoutRequired,
  watermarkUrl,
  watermarkPaidUrl
}) => {
  const templateLayout = invoiceForm?.invoiceLayoutSnapshot?.layoutSchema;
  const templateSections = templateLayout?.schemaVersion === 1 ? templateLayout.sections ?? [] : [];
  const templateRegions = templateLayout?.schemaVersion === 2 ? templateLayout.regions : [];
  const dynamicStyle = useMemo3(
    () => createCustomFontStyles(invoiceForm?.invoiceCustomization?.fontFamily),
    [invoiceForm?.invoiceCustomization?.fontFamily]
  );
  const renderTemplateSection = (type, blocks, columnSizing, totalsBlocks, watermarkOrder, align) => {
    switch (type) {
      case "watermark":
        return /* @__PURE__ */ jsxs9(Fragment2, { children: [
          watermarkOrder === "paidFirst" && invoiceForm?.status === "paid" /* paid */ && /* @__PURE__ */ jsx16(WatermarkPaidInfo, { invoiceForm, watermarkPaidUrl }),
          /* @__PURE__ */ jsx16(WatermarkInfo, { invoiceForm, watermarkUrl }),
          watermarkOrder !== "paidFirst" && invoiceForm?.status === "paid" /* paid */ && /* @__PURE__ */ jsx16(WatermarkPaidInfo, { invoiceForm, watermarkPaidUrl })
        ] }, type);
      case "header":
        return /* @__PURE__ */ jsx16(
          HeaderInfo,
          {
            invoiceForm,
            storeSettings,
            logoUrl,
            pdfTexts,
            blocks: blocks ?? []
          },
          type
        );
      case "itemsTable":
        return /* @__PURE__ */ jsx16(
          ItemsInfo,
          {
            invoiceForm,
            storeSettings,
            columnSizing,
            labels: {
              itemLabel: pdfTexts.itemLabel,
              unitLabel: pdfTexts.unitLabel,
              qtyLabel: pdfTexts.qtyLabel,
              unitCostLabel: pdfTexts.unitCostLabel,
              totalLabel: pdfTexts.totalLabel,
              taxLabel: pdfTexts.taxLabel,
              discountLabel: pdfTexts.discountLabel
            }
          },
          type
        );
      case "financialTotals":
        return /* @__PURE__ */ jsxs9(
          View10,
          {
            wrap: false,
            style: [
              PDF_STYLES.row,
              align === "start" ? { justifyContent: "flex-start" } : align === "center" ? { justifyContent: "center" } : PDF_STYLES.spaceBetween,
              PDF_STYLES.alignStart,
              PDF_STYLES.pt10
            ],
            minPresenceAhead: 20,
            children: [
              align !== "start" && /* @__PURE__ */ jsx16(View10, { style: PDF_STYLES.flexGrow }),
              /* @__PURE__ */ jsx16(
                FinancialInfo,
                {
                  invoiceForm,
                  storeSettings,
                  align,
                  labels: {
                    subTotalLabel: pdfTexts.subTotalLabel,
                    discountLabel: pdfTexts.discountLabel,
                    surchargeLabel: pdfTexts.surchargeLabel,
                    incLabel: pdfTexts.incLabel,
                    taxLabel: pdfTexts.taxLabel,
                    taxExclusivePerItemLabel: pdfTexts.taxExclusivePerItemLabel,
                    taxInclusivePerItemLabel: pdfTexts.taxInclusivePerItemLabel,
                    shippingFeeLabel: pdfTexts.shippingFeeLabel,
                    totalLabel: pdfTexts.totalLabel,
                    paidLabel: pdfTexts.paidLabel,
                    balanceDueLabel: pdfTexts.balanceDueLabel
                  }
                }
              )
            ]
          },
          type
        );
      case "paymentInfo":
        return /* @__PURE__ */ jsx16(
          View10,
          {
            wrap: false,
            style: [PDF_STYLES.row, PDF_STYLES.spaceBetween, PDF_STYLES.alignStart, PDF_STYLES.pt20],
            minPresenceAhead: 20,
            children: /* @__PURE__ */ jsx16(PaymentInfo, { invoiceForm, paymentInfoLabel: pdfTexts.paymentInfo, qrCodeUrl })
          },
          type
        );
      case "totalsRow":
        return /* @__PURE__ */ jsx16(
          View10,
          {
            wrap: false,
            style: [PDF_STYLES.row, PDF_STYLES.spaceBetween, PDF_STYLES.alignStart, PDF_STYLES.pt10],
            minPresenceAhead: 20,
            children: totalsBlocks?.map((block) => {
              if (block.type === "spacer") return /* @__PURE__ */ jsx16(View10, { style: PDF_STYLES.flexGrow }, "spacer");
              if (block.type === "paymentInfo") {
                return /* @__PURE__ */ jsx16(
                  PaymentInfo,
                  {
                    invoiceForm,
                    paymentInfoLabel: pdfTexts.paymentInfo,
                    qrCodeUrl,
                    source: block.paymentSource
                  },
                  "paymentInfo"
                );
              }
              return /* @__PURE__ */ jsx16(
                FinancialInfo,
                {
                  invoiceForm,
                  storeSettings,
                  labels: {
                    subTotalLabel: pdfTexts.subTotalLabel,
                    discountLabel: pdfTexts.discountLabel,
                    surchargeLabel: pdfTexts.surchargeLabel,
                    incLabel: pdfTexts.incLabel,
                    taxLabel: pdfTexts.taxLabel,
                    taxExclusivePerItemLabel: pdfTexts.taxExclusivePerItemLabel,
                    taxInclusivePerItemLabel: pdfTexts.taxInclusivePerItemLabel,
                    shippingFeeLabel: pdfTexts.shippingFeeLabel,
                    totalLabel: pdfTexts.totalLabel,
                    paidLabel: pdfTexts.paidLabel,
                    balanceDueLabel: pdfTexts.balanceDueLabel
                  }
                },
                "financialTotals"
              );
            })
          },
          type
        );
      case "notes":
        return /* @__PURE__ */ jsx16(
          NotesInfo,
          {
            invoiceForm,
            labels: { customerNoteLabel: pdfTexts.customerNote, termsConditionsLabel: pdfTexts.termsConditions }
          },
          type
        );
      case "signature":
        return /* @__PURE__ */ jsx16(
          SignatureInfo,
          {
            invoiceForm,
            signatureUrl,
            authorisedSignatoryLabel: pdfTexts.authorisedSignatoryLabel
          },
          type
        );
      case "pageCounter":
        return /* @__PURE__ */ jsx16(
          PageCounterInfo,
          {
            invoiceForm,
            labels: { ofLabel: pdfTexts.of, pageLabel: pdfTexts.page }
          },
          type
        );
    }
  };
  const renderRegion = (region) => /* @__PURE__ */ jsxs9(
    View10,
    {
      wrap: region.overflow !== "keepTogether",
      minPresenceAhead: region.overflow === "keepTogether" ? 40 : void 0,
      style: {
        width: region.width,
        flexDirection: region.direction === "column" ? "column" : "row",
        flexWrap: region.direction === "grid" ? "wrap" : "nowrap",
        alignContent: "flex-start",
        marginRight: region.gap
      },
      children: [
        region.blocks && /* @__PURE__ */ jsx16(
          HeaderInfo,
          {
            invoiceForm,
            storeSettings,
            logoUrl,
            pdfTexts,
            blocks: region.blocks
          }
        ),
        region.sections?.map((section) => renderTemplateSection(section)),
        region.children?.map((node, index) => renderLayoutNode(node, `${region.id}-${index}`))
      ]
    },
    region.id
  );
  const renderLayoutNode = (node, key) => {
    if (node.type === "block") {
      return /* @__PURE__ */ jsx16(
        HeaderInfo,
        {
          invoiceForm,
          storeSettings,
          logoUrl,
          pdfTexts,
          blocks: [node.block]
        },
        key
      );
    }
    if (node.type === "section") {
      if (node.section.visible === false) return null;
      return /* @__PURE__ */ jsx16(View10, { children: renderTemplateSection(
        node.section.type,
        node.section.blocks,
        node.section.columnSizing,
        node.section.totalsBlocks,
        node.section.watermarkOrder,
        node.section.align
      ) }, key);
    }
    return /* @__PURE__ */ jsx16(
      View10,
      {
        style: {
          width: node.width,
          flexDirection: node.type === "column" ? "column" : "row",
          flexWrap: node.type === "grid" ? "wrap" : "nowrap",
          gap: node.gap
        },
        children: node.children.map((child, index) => renderLayoutNode(child, `${key}-${index}`))
      },
      key
    );
  };
  return /* @__PURE__ */ jsxs9(Document, { children: [
    /* @__PURE__ */ jsx16(
      Page,
      {
        size: invoiceForm?.invoiceCustomization?.pageFormat,
        orientation: templateLayout?.schemaVersion === 2 ? templateLayout.orientation : void 0,
        style: [
          PDF_STYLES.page,
          dynamicStyle.customFont,
          { fontSize: FONT_SIZES[invoiceForm?.invoiceCustomization?.fontSize ?? DEFAULT_FONT_SIZES].page }
        ],
        children: !invoiceForm?.layoutId || !invoiceForm.invoiceLayoutSnapshot?.layoutSchema ? /* @__PURE__ */ jsx16(View10, { style: { flexGrow: 1, justifyContent: "center", alignItems: "center" }, children: /* @__PURE__ */ jsx16(Text11, { style: PDF_STYLES.layoutRequired, children: layoutRequired }) }) : templateLayout?.schemaVersion === 2 ? /* @__PURE__ */ jsx16(View10, { wrap: templateRegions.length === 1, style: { flexDirection: "row", flexWrap: "nowrap", width: "100%" }, children: templateRegions.map(renderRegion) }) : templateSections.filter((section) => section.visible !== false).map(
          (section) => renderTemplateSection(
            section.type,
            section.blocks,
            section.columnSizing,
            section.totalsBlocks,
            section.watermarkOrder,
            section.align
          )
        )
      }
    ),
    attachmentUrls.map((item) => /* @__PURE__ */ jsxs9(
      Page,
      {
        size: invoiceForm?.invoiceCustomization?.pageFormat,
        orientation: templateLayout?.schemaVersion === 2 ? templateLayout.orientation : void 0,
        style: [
          PDF_STYLES.page,
          dynamicStyle.customFont,
          { fontSize: FONT_SIZES[invoiceForm?.invoiceCustomization?.fontSize ?? DEFAULT_FONT_SIZES].page }
        ],
        children: [
          /* @__PURE__ */ jsx16(WatermarkInfo, { invoiceForm, watermarkUrl }),
          /* @__PURE__ */ jsx16(Image6, { style: PDF_STYLES.attachment, src: item.url }),
          /* @__PURE__ */ jsx16(
            PageCounterInfo,
            {
              invoiceForm,
              labels: {
                ofLabel: pdfTexts.of,
                pageLabel: pdfTexts.page
              }
            }
          )
        ]
      },
      item.id
    ))
  ] });
};
var PDFDocument = memo16(PDFDocumentComponent);
export {
  PDFDocument
};
