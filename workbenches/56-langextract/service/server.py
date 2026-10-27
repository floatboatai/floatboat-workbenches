"""Loopback LangExtract job adapter. Model credentials remain in this process."""
from __future__ import annotations
import hmac
import json
import os
import re
import sqlite3
import threading
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timezone
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

ENGINE_VERSION = "1.7.1"
MAX_BODY = 450_000
JOB_ID = re.compile(r"[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}", re.I)
TERMINAL = {"succeeded", "failed", "cancelled", "interrupted"}


def now():
    return datetime.now(timezone.utc).isoformat()


def canonical(value):
    return json.dumps(value, ensure_ascii=False, sort_keys=True, separators=(",", ":"))


def validate_input(value):
    if not isinstance(value, dict):
        raise ValueError("Invalid input")
    docs = value.get("documents")
    if not isinstance(docs, list) or not 1 <= len(docs) <= 8:
        raise ValueError("Expected 1–8 documents")
    seen = set()
    for doc in docs:
        if not isinstance(doc, dict) or not isinstance(doc.get("id"), str) or not 1 <= len(doc["id"]) <= 120:
            raise ValueError("Invalid document id")
        if doc["id"] in seen:
            raise ValueError("Duplicate document id")
        seen.add(doc["id"])
        if not isinstance(doc.get("text"), str) or not doc["text"].strip() or len(doc["text"]) > 30000:
            raise ValueError("Invalid source text")
    if not isinstance(value.get("prompt"), str) or not value["prompt"].strip() or len(value["prompt"]) > 12000:
        raise ValueError("Invalid prompt")
    fields = value.get("fields")
    if not isinstance(fields, list) or len(fields) > 24:
        raise ValueError("Invalid fields")
    for field in fields:
        if not isinstance(field, dict) or not isinstance(field.get("name"), str) or not field["name"].strip() or len(field["name"]) > 100 or not isinstance(field.get("description"), str) or len(field["description"]) > 1000:
            raise ValueError("Invalid field")
    examples = value.get("examples")
    if not isinstance(examples, list) or not 1 <= len(examples) <= 8:
        raise ValueError("Expected 1–8 examples")
    for example in examples:
        if not isinstance(example, dict) or not isinstance(example.get("text"), str) or len(example["text"]) > 10000 or not isinstance(example.get("extractions"), list) or len(example["extractions"]) > 50:
            raise ValueError("Invalid example")
        for extraction in example["extractions"]:
            if not isinstance(extraction, dict) or not isinstance(extraction.get("extraction_class"), str) or not extraction["extraction_class"].strip() or len(extraction["extraction_class"]) > 120 or not isinstance(extraction.get("extraction_text"), str) or len(extraction["extraction_text"]) > 10000:
                raise ValueError("Invalid example extraction")
            attrs = extraction.get("attributes")
            if attrs is not None:
                if not isinstance(attrs, dict) or len(attrs) > 30:
                    raise ValueError("Invalid attributes")
                for key, attr in attrs.items():
                    if not isinstance(key, str) or not 1 <= len(key) <= 100:
                        raise ValueError("Invalid attribute key")
                    values = attr if isinstance(attr, list) else [attr]
                    if len(values) > 30 or any(not isinstance(item, str) or len(item) > 2000 for item in values):
                        raise ValueError("Invalid attribute value")
    if len(canonical(value).encode()) > 400_000:
        raise ValueError("Input too large")
    return value


def model_ready():
    return bool(os.environ.get("LX_MODEL_ID") and (os.environ.get("LANGEXTRACT_API_KEY") or os.environ.get("LX_MODEL_URL")))


