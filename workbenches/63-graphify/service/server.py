"""Loopback adapter for pinned Graphify AST extraction. Source is parsed, never run."""
from __future__ import annotations
import hashlib
import json
import re
import threading
import subprocess
import sys
import io
from contextlib import redirect_stdout
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from tempfile import TemporaryDirectory
from graphify.extract import extract
from graphify.build import build_from_json
from graphify.export import to_json
from importlib.metadata import version

LOCK = threading.Lock()
SLOTS = threading.BoundedSemaphore(2)
MAX_BODY = 260000

def extract_graph(payload: object) -> dict:
    if not isinstance(payload, dict):
        raise ValueError("请求必须是对象")
    name, code = payload.get("name"), payload.get("code")
    if not isinstance(name, str) or not re.fullmatch(r"[A-Za-z0-9_-]{1,80}\.(py|js|ts)", name):
        raise ValueError("文件名须为简单的 .py、.js 或 .ts 文件名")
    if not isinstance(code, str) or not code.strip() or len(code) > 80000:
        raise ValueError("源码需要1–80000个字符")
    # Graphify resets module-level resolver caches, so run one extraction at a time.
    with LOCK, TemporaryDirectory(prefix="graphify-workbench-") as td:
        root = Path(td)
        source = root / name
        source.write_text(code, encoding="utf-8")
        raw = extract([source], cache_root=root, root=root, parallel=False)
        graph = build_from_json(raw, directed=True, root=root)
        if len(graph) > 400 or graph.number_of_edges() > 1600:
            raise ValueError("图谱超过400个节点或1600条关系，请拆分文件")
        to_json(graph, {}, str(root / "graph.json"))
        result = json.loads((root / "graph.json").read_text())
        return {"graph": result, "engine": f"graphifyy@{version('graphifyy')}",
                "inputHash": hashlib.sha256((name + "\n" + code).encode()).hexdigest()}

def run_isolated(payload: object) -> dict:
    try:
        completed = subprocess.run([sys.executable, str(Path(__file__).resolve()), "--worker"],
            input=json.dumps(payload), text=True, capture_output=True, timeout=25, check=True)
        reply = json.loads(completed.stdout)
        if not reply.get("ok"):
            raise ValueError(reply.get("error", "提取失败"))
        return reply["result"]
    except (subprocess.SubprocessError, json.JSONDecodeError):
        raise ValueError("Graphify提取超时或失败，请简化源码") from None

class Handler(BaseHTTPRequestHandler):
    def reply(self, status: int, body: dict):
        raw = json.dumps(body, ensure_ascii=False).encode()
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(raw)))
        self.send_header("Cache-Control", "no-store")
        self.end_headers()
        self.wfile.write(raw)
    def do_GET(self):
        if self.path == "/health":
            self.reply(200, {"ready": True, "engine": "graphifyy", "version": version("graphifyy")})
        else:
            self.reply(404, {"error": "Not found"})
    def do_POST(self):
        if self.path != "/extract":
            return self.reply(404, {"error": "Not found"})
        if self.headers.get("Origin"):
            return self.reply(403, {"error": "请通过工作台服务调用"})
        try:
            length = int(self.headers.get("Content-Length", "0"))
            if length < 1 or length > MAX_BODY:
                raise ValueError("请求大小超限")
            body = json.loads(self.rfile.read(length))
            if not SLOTS.acquire(blocking=False):
                return self.reply(503, {"error": "已有提取任务，请稍后重试"})
            try:
                self.reply(200, run_isolated(body))
            finally:
                SLOTS.release()
        except (ValueError, UnicodeError) as error:
            self.reply(400, {"error": str(error)})
        except Exception:
            self.reply(500, {"error": "Graphify提取失败，请检查语法或简化源码"})
    def log_message(self, *_):
        pass

if __name__ == "__main__":
    if "--worker" in sys.argv:
        try:
            with redirect_stdout(io.StringIO()):
                result = extract_graph(json.loads(sys.stdin.read(MAX_BODY + 1)))
            print(json.dumps({"ok": True, "result": result}, ensure_ascii=False))
        except ValueError as error:
            print(json.dumps({"ok": False, "error": str(error)}, ensure_ascii=False))
        except Exception:
            print(json.dumps({"ok": False, "error": "Graphify提取失败，请检查语法或简化源码"}, ensure_ascii=False))
        sys.exit(0)
    import argparse
    parser = argparse.ArgumentParser()
    parser.add_argument("--port", type=int, default=8781)
    args = parser.parse_args()
    print(f"Graphify adapter http://127.0.0.1:{args.port}", flush=True)
    ThreadingHTTPServer(("127.0.0.1", args.port), Handler).serve_forever()
