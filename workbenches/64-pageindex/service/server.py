"""Optional local PageIndex adapter for the PageIndex workbench.

The workbench reads, renders and extracts PDFs in the browser with PDF.js. This service only adds
PageIndex-built chapter trees:

* ``flash``: ``page_index_flash`` layout statistics, no model or key required.
* ``classic``: ``page_index`` (page_index_classic) with node summaries and a document description.
  Requires ``PAGEINDEX_MODEL`` (a LiteLLM model name) and that provider's key in the environment.
"""
import argparse
import base64
import hashlib
import io
import json
import os
import threading
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from importlib.metadata import version

import pypdfium2 as pdfium
from pageindex.flash import page_index_flash

MAX_BYTES = 64 * 1024 * 1024
MAX_PAGES = 1000
LOCK = threading.Lock()  # PDFium and the indexers are not re-entrant within one process.


def classic_model():
    return os.environ.get("PAGEINDEX_MODEL", "").strip()


def pdf_bytes(value):
    if not isinstance(value, dict) or not isinstance(value.get("pdf"), str):
        raise ValueError("PDF payload required")
    if len(value["pdf"]) > (MAX_BYTES + 2) // 3 * 4:
        raise ValueError("PDF exceeds 64 MiB")
    raw = base64.b64decode(value["pdf"], validate=True)
    if not 0 < len(raw) <= MAX_BYTES or b"%PDF-" not in raw[:1024]:
        raise ValueError("Invalid PDF")
    return raw


def page_count(raw):
    with pdfium.PdfDocument(raw) as pdf:
        count = len(pdf)
    if not 1 <= count <= MAX_PAGES:
        raise ValueError(f"PDF must contain 1 to {MAX_PAGES} pages")
    return count


def classic_tree(raw, model):
    from pageindex.page_index_classic import page_index

    return page_index(io.BytesIO(raw), model=model, if_add_node_id="yes",
                      if_add_node_summary="yes", if_add_doc_description="yes",
                      if_add_node_text="no")


def index_pdf(raw, mode="flash"):
    if mode not in ("flash", "classic"):
        raise ValueError("mode must be flash or classic")
    pages = page_count(raw)
    if mode == "classic":
        model = classic_model()
        if not model:
            raise ValueError("Classic mode needs PAGEINDEX_MODEL and the provider key")
        tree = classic_tree(raw, model)
    else:
        tree = page_index_flash(io.BytesIO(raw), summary=False, optimize=False)
    if not tree.get("structure"):
        raise ValueError("PageIndex did not produce a document structure")
    return {"engine": "pageindex", "version": version("pageindex"), "mode": mode,
            "sha256": hashlib.sha256(raw).hexdigest(), "pages": pages, "index": tree}


def health():
    model = classic_model()
    return {"service": "floatboat-pageindex", "version": version("pageindex"),
            "modes": ["flash", "classic"] if model else ["flash"], "model": model,
            "maxPages": MAX_PAGES}


class Handler(BaseHTTPRequestHandler):
    def log_message(self, *_):
        pass

    def send(self, code, value):
        raw = json.dumps(value, ensure_ascii=False).encode()
        self.send_response(code)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(raw)))
        self.send_header("Cache-Control", "no-store")
        self.end_headers()
        self.wfile.write(raw)

    def do_GET(self):
        if self.path == "/health":
            self.send(200, health())
        else:
            self.send(404, {"error": "Not found"})

    def do_POST(self):
        if self.headers.get("Origin"):
            return self.send(403, {"error": "Use the workbench server"})
        self.connection.settimeout(60)
        if self.path != "/index":
            return self.send(404, {"error": "Not found"})
        try:
            length = int(self.headers.get("Content-Length", "0"))
            if not 0 < length <= (MAX_BYTES + 2) // 3 * 4 + 4096:
                return self.send(413, {"error": "Payload exceeds limit"})
            if not LOCK.acquire(blocking=False):
                return self.send(503, {"error": "PageIndex is busy with another document; retry later"})
            try:
                value = json.loads(self.rfile.read(length))
                self.send(200, index_pdf(pdf_bytes(value), value.get("mode", "flash")))
            finally:
                LOCK.release()
        except (ValueError, TypeError, KeyError) as error:
            self.send(400, {"error": str(error)[:300]})
        except Exception as error:  # Model/provider failures in classic mode surface as a short reason.
            self.send(422, {"error": f"PageIndex could not process this PDF: {type(error).__name__}"})


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--port", type=int, default=8784)
    args = parser.parse_args()
    modes = ", ".join(health()["modes"])
    print(f"PageIndex adapter: http://127.0.0.1:{args.port} (modes: {modes})", flush=True)
    ThreadingHTTPServer(("127.0.0.1", args.port), Handler).serve_forever()
