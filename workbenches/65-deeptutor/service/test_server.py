import json
import unittest
from server import normalize,check,review
from upstream.scheduler import day_bounds

ROW={"question":"哪个类型可以去重？","question_type":"single_choice","options":{"A":"list","B":"set"},"correct_answer":"B","explanation":"集合元素唯一","tags":["集合"]}
class PracticeTests(unittest.TestCase):
 def question(self):return normalize({"text":json.dumps([ROW]),"format":"json"})["questions"][0]
 def test_real_json_parser_assigns_stable_identity(self):self.assertEqual(self.question()["question_id"],self.question()["question_id"])
 def test_real_csv_parser_supports_chinese_headers(self):
  q=normalize({"format":"csv","text":"题目,题型,A,B,答案\n哪一个正确,单选,一,二,B\n"})["questions"][0];self.assertEqual(q["correct_answer"],"B")
 def test_partial_invalid_bank_is_not_silently_imported(self):
  with self.assertRaises(ValueError):normalize({"format":"json","text":json.dumps([ROW,{"question":"missing answer"}])})
 def test_upstream_objective_grader(self):
  q=self.question();self.assertTrue(check({"question":q,"answer":"B"})["correct"]);self.assertFalse(check({"question":q,"answer":"A"})["correct"])
 def test_subjective_grading_remains_self_assessment(self):
  q=normalize({"format":"json","text":json.dumps([{**ROW,"question_type":"short_answer","options":{},"correct_answer":"说明集合性质"}])})["questions"][0];self.assertIsNone(check({"question":q,"answer":"我的解释"})["correct"])
 def test_pure_review_replay_is_stable(self):
  body={"id":"00000000-0000-4000-8000-000000000001","question":self.question(),"answer":"B","rating":"good","at":1793156400,"state":{}};a=review(body);self.assertEqual(a,review(body));self.assertEqual(a["state"]["review_count"],1);self.assertEqual(a["state"]["interval_days"],3)
 def test_changed_question_identity_is_rejected(self):
  q=self.question();q["question"]="改变的题目"
  with self.assertRaises(ValueError):check({"question":q,"answer":"B"})
 def test_upstream_day_bounds_respects_dst(self):
  from datetime import datetime
  from zoneinfo import ZoneInfo
  now=datetime(2026,11,1,12,tzinfo=ZoneInfo('America/New_York')).timestamp();start,end=day_bounds('America/New_York',now);self.assertEqual(end-start,25*3600)
if __name__=='__main__':unittest.main()
