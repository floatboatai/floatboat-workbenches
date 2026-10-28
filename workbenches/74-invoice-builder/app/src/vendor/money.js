// Derived from piratuks/invoice-builder commit 2979d91742008be0d2376e919be9e404657a900b; MIT. See notices/provenance.json.

// .patch-work/upstream/apps/renderer/src/shared/utils/invoiceFunctions.ts
import { differenceInCalendarDays, parseISO as parseISO2 } from "date-fns";

// .patch-work/upstream/packages/contracts/src/types/layouts.ts
var MAX_LAYOUT_BYTES = 64 * 1024;
var validV2ContainerNodeTypes = ["row", "column", "grid"];
var validV2NodeTypes = [...validV2ContainerNodeTypes, "block", "section"];

// .patch-work/upstream/apps/renderer/src/shared/utils/formatFunctions.ts
import { format, parseISO } from "date-fns";
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
var getInvoiceTotal = (data) => {
  const {
    taxRate,
    taxType,
    invoiceItems,
    discountType,
    discountAmount = 0,
    discountPercent = 0,
    shippingFee = 0,
    surchargeAmount = 0,
    surchargeType,
    surchargePercent,
    includeTax = true
  } = data;
  const subTotal = invoiceItems.reduce((sum, item) => {
    return sum + Number(item.invoiceItemSnapshot.unitPriceCents) * Number(item.quantity);
  }, 0) ?? 0;
  const totalDiscount = calcDiscount({ subTotal, discountType, discountAmount, discountPercent });
  const afterDiscount = subTotal - totalDiscount;
  const totalSurcharge = calcSurcharge({
    subTotal: afterDiscount,
    surchargeType,
    surchargeAmount,
    surchargePercent
  });
  const taxInvoice = calcTax(afterDiscount, taxRate, taxType);
  let taxItems = 0;
  invoiceItems.map((item) => {
    const unitTotal = Number(item.invoiceItemSnapshot.unitPriceCents) * Number(item.quantity);
    let discount = 0;
    if (subTotal > 0 && totalDiscount > 0) {
      discount = Math.round(unitTotal / subTotal * totalDiscount);
    }
    const taxableAmount = unitTotal - discount;
    if (item.taxType !== "inclusive" /* inclusive */) taxItems += calcTax(taxableAmount, item.taxRate, item.taxType);
  });
  const tax = includeTax ? taxInvoice + taxItems : 0;
  return taxType === "inclusive" /* inclusive */ ? afterDiscount + shippingFee + totalSurcharge : afterDiscount + tax + shippingFee + totalSurcharge;
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
export {
  calcDiscount,
  calcSurcharge,
  calcTax,
  getFinancialData,
  getInvoiceItemTotal,
  getInvoiceTotal,
  getItemFinancialData
};
