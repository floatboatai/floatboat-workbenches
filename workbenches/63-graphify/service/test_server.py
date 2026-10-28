import unittest
from server import extract_graph, run_isolated

class ExtractionTests(unittest.TestCase):
    def test_actual_engine_extracts_calls(self):
        out=extract_graph({"name":"sample.py","code":"def normalize(x):\n    return x.strip()\n\ndef search(x):\n    return normalize(x)\n"})
        self.assertEqual(out["engine"],"graphifyy@0.9.97")
        self.assertTrue(any(l.get("relation")=="calls" for l in out["graph"]["links"]))
        self.assertEqual(out["graph"]["graph"]["graphify_version"],"0.9.97")
    def test_input_is_never_executed(self):
        out=extract_graph({"name":"sample.py","code":"raise RuntimeError('MUST NOT RUN')\n\ndef isolated():\n    return 7\n"})
        self.assertTrue(any("isolated" in n.get("label","") for n in out["graph"]["nodes"]))
    def test_isolated_workers_do_not_share_symbols(self):
        one=run_isolated({"name":"a.py","code":"def first():\n    return 1\n"})
        two=run_isolated({"name":"a.py","code":"def second():\n    return 2\n"})
        self.assertTrue(any("first" in n.get("label","") for n in one["graph"]["nodes"]))
        self.assertFalse(any("first" in n.get("label","") for n in two["graph"]["nodes"]))
    def test_traversal_and_empty_rejected(self):
        for body in [{"name":"../bad.py","code":"print(1)"},{"name":"bad.sh","code":"exit 1"},{"name":"a.py","code":""}]:
            with self.assertRaises(ValueError):extract_graph(body)
if __name__=="__main__":unittest.main()
