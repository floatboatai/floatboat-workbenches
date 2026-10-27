"""Loopback faster-whisper job service; model inference stays outside the workbench.

Only this service imports faster_whisper/CTranslate2. SQLite keeps immutable job
inputs and terminal results; restarted in-flight inference is marked interrupted.
"""
from __future__ import annotations
import argparse
import hashlib
import hmac
from importlib.metadata import version
import json
import os
from pathlib import Path
import re
import sqlite3
import threading
import time
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import parse_qs, urlsplit

MAX_AUDIO = 40 * 1024 * 1024
LANGUAGES = {'auto', 'zh', 'en', 'ja', 'ko', 'fr', 'de', 'es'}
JOB = re.compile(r'^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$', re.I)


class Jobs:
    def __init__(self, directory: Path, model: str, compute: str, cache: str | None):
        self.directory = directory
        directory.mkdir(parents=True, exist_ok=True)
        self.path = directory / 'jobs.sqlite'
        self.model_name, self.compute, self.cache = model, compute, cache
        self.model_label = Path(model).name if os.path.isabs(model) else model
        self.engine_version = version('faster-whisper')
        self.model = None
        with self.connect() as db:
            db.executescript('''CREATE TABLE IF NOT EXISTS jobs(
              id TEXT PRIMARY KEY, digest TEXT NOT NULL, language TEXT NOT NULL,
              status TEXT NOT NULL, created REAL NOT NULL, updated REAL NOT NULL,
              error TEXT NOT NULL DEFAULT '', result TEXT, model TEXT NOT NULL, compute TEXT NOT NULL, engine TEXT NOT NULL);
              UPDATE jobs SET status='interrupted', error='Service restarted during inference; create a new run to retry.' WHERE status='running';''')
            columns = {row['name'] for row in db.execute('PRAGMA table_info(jobs)')}
            for column in ('model', 'compute', 'engine'):
                if column not in columns:
                    db.execute(f"ALTER TABLE jobs ADD COLUMN {column} TEXT NOT NULL DEFAULT 'legacy-unknown'")
        self.wake = threading.Event()

    def connect(self):
        db = sqlite3.connect(self.path, timeout=15)
        db.row_factory = sqlite3.Row
        return db

    def read(self, ident):
        with self.connect() as db:
            row = db.execute('SELECT * FROM jobs WHERE id=?', (ident,)).fetchone()
        if row is None:
            raise KeyError('Job not found')
        return {'id': ident, 'status': row['status'], 'model': row['model'] + ' / faster-whisper ' + row['engine'],
                'audioSha256': row['digest'], 'language': row['language'],
                'error': row['error'], 'segments': json.loads(row['result']) if row['result'] else None}

    def create(self, ident, audio, digest, language):
        if self.model_name.endswith('.en') and language not in ('auto', 'en'):
            raise ValueError('This English-only model requires English or automatic language')
        if not JOB.fullmatch(ident) or language not in LANGUAGES:
            raise ValueError('Invalid job or language')
        if not 12 <= len(audio) <= MAX_AUDIO or hashlib.sha256(audio).hexdigest() != digest:
            raise ValueError('Audio length or digest invalid')
        with self.connect() as db:
            db.execute('BEGIN IMMEDIATE')
            row = db.execute('SELECT digest, language FROM jobs WHERE id=?', (ident,)).fetchone()
            if row:
                if row['digest'] != digest or row['language'] != language:
                    raise FileExistsError('Job ID already belongs to another input')
            else:
                # File is committed before the durable queue entry. Names never come from a client path.
                temp = self.directory / f'{ident}.part'
                temp.write_bytes(audio)
                temp.replace(self.directory / f'{ident}.audio')
                now = time.time()
                db.execute('INSERT INTO jobs(id,digest,language,status,created,updated,model,compute,engine) VALUES(?,?,?,?,?,?,?,?,?)',
                           (ident, digest, language, 'queued', now, now, self.model_label, self.compute, self.engine_version))
        self.wake.set()
        return self.read(ident)

    def cancel(self, ident):
        self.read(ident)
        with self.connect() as db:
            db.execute("UPDATE jobs SET status='cancelled',updated=? WHERE id=? AND status IN ('queued','running')", (time.time(), ident))
        return self.read(ident)

    def worker(self):
        while True:
            with self.connect() as db:
                row = db.execute("SELECT * FROM jobs WHERE status='queued' ORDER BY created LIMIT 1").fetchone()
                if row:
                    db.execute("UPDATE jobs SET status='running',updated=? WHERE id=? AND status='queued'", (time.time(), row['id']))
            if row is None:
                self.wake.wait(2)
                self.wake.clear()
                continue
            ident = row['id']
            try:
                if (row['model'], row['compute'], row['engine']) != (self.model_label, self.compute, self.engine_version):
                    raise ValueError('Model configuration changed since submission')
                if self.model is None:
                    from faster_whisper import WhisperModel
                    self.model = WhisperModel(self.model_name, device='cpu', compute_type=self.compute,
                                              cpu_threads=4, download_root=self.cache)
                if self.read(ident)['status'] == 'cancelled':
                    continue
                if not self.model.model.is_multilingual and row['language'] not in ('auto', 'en'):
                    raise ValueError('English-only model cannot transcribe requested language')
                segments, _ = self.model.transcribe(str(self.directory / f'{ident}.audio'),
                    language=None if row['language'] == 'auto' else row['language'],
                    beam_size=3, vad_filter=False, word_timestamps=False)
                output = []
                for segment in segments:
                    if self.read(ident)['status'] == 'cancelled':
                        break
                    if segment.end > segment.start:
                        output.append({'start': segment.start, 'end': segment.end, 'text': segment.text})
                    if len(output) > 1200 or segment.end > 21600:
                        raise ValueError('Transcript exceeds workbench limits')
                encoded = json.dumps(output, ensure_ascii=False)
                if len(encoded.encode()) > 700000:
                    raise ValueError('Transcript exceeds 700KB')
                with self.connect() as db:
                    db.execute("UPDATE jobs SET status='completed',result=?,updated=? WHERE id=? AND status='running'", (encoded, time.time(), ident))
            except Exception as error:
                # Errors returned to clients never include local paths, tokens or remote URLs.
                reason = 'Inference failed; check service logs/model availability and audio format.'
                print(f'job {ident}: {type(error).__name__}', flush=True)
                with self.connect() as db:
                    db.execute("UPDATE jobs SET status='failed',error=?,updated=? WHERE id=? AND status='running'", (reason, time.time(), ident))