def extract_with_langextract(value):
    """The only inference path: real upstream lx.extract, with no fallback results."""
    import langextract as lx
    from langextract import data_lib
    from importlib.metadata import version
    if version("langextract") != ENGINE_VERSION:
        raise RuntimeError("EngineVersionMismatch")
    if not model_ready():
        raise RuntimeError("ModelNotConfigured")
    example_objects = [lx.data.ExampleData(text=item["text"], extractions=[lx.data.Extraction(**ex) for ex in item["extractions"]]) for item in value["examples"]]
    prompt = value["prompt"]
    if value["fields"]:
        prompt += "\nExtraction classes and descriptions:\n" + "\n".join(f"{f['name']}: {f['description']}" for f in value["fields"])
    options = dict(text_or_documents=[lx.data.Document(text=d["text"], document_id=d["id"]) for d in value["documents"]], prompt_description=prompt, examples=example_objects, model_id=os.environ["LX_MODEL_ID"], max_workers=1, batch_length=1, max_char_buffer=2000, extraction_passes=1, fetch_urls=False, resolver_params={"suppress_parse_errors": False}, show_progress=False)
    if os.environ.get("LX_MODEL_URL"):
        options.update(model_url=os.environ["LX_MODEL_URL"], use_schema_constraints=False)
    result = lx.extract(**options)
    if isinstance(result, lx.data.AnnotatedDocument):
        result = [result]
    documents = [data_lib.annotated_document_to_dict(doc) for doc in result]
    if len(canonical(documents).encode()) > 750_000:
        raise RuntimeError("ResultTooLarge")
    return documents


class JobStore:
    def __init__(self, path):
        self.path = str(path)
        Path(self.path).parent.mkdir(parents=True, exist_ok=True)
        with self.connect() as db:
            db.execute("CREATE TABLE IF NOT EXISTS jobs(id TEXT PRIMARY KEY,input_json TEXT NOT NULL,status TEXT NOT NULL,result_json TEXT,message TEXT NOT NULL,created_at TEXT NOT NULL,updated_at TEXT NOT NULL)")
            db.execute("UPDATE jobs SET status='interrupted',message='服务重启，原任务不会自动重放。',updated_at=? WHERE status IN ('queued','running')", (now(),))

    def connect(self):
        db = sqlite3.connect(self.path, timeout=30)
        db.row_factory = sqlite3.Row
        return db

    def get(self, ident):
        with self.connect() as db:
            row = db.execute("SELECT * FROM jobs WHERE id=?", (ident,)).fetchone()
        if row is None:
            raise KeyError(ident)
        return {"id": row["id"], "status": row["status"], "message": row["message"], "result": json.loads(row["result_json"]) if row["result_json"] else None, "created_at": row["created_at"], "updated_at": row["updated_at"]}

    def create(self, ident, value):
        if not JOB_ID.fullmatch(ident):
            raise ValueError("Invalid job id")
        payload = canonical(validate_input(value))
        with self.connect() as db:
            db.execute("BEGIN IMMEDIATE")
            old = db.execute("SELECT input_json FROM jobs WHERE id=?", (ident,)).fetchone()
            if old:
                if old["input_json"] != payload:
                    raise ValueError("JobIdContentConflict")
                return False
            created = now()
            db.execute("INSERT INTO jobs VALUES(?,?,?,NULL,?,?,?)", (ident, payload, "queued", "等待抽取", created, created))
        return True

    def cancel(self, ident):
        self.get(ident)
        with self.connect() as db:
            db.execute("UPDATE jobs SET status='cancelled',message=?,updated_at=? WHERE id=? AND status NOT IN ('succeeded','failed','cancelled','interrupted')", ("已停止接收结果；已发出的模型请求可能仍在运行。", now(), ident))
        return self.get(ident)

    def execute(self, ident, engine=extract_with_langextract):
        with self.connect() as db:
            changed = db.execute("UPDATE jobs SET status='running',message='正在抽取',updated_at=? WHERE id=? AND status='queued'", (now(), ident)).rowcount
            row = db.execute("SELECT input_json FROM jobs WHERE id=?", (ident,)).fetchone()
        if not changed:
            return
        try:
            result = canonical(engine(json.loads(row["input_json"])))
            if len(result.encode()) > 750_000:
                raise RuntimeError("ResultTooLarge")
            with self.connect() as db:
                db.execute("UPDATE jobs SET status='succeeded',result_json=?,message='抽取完成，结果等待复核。',updated_at=? WHERE id=? AND status='running'", (result, now(), ident))
        except Exception:
            # Provider errors may contain request bodies or credentials. Never return them.
            with self.connect() as db:
                db.execute("UPDATE jobs SET status='failed',message='抽取失败，请检查模型配置、额度与输入；重试需要明确新建任务。',updated_at=? WHERE id=? AND status='running'", (now(), ident))


