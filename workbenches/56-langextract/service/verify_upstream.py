"""Verify real LangExtract serialization/grounding with an explicit stub model.

No provider call occurs. The output is a contract fixture, never model-quality proof.
"""
import json
import sys
from pathlib import Path
from importlib.metadata import version
import langextract as lx
from langextract.core import base_model, types

class ContractModel(base_model.BaseLanguageModel):
    def infer(self, batch_prompts, **kwargs):
        for _ in batch_prompts:
            yield [types.ScoredOutput(score=1.0, output=json.dumps({"extractions":[{"负责人":"林晓","负责人_attributes":{"角色":"采购负责人"}},{"数量":"24套"}]}, ensure_ascii=False))]

assert version("langextract") == "1.7.1"
source = "🌿 青禾工作室 负责人 林晓 采购 24套 灯具。"
result = lx.extract(text_or_documents=source, prompt_description="提取负责人和采购数量。", examples=[lx.data.ExampleData(text="负责人 陈越 采购 12套 灯具。", extractions=[lx.data.Extraction(extraction_class="负责人",extraction_text="陈越"),lx.data.Extraction(extraction_class="数量",extraction_text="12套")])], model=ContractModel(), use_schema_constraints=False, fence_output=False, fetch_urls=False, resolver_params={"suppress_parse_errors":False}, show_progress=False)
result.document_id="upstream-contract-emoji"
assert len(result.extractions)==2
for item in result.extractions:
    assert result.text[item.char_interval.start_pos:item.char_interval.end_pos]==item.extraction_text
out=Path(sys.argv[1]);out.mkdir(parents=True,exist_ok=True)
lx.io.save_annotated_documents([result],output_dir=out,output_name="upstream-contract.jsonl",show_progress=False)
loaded=list(lx.io.load_annotated_documents_jsonl(out/"upstream-contract.jsonl",show_progress=False))
assert loaded[0].text==source
assert loaded[0].extractions[0].extraction_text=="林晓"
print(json.dumps({"engine":"langextract","version":version("langextract"),"realPipeline":True,"model":"explicit deterministic contract stub, no provider inference","records":len(result.extractions),"jsonlRoundtrip":True,"pythonCodepointGrounding":True},ensure_ascii=False))
