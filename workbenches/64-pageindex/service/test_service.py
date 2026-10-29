import io
import os
import unittest
from pathlib import Path
from unittest import mock

from reportlab.pdfgen import canvas

import server
from server import health, index_pdf, pdf_bytes

SAMPLES = Path(__file__).parents[1] / "app/samples"


class ServiceTests(unittest.TestCase):
    def test_flash_tree_for_bundled_report(self):
        raw = (SAMPLES / "library-report.pdf").read_bytes()
        result = index_pdf(raw, "flash")
        self.assertEqual(result["version"], "0.2.10")
        self.assertEqual(result["pages"], 11)
        titles = []

        def walk(nodes):
            for node in nodes:
                titles.append(node["title"])
                walk(node.get("nodes", []))

        walk(result["index"]["structure"])
        self.assertIn("5.3 Closing checklist", titles)

    def test_invalid_binary_and_encoding(self):
        for value in [{}, {"pdf": "!not-base64"}, {"pdf": "bm90IGEgcGRm"}]:
            with self.assertRaises(ValueError):
                pdf_bytes(value)

    def test_classic_requires_configured_model(self):
        raw = (SAMPLES / "handbook.pdf").read_bytes()
        with mock.patch.dict(os.environ, {"PAGEINDEX_MODEL": ""}):
            self.assertEqual(health()["modes"], ["flash"])
            with self.assertRaisesRegex(ValueError, "PAGEINDEX_MODEL"):
                index_pdf(raw, "classic")
        with mock.patch.dict(os.environ, {"PAGEINDEX_MODEL": "example-model"}):
            self.assertEqual(health()["modes"], ["flash", "classic"])
            fake = {"doc_name": "x", "doc_description": "A handbook.",
                    "structure": [{"title": "Visitor schedule", "node_id": "0000",
                                   "start_index": 1, "end_index": 1, "summary": "Hours."}]}
            with mock.patch.object(server, "classic_tree", return_value=fake) as call:
                result = index_pdf(raw, "classic")
            call.assert_called_once_with(raw, "example-model")
            self.assertEqual(result["mode"], "classic")
            self.assertEqual(result["index"]["doc_description"], "A handbook.")

    def test_page_capacity_is_sized_for_long_reports(self):
        out = io.BytesIO()
        c = canvas.Canvas(out)
        for _ in range(120):
            c.drawString(10, 40, "Example")
            c.showPage()
        c.save()
        self.assertEqual(server.page_count(out.getvalue()), 120)
        with mock.patch.object(server, "MAX_PAGES", 100):
            with self.assertRaisesRegex(ValueError, "1 to 100"):
                server.page_count(out.getvalue())


if __name__ == "__main__":
    unittest.main()
