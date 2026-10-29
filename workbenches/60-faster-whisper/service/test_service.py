import hashlib
from pathlib import Path
import tempfile
import unittest
from server import Jobs, normalize_options

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

    def test_options_are_part_of_the_immutable_input(self):
        multi = Jobs(Path(self.tmp.name) / 'multi', 'small', 'int8', None)
        options = {'task': 'translate', 'word_timestamps': True, 'vad_filter': False, 'beam_size': 2,
                   'initial_prompt': '  梧桐路  ', 'hotwords': '', 'min_silence_duration_ms': 800,
                   'condition_on_previous_text': False}
        job = multi.create(self.id, self.audio, self.digest, 'zh', options)
        self.assertEqual(job['options']['initial_prompt'], '梧桐路')
        self.assertIsNone(job['options']['hotwords'])
        self.assertEqual(multi.create(self.id, self.audio, self.digest, 'zh', options)['options']['beam_size'], 2)
        with self.assertRaises(FileExistsError):
            multi.create(self.id, self.audio, self.digest, 'zh', {**options, 'beam_size': 5})
        self.assertEqual(multi.create('33333333-3333-4333-8333-333333333333', self.audio, self.digest, 'yue')['options'],
                         normalize_options(None))
    def test_options_reject_unknown_and_out_of_range_values(self):
        for bad in ({'temperature': 0}, {'beam_size': 0}, {'beam_size': True}, {'task': 'summarize'},
                    {'initial_prompt': 'x' * 801}, {'vad_filter': 'yes'}, {'min_silence_duration_ms': 50}):
            with self.assertRaises(ValueError):
                normalize_options(bad)
    def test_english_only_model_rejects_translation(self):
        with self.assertRaises(ValueError):
            self.store.create(self.id, self.audio, self.digest, 'en', {'task': 'translate'})

if __name__ == '__main__':
    unittest.main()
