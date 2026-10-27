"""Adapter contract tests; fake engine outputs are not real model acceptance."""
import json
import tempfile
import threading
import unittest
import uuid
from concurrent.futures import ThreadPoolExecutor
from http.server import ThreadingHTTPServer
from urllib.request import Request, urlopen
from urllib.error import HTTPError
from pathlib import Path
from server import JobStore, make_handler, validate_input

INPUT = {"documents":[{"id":"doc1","text":"🌿 林晓采购24套灯具。"}],"prompt":"提取数量。","fields":[{"name":"数量","description":"数量与单位"}],"examples":[{"text":"采购12套。","extractions":[{"extraction_class":"数量","extraction_text":"12套"}]}]}

class Contracts(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.path = Path(self.temp.name)/"jobs.sqlite"
        self.store = JobStore(self.path)
        self.id = str(uuid.uuid4())
    def tearDown(self): self.temp.cleanup()
    def test_same_id_same_input_is_idempotent(self):
        self.assertTrue(self.store.create(self.id, INPUT))
        self.assertFalse(self.store.create(self.id, INPUT))
        with self.assertRaises(ValueError): self.store.create(self.id, {**INPUT,"prompt":"changed"})
    def test_restart_does_not_replay_queued_or_running_jobs(self):
        self.store.create(self.id, INPUT)
        reopened = JobStore(self.path)
        self.assertEqual(reopened.get(self.id)["status"],"interrupted")
        self.assertFalse(reopened.create(self.id, INPUT))
    def test_contract_engine_result_is_persisted(self):
        self.store.create(self.id, INPUT)
        result=[{"document_id":"doc1","text":INPUT["documents"][0]["text"],"extractions":[]}]
        self.store.execute(self.id, lambda value:result)
        self.assertEqual(self.store.get(self.id)["result"],result)
        self.assertEqual(JobStore(self.path).get(self.id)["status"],"succeeded")
    def test_cancelled_job_cannot_start_and_running_result_is_discarded(self):
        self.store.create(self.id, INPUT);self.store.cancel(self.id)
        def forbidden(value):raise AssertionError("must not execute")
        self.store.execute(self.id, forbidden)
        self.assertEqual(self.store.get(self.id)["status"],"cancelled")
        other=str(uuid.uuid4());self.store.create(other,INPUT)
        def cancelling(value):self.store.cancel(other);return [{"fake":"contract"}]
        self.store.execute(other,cancelling)
        self.assertIsNone(self.store.get(other)["result"])
        self.assertEqual(self.store.get(other)["status"],"cancelled")
    def test_provider_error_does_not_expose_credentials(self):
        self.store.create(self.id, INPUT)
        def failing(value):raise RuntimeError("secret-provider-token-123")
        self.store.execute(self.id, failing)
        self.assertEqual(self.store.get(self.id)["status"],"failed")
        self.assertNotIn("secret",json.dumps(self.store.get(self.id)))
    def test_input_limits_and_types(self):
        for value in [None,{**INPUT,"examples":[]},{**INPUT,"documents":[{"id":"x","text":""}]},{**INPUT,"documents":[INPUT["documents"][0]]*2}]:
            with self.assertRaises(ValueError):validate_input(value)
    def test_http_auth_readiness_and_unknown_job(self):
        executor=ThreadPoolExecutor(max_workers=1)
        server=ThreadingHTTPServer(("127.0.0.1",0),make_handler(self.store,"contract-test-token",executor,ready=lambda:False))
        thread=threading.Thread(target=server.serve_forever,daemon=True);thread.start()
        base=f"http://127.0.0.1:{server.server_port}"
        try:
            with self.assertRaises(HTTPError) as context:urlopen(base+"/health")
            self.assertEqual(context.exception.code,401)
            headers={"Authorization":"Bearer contract-test-token"}
            with urlopen(Request(base+"/health",headers=headers)) as response:self.assertFalse(json.load(response)["ready"])
            with self.assertRaises(HTTPError) as context:urlopen(Request(base+"/jobs/"+self.id,headers=headers))
            self.assertEqual(context.exception.code,404)
            with self.assertRaises(HTTPError) as context:urlopen(Request(base+"/jobs/"+self.id,headers=headers,method="PUT",data=json.dumps({"input":INPUT}).encode()))
            self.assertEqual(context.exception.code,503)
        finally:server.shutdown();server.server_close();executor.shutdown(wait=True)

if __name__=="__main__":unittest.main()
