// ABOUTME: 保存的业务模型是用户给出的规格原文及其格式；预览对象总是由原文解析得到。
import { isRecord } from "./project.ts";
import {
  analyzeSpec,
  convertSource,
  describe,
  type SpecAnalysis,
  type SpecFormat,
} from "./openapi.ts";
import { BLANK_SOURCE, SEED_SOURCE } from "./seed.ts";

export interface Model {
  format: SpecFormat;
  source: string;
}
export const seed: Model = { format: "yaml", source: SEED_SOURCE };
export const blank: Model = { format: "yaml", source: BLANK_SOURCE };

export function analyzeModel(model: Model): SpecAnalysis {
  return analyzeSpec(model.source, model.format);
}

function checked(format: SpecFormat, source: string): Model {
  const analysis = analyzeSpec(source, format);
  const error = analysis.diagnostics.find((item) => item.severity === "error");
  if (error) throw new Error(describe(error));
  return { format, source };
}

export function validate(value: unknown): Model {
  if (!isRecord(value)) throw new Error("请提供 OpenAPI 或 Swagger 规格。");
  if (typeof value.source === "string") {
    if (value.format !== "yaml" && value.format !== "json")
      throw new Error("规格格式只能是 YAML 或 JSON。");
    return checked(value.format, value.source);
  }
  // 0.3.0 及更早版本保存的是已解析的 JSON 对象。
  if (isRecord(value.spec))
    return checked("json", JSON.stringify(value.spec, null, 2) + "\n");
  throw new Error("请提供 OpenAPI 或 Swagger 规格。");
}

/** 模型生成结果是 JSON 对象，转换为 YAML 原文以便阅读和继续编辑。 */
export function fromGenerated(value: unknown): Model {
  if (!isRecord(value) || !isRecord(value.spec))
    throw new Error("模型没有返回 spec 对象，请调整要求重试。");
  return checked("yaml", convertSource(value.spec, "yaml"));
}

export const instructions =
  '按用户要求设计 OpenAPI 3.0.3 规格，用 JSON 表达。根对象只有 spec 字段：{"spec":{"openapi":"3.0.3","info":{"title":"接口名称","version":"1.0.0"},"servers":[{"url":"https://api.example.com/v1"}],"paths":{},"components":{"schemas":{},"securitySchemes":{}}}}。按资源划分 tags，覆盖所需的 GET/POST/PUT/PATCH/DELETE 操作，为每个操作写 summary、operationId、参数、requestBody 与 responses，并在 components.schemas 中定义可复用模型，用 #/components/... 内部 $ref 引用；需要认证时声明 securitySchemes。servers 使用示例域名，不写真实凭据或外部 $ref。';