def make_handler(store, token, executor, engine=extract_with_langextract, ready=model_ready):
    class Handler(BaseHTTPRequestHandler):
        def log_message(self, format, *args):
            pass

        def send_json(self, status, value):
            payload = canonical(value).encode()
            self.send_response(status)
            self.send_header("Content-Type", "application/json; charset=utf-8")
            self.send_header("Cache-Control", "no-store")
            self.send_header("Content-Length", str(len(payload)))
            self.end_headers()
            self.wfile.write(payload)

        def authorized(self):
            header = self.headers.get("Authorization", "")
            return hmac.compare_digest(header.encode("utf-8"), ("Bearer " + token).encode("utf-8"))

        def process(self, method):
            if not self.authorized():
                return self.send_json(401, {"error": "Unauthorized"})
            try:
                if method == "GET" and self.path == "/health":
                    return self.send_json(200, {"engine": "langextract", "version": ENGINE_VERSION, "ready": ready()})
                match = re.fullmatch(r"/jobs/([0-9a-f-]{36})(/cancel)?", self.path, re.I)
                if not match or not JOB_ID.fullmatch(match[1]):
                    return self.send_json(404, {"error": "Not found"})
                ident = match[1]
                if method == "GET" and not match[2]:
                    return self.send_json(200, store.get(ident))
                if method not in {"PUT", "POST"}:
                    return self.send_json(405, {"error": "Method not allowed"})
                length = int(self.headers.get("Content-Length", "0"))
                if length < 0 or length > MAX_BODY:
                    return self.send_json(413, {"error": "Request too large"})
                value = json.loads(self.rfile.read(length))
                if method == "POST" and match[2]:
                    return self.send_json(200, store.cancel(ident))
                if method != "PUT" or match[2] or not isinstance(value, dict):
                    return self.send_json(400, {"error": "Invalid request"})
                if not ready():
                    return self.send_json(503, {"error": "Model not configured"})
                if store.create(ident, value.get("input")):
                    executor.submit(store.execute, ident, engine)
                return self.send_json(200, store.get(ident))
            except KeyError:
                return self.send_json(404, {"error": "Job not found"})
            except (ValueError, TypeError):
                return self.send_json(400, {"error": "Invalid input or job id conflict"})
            except Exception:
                return self.send_json(500, {"error": "Adapter operation failed"})

        def do_GET(self): self.process("GET")
        def do_PUT(self): self.process("PUT")
        def do_POST(self): self.process("POST")
    return Handler


def main():
    token = os.environ.get("LANGEXTRACT_SERVICE_TOKEN", "")
    if len(token) < 16:
        raise SystemExit("Set LANGEXTRACT_SERVICE_TOKEN to at least 16 characters.")
    store = JobStore(os.environ.get("LX_JOB_DATABASE", ".local/langextract-jobs.sqlite"))
    executor = ThreadPoolExecutor(max_workers=1)
    server = ThreadingHTTPServer(("127.0.0.1", int(os.environ.get("LX_SERVICE_PORT", "8767"))), make_handler(store, token, executor))
    print(f"LangExtract adapter on 127.0.0.1:{server.server_port}; model ready: {model_ready()}", flush=True)
    try: server.serve_forever()
    except KeyboardInterrupt: pass
    finally:
        server.server_close()
        executor.shutdown(wait=False, cancel_futures=True)

if __name__ == "__main__": main()
