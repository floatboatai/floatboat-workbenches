// ABOUTME: 内置示例（由 app/tools/build-examples.ts 以本地解析器生成，勿手改）：原文件与结构文档的内容哈希。
import type { DocumentRef } from "./review.ts";
export interface Example {
  key: string;
  title: string;
  sourceFile: string;
  documentFile: string;
  document: DocumentRef & { source: NonNullable<DocumentRef["source"]> };
}
export const EXAMPLES: Example[] = [
  {
    "key": "water-report",
    "title": "城东水厂 2026 年第三季度水质报告",
    "sourceFile": "water-report.pdf",
    "documentFile": "water-report.docling.json",
    "document": {
      "id": "c1a9d868c4e7e1cf4ae613456c12ae23748dd88d722d2c5deaa0fdd2490c9f8d",
      "name": "water-report",
      "bytes": 55405,
      "pages": 5,
      "items": 50,
      "engine": "本地解析 · pdf.js 6.4.299 版面分析",
      "source": {
        "id": "21e330d8fcb0505c06ff9afa3e1a983b447e320d4a44ef1bb537c088d5e5a65a",
        "name": "water-report.pdf",
        "format": "pdf",
        "bytes": 734876
      }
    }
  },
  {
    "key": "pump-inspection",
    "title": "二号泵房设备巡检作业指导书",
    "sourceFile": "pump-inspection.docx",
    "documentFile": "pump-inspection.docling.json",
    "document": {
      "id": "2c09d97858f45458686bd762b3bf6c18e358d7abf84751a395a732d0f09bdc72",
      "name": "二号泵房设备巡检作业指导书",
      "bytes": 20625,
      "pages": 0,
      "items": 36,
      "engine": "本地解析 · Word OOXML",
      "source": {
        "id": "1090e3378f52197bc5cd97846867f475cdacdae8c32362a7ed4fe04a3ce4bbfe",
        "name": "pump-inspection.docx",
        "format": "docx",
        "bytes": 6200
      }
    }
  },
  {
    "key": "shift-handover",
    "title": "泵站夜班交接记录",
    "sourceFile": "shift-handover.md",
    "documentFile": "shift-handover.docling.json",
    "document": {
      "id": "8a398344516ccff22f7b5087a178ea4c8bc87a34e705ca079fa5faae5263bc4f",
      "name": "shift-handover",
      "bytes": 8320,
      "pages": 0,
      "items": 16,
      "engine": "本地解析 · marked 16.4.2",
      "source": {
        "id": "69bcbfeedba9d18ffaebb9cb747b01dd30e84e741e4266d9b4db5cf4b50e797a",
        "name": "shift-handover.md",
        "format": "md",
        "bytes": 751
      }
    }
  }
];
