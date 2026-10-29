"""Loopback adapter for pinned Graphify AST extraction (single file or a whole file set). Source is parsed, never run."""
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
MAX_BODY = 16 * 1024 * 1024
MAX_FILES = 3000
CODE_SUFFIXES = {".py", ".pyi", ".js", ".mjs", ".cjs", ".jsx", ".ts", ".mts", ".cts", ".tsx", ".go", ".rs", ".java",
                 ".c", ".h", ".cc", ".cpp", ".cxx", ".hpp", ".cs", ".rb", ".php", ".kt", ".kts", ".scala", ".swift", ".lua"}
PATH_RE = re.compile(r"[^\x00/\\][^\x00\\]{0,399}")


def _files(payload: dict) -> list[tuple[str, str]]:
    """单文件（name/code，旧接口）或多文件（files: [{path, code}]）。"""
    if "files" not in payload:
        name, code = payload.get("name"), payload.get("code")
        if not isinstance(name, str) or not re.fullmatch(r"[A-Za-z0-9_-]{1,80}\.(py|js|ts)", name):
            raise ValueError("文件名须为简单的 .py、.js 或 .ts 文件名")
        return [(name, code)]
    files = payload.get("files")
    if not isinstance(files, list) or not files or len(files) > MAX_FILES:
        raise ValueError(f"需要 1–{MAX_FILES} 个文件")
    out, seen = [], set()
    for f in files:
        path, code = (f.get("path"), f.get("code")) if isinstance(f, dict) else (None, None)
        if not isinstance(path, str) or not PATH_RE.fullmatch(path) or any(p in ("", ".", "..") for p in path.split("/")):
            raise ValueError("文件路径无效")
        if Path(path).suffix.lower() not in CODE_SUFFIXES:
            raise ValueError(f"不支持的代码文件：{path}")
        if path in seen:
            raise ValueError(f"路径重复：{path}")
        seen.add(path)
        out.append((path, code))
    return out


def extract_graph(payload: object) -> dict:
    if not isinstance(payload, dict):
        raise ValueError("请求必须是对象")
    files = _files(payload)
    total = 0
    for _, code in files:
        if not isinstance(code, str) or not code.strip():
            raise ValueError("源码不能为空")
        total += len(code)
    if total > MAX_BODY:
        raise ValueError("源码总量超过上限")
    # Graphify resets module-level resolver caches, so run one extraction at a time.
    with LOCK, TemporaryDirectory(prefix="graphify-workbench-") as td:
        root = Path(td)
        paths = []
        for rel, code in files:
            target = (root / rel).resolve()
            if root.resolve() not in target.parents:
                raise ValueError("文件路径无效")
            target.parent.mkdir(parents=True, exist_ok=True)
            target.write_text(code, encoding="utf-8")
            paths.append(target)
        raw = extract(paths, cache_root=root, root=root, parallel=False)
        graph = build_from_json(raw, directed=True, root=root)
        if len(graph) > 8000 or graph.number_of_edges() > 40000:
            raise ValueError("图谱超过8000个节点或40000条关系，请按目录拆分")
        to_json(graph, {}, str(root / "graph.json"))
        result = json.loads((root / "graph.json").read_text())
        prefix = str(root.resolve()) + "/"
        for item in result.get("nodes", []) + result.get("links", []):
            sf = item.get("source_file")
            if isinstance(sf, str) and sf.startswith(prefix):
                item["source_file"] = sf[len(prefix):]
        digest = hashlib.sha256()
        for rel, code in files:
            digest.update((rel + "\n" + code + "\n").encode())
        if "files" not in payload:
            digest = hashlib.sha256((files[0][0] + "\n" + files[0][1]).encode())
        return {"graph": result, "engine": f"graphifyy@{version('graphifyy')}", "inputHash": digest.hexdigest()}

def run_isolated(payload: object) -> dict:
    try:
        completed = subprocess.run([sys.executable, str(Path(__file__).resolve()), "--worker"],
            input=json.dumps(payload), text=True, capture_output=True, timeout=110, check=True)
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
            self.reply(200, {"ready": True, "engine": "graphifyy", "version": version("graphifyy"), "multiFile": True})
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
                result = extract_graph(json.loads(sys.stdin.read(MAX_BODY * 2)))
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
