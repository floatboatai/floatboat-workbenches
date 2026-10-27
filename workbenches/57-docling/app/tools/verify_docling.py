"""Run real upstream Docling core on the shipped original HTML; no model downloads."""
from pathlib import Path
import argparse
import json
from docling.document_converter import DocumentConverter
from docling.datamodel.base_models import InputFormat
from docling_core.types.doc import DoclingDocument

parser = argparse.ArgumentParser()
parser.add_argument('--corrected', type=Path, help='Optional exported Docling JSON to validate with the native schema')
args = parser.parse_args()
source = Path(__file__).resolve().parents[1] / 'fixtures' / 'sample.html'
result = DocumentConverter(allowed_formats=[InputFormat.HTML]).convert(source)
assert result.status.value == 'success'
assert len(result.document.tables) == 1
assert len(result.document.texts) == 5
print(json.dumps({'engine': 'docling-slim 2.140.0', 'status': result.status.value, 'texts': len(result.document.texts), 'tables': len(result.document.tables)}))
if args.corrected:
    document = DoclingDocument.model_validate_json(args.corrected.read_text())
    assert document.tables[0].data.table_cells[4].text == '14'
    print(json.dumps({'native_schema': document.schema_name, 'corrected_cell': document.tables[0].data.table_cells[4].text, 'markdown_has_correction': '14' in document.export_to_markdown()}))
