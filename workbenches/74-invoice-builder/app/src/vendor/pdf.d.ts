import type { ComponentType } from "react";
export interface NativePdfProps {
  invoiceForm: Record<string, unknown>;
  storeSettings: Record<string, unknown>;
  pdfTexts: Record<string, string>;
  attachmentUrls: [];
  layoutRequired: string;
  logoUrl?: string;
  signatureUrl?: string;
}
export const PDFDocument: ComponentType<NativePdfProps>;
