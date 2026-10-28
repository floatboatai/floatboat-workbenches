"""Bounded local PageIndex adapter. No provider key or model is required."""
import argparse
import base64
import hashlib
import io
import json
import threading
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from importlib.metadata import version

import pypdfium2 as pdfium
from pageindex.flash import page_index_flash

MAX_BYTES = 8 * 1024 * 1024
LOCK = threading.Lock()  # PDFium is not thread-safe within a process.


def pdf_bytes(value):
    if not isinstance(value, dict) or not isinstance(value.get("pdf"), str):
        raise ValueError("PDF payload required")
    if len(value["pdf"]) > (MAX_BYTES + 2) // 3 * 4:
        raise ValueError("PDF exceeds 8 MiB")
    raw = base64.b64decode(value["pdf"], validate=True)
    if not 0 < len(raw) <= MAX_BYTES or not raw.startswith(b"%PDF-"):
        raise ValueError("Invalid PDF")
    return raw


def index_pdf(raw):
    with pdfium.PdfDocument(raw) as pdf:
        if not 1 <= len(pdf) <= 40:
            raise ValueError("PDF must contain 1 to 40 pages")
        pages = []
        for i in range(len(pdf)):
            page = pdf[i]
            text = page.get_textpage()
            try:
                pages.append({"number": i + 1, "text": text.get_text_range()})
            finally:
                text.close()
                page.close()
    if sum(len(p["text"]) for p in pages) > 300000:
        raise ValueError("PDF text exceeds 300000 characters")
    if not any(p["text"].strip() for p in pages):
        raise ValueError("No readable text; OCR is not available")
    tree = page_index_flash(io.BytesIO(raw), summary=False, optimize=False)
    if not tree.get("structure"):
        raise ValueError("PageIndex did not produce a document structure")
    return {"engine": "pageindex", "version": version("pageindex"),
            "sha256": hashlib.sha256(raw).hexdigest(), "pages": pages,
            "index": tree}


def render_pdf(raw, number):
    with pdfium.PdfDocument(raw) as pdf:
        if type(number) is not int or not 1 <= number <= len(pdf) <= 40:
            raise ValueError("Page number outside document")
        page = pdf[number - 1]
        try:
            width, height = page.get_size()
            if width <= 0 or height <= 0 or max(width, height) > 15000:
                raise ValueError("Unsupported PDF page dimensions")
            scale = min(1.5, 1600 / max(width, height))
            bitmap = page.render(scale=scale)
            try:
                image = bitmap.to_pil()
                out = io.BytesIO()
                image.save(out, format="PNG")
                image.close()
                return out.getvalue()
            finally:
                bitmap.close()
        finally:
            page.close()


class Handler(BaseHTTPRequestHandler):
    def log_message(self, *_):
        pass

    def send(self, code, value, mime="application/json"):
        raw = value if isinstance(value, bytes) else json.dumps(value, ensure_ascii=False).encode()
        self.send_response(code)
        self.send_header("Content-Type", mime)
        self.send_header("Content-Length", str(len(raw)))
        self.send_header("Cache-Control", "no-store")
        self.end_headers()
        self.wfile.write(raw)

    def do_GET(self):
        if self.path == "/health":
            self.send(200, {"service": "floatboat-pageindex", "version": version("pageindex"),
                            "index": "flash-no-llm", "maxPages": 40})
        else:
            self.send(404, {"error": "Not found"})

    def do_POST(self):
        if self.headers.get("Origin"):
            return self.send(403, {"error": "Use the workbench server"})
        self.connection.settimeout(20)
        if self.path not in ["/index", "/render"]:
            return self.send(404, {"error": "Not found"})
        try:
            length = int(self.headers.get("Content-Length", "0"))
            if not 0 < length <= 12 * 1024 * 1024:
                return self.send(413, {"error": "Payload exceeds limit"})
            if not LOCK.acquire(blocking=False):
                return self.send(503, {"error": "PDF engine is busy; retry later"})
            try:
                value = json.loads(self.rfile.read(length))
                raw = pdf_bytes(value)
                if self.path == "/index":
                    self.send(200, index_pdf(raw))
                else:
                    self.send(200, render_pdf(raw, value.get("page")), "image/png")
            finally:
                LOCK.release()
        except (ValueError, TypeError, KeyError) as error:
            self.send(400, {"error": str(error)[:300]})
        except Exception:
            self.send(422, {"error": "PageIndex could not process this PDF"})


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--port", type=int, default=8784)
    args = parser.parse_args()
    print(f"PageIndex adapter: http://127.0.0.1:{args.port}", flush=True)
    ThreadingHTTPServer(("127.0.0.1", args.port), Handler).serve_forever()
