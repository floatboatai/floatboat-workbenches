import io
import unittest
from pathlib import Path
from reportlab.pdfgen import canvas
from server import pdf_bytes, index_pdf, render_pdf
class ServiceTests(unittest.TestCase):
    def test_real_index_and_png(self):
        raw=(Path(__file__).parents[1]/'app/samples/handbook.pdf').read_bytes()
        result=index_pdf(raw)
        self.assertEqual(result['version'],'0.2.10')
        self.assertEqual(len(result['pages']),3)
        self.assertEqual(result['index']['structure'][2]['start_index'],3)
        self.assertTrue(render_pdf(raw,2).startswith(b'\x89PNG\r\n\x1a\n'))
        with self.assertRaises(ValueError): render_pdf(raw,4)
    def test_invalid_binary_and_encoding(self):
        for value in [{},{'pdf':'!not-base64'},{'pdf':'bm90IGEgcGRm'}]:
            with self.assertRaises(ValueError): pdf_bytes(value)
    def test_unreadable_pdf_is_not_fabricated(self):
        out=io.BytesIO();c=canvas.Canvas(out);c.rect(10,10,100,100);c.showPage();c.save()
        with self.assertRaisesRegex(ValueError,'No readable text'):index_pdf(out.getvalue())
    def test_page_capacity(self):
        out=io.BytesIO();c=canvas.Canvas(out)
        for _ in range(41): c.drawString(10,40,'Example');c.showPage()
        c.save()
        with self.assertRaisesRegex(ValueError,'1 to 40'):index_pdf(out.getvalue())
if __name__=='__main__':unittest.main()
