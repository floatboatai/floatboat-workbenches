import hashlib
from pathlib import Path
import tempfile
import unittest
from server import Jobs

class DurableJobsTest(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.store = Jobs(Path(self.tmp.name), 'tiny.en', 'int8', None)
        self.id = '11111111-1111-4111-8111-111111111111'
        self.audio = b'RIFF' + b'\0' * 50
        self.digest = hashlib.sha256(self.audio).hexdigest()
    def tearDown(self):
        self.tmp.cleanup()
    def test_duplicate_and_conflict(self):
        self.store.create(self.id, self.audio, self.digest, 'en')
        self.assertEqual(self.store.create(self.id, self.audio, self.digest, 'en')['status'], 'queued')
        with self.assertRaises(FileExistsError):
            self.store.create(self.id, self.audio, self.digest, 'auto')
    def test_restart_and_cancel(self):
        self.store.create(self.id, self.audio, self.digest, 'en')
        with self.store.connect() as db:
            db.execute("UPDATE jobs SET status='running'")
        reopened = Jobs(Path(self.tmp.name), 'tiny.en', 'int8', None)
        self.assertEqual(reopened.read(self.id)['status'], 'interrupted')
        second = '22222222-2222-4222-8222-222222222222'
        reopened.create(second, self.audio, self.digest, 'en')
        self.assertEqual(reopened.cancel(second)['status'], 'cancelled')
    def test_model_snapshot_survives_configuration_change(self):
        self.store.create(self.id, self.audio, self.digest, 'en')
        reopened = Jobs(Path(self.tmp.name), 'large-v3', 'float32', None)
        self.assertTrue(reopened.read(self.id)['model'].startswith('tiny.en /'))
    def test_reject_invalid_digest(self):
        with self.assertRaises(ValueError):
            self.store.create(self.id, self.audio, 'bad', 'en')

if __name__ == '__main__':
    unittest.main()
