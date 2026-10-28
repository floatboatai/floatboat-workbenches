export interface NativeItem {
  quantity: number;
  taxRate: number;
  invoiceItemSnapshot: {
    itemName: string;
    unitName: string;
    unitPriceCents: string;
  };
}
export interface FinancialInput {
  storeSettings: { amountFormat: string };
  currencySymbol: string;
  currencyCode: string;
  currencySubunit: number;
  currencyFormat: string;
  invoiceItems: NativeItem[];
  invoicePayments: { amountCents: string }[];
  discountType?: "fixed" | "percentage";
  discountAmount?: number;
  discountPercent?: number;
  taxRate: number;
  taxType?: "exclusive" | "inclusive";
  shippingAmount?: number;
}
export interface FinancialData {
  formattedSubTotalAmount: string;
  formattedTotalTaxAmount: string;
  discountAmountFormatted: string;
  shippingAmountFormatted: string;
  surchargeAmountFormatted: string;
  totalAmountFormatted: string;
  totalAmountPaidFormatted: string;
  balanceDueFormatted: string;
  subTotalAmount: number;
  totalTax: number;
  discountAmount: number;
  shippingAmount: number;
  surchargeAmount: number;
  totalAmount: number;
  totalAmountPaid: number;
  balanceDue: number;
}
export function getFinancialData(value: FinancialInput): FinancialData;
export function calcTax(
  amount: number,
  taxRate: number,
  taxType?: string,
): number;
export function calcDiscount(value: {
  subTotal: number;
  discountType?: string;
  discountAmount?: number;
  discountPercent?: number;
}): number;
export function getItemFinancialData(
  value: Omit<FinancialInput, "invoicePayments"> & {
    unitPrice: number;
    quantity: number;
  },
): {
  formattedUnitPrice: string;
  formattedTotal: string;
  formattedTax: string;
  formattedItemDiscountAmount: string;
  itemDiscountAmount: number;
};