def handler_for(jobs: Jobs, token: str):
    class Handler(BaseHTTPRequestHandler):
        server_version = 'WhisperJobs/1'
        def log_message(self, *_):
            pass

        def reply(self, status, payload):
            body = json.dumps(payload, ensure_ascii=False).encode()
            self.send_response(status)
            self.send_header('Content-Type', 'application/json; charset=utf-8')
            self.send_header('Content-Length', str(len(body)))
            self.send_header('Cache-Control', 'no-store')
            self.end_headers()
            self.wfile.write(body)

        def allowed(self):
            host = urlsplit('http://' + self.headers.get('Host', '')).hostname
            if not token and host not in ('127.0.0.1', 'localhost', '::1'):
                self.reply(403, {'error': 'Unexpected host'})
                return False
            if self.headers.get('Origin'):
                self.reply(403, {'error': 'Browser access is not enabled; use the workbench server'})
                return False
            supplied = self.headers.get('Authorization', '')
            if token and not hmac.compare_digest(supplied, 'Bearer ' + token):
                self.reply(401, {'error': 'Authentication required'})
                return False
            return True

        def process(self):
            if not self.allowed():
                return
            path = urlsplit(self.path)
            try:
                if self.command == 'GET' and path.path == '/health':
                    return self.reply(200, {'engine': 'faster-whisper', 'model': jobs.model_label})
                pieces = path.path.strip('/').split('/')
                if len(pieces) not in (3, 4) or pieces[:2] != ['v1', 'jobs'] or not JOB.fullmatch(pieces[2]):
                    return self.reply(404, {'error': 'Unknown endpoint'})
                ident = pieces[2]
                if self.command == 'GET' and len(pieces) == 3:
                    return self.reply(200, jobs.read(ident))
                if self.command == 'POST' and pieces[3:] == ['cancel']:
                    return self.reply(200, jobs.cancel(ident))
                if self.command == 'PUT' and len(pieces) == 3:
                    length = int(self.headers.get('Content-Length', '0'))
                    if length < 12 or length > MAX_AUDIO:
                        return self.reply(413, {'error': 'Audio must be at most 40MB'})
                    self.connection.settimeout(30)
                    audio = self.rfile.read(length)
                    result = jobs.create(ident, audio, self.headers.get('X-Audio-Sha256', ''),
                                         parse_qs(path.query).get('language', ['auto'])[0])
                    return self.reply(202, result)
                return self.reply(405, {'error': 'Method not allowed'})
            except KeyError:
                self.reply(404, {'error': 'Job not found'})
            except FileExistsError:
                self.reply(409, {'error': 'Job ID already belongs to another input'})
            except (ValueError, TimeoutError):
                self.reply(400, {'error': 'Invalid request or incomplete audio'})
            except Exception:
                self.reply(500, {'error': 'Service could not complete the request'})
        do_GET = process
        do_PUT = process
        do_POST = process
    return Handler


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--data', type=Path, required=True)
    parser.add_argument('--model', default='tiny')
    parser.add_argument('--cache', default=None)
    parser.add_argument('--compute', default='int8', choices=['int8', 'float32'])
    parser.add_argument('--port', type=int, default=8768)
    parser.add_argument('--host', default='127.0.0.1')
    args = parser.parse_args()
    token = os.environ.get('FASTER_WHISPER_TOKEN', '')
    if args.host not in ('127.0.0.1', 'localhost', '::1') and not token:
        parser.error('Non-loopback binding requires FASTER_WHISPER_TOKEN')
    jobs = Jobs(args.data, args.model, args.compute, args.cache)
    threading.Thread(target=jobs.worker, daemon=True).start()
    print(f'faster-whisper service listening on {args.host}:{args.port}; model={args.model}', flush=True)
    ThreadingHTTPServer((args.host, args.port), handler_for(jobs, token)).serve_forever()

if __name__ == '__main__':
    main()
