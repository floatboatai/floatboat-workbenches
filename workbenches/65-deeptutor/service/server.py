"""Loopback adapter using the pinned, unmodified DeepTutor practice modules."""
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
import json
import math
from upstream.importing import preview, normalize_question
from upstream.answers import check_answer
from upstream.scheduler import schedule

COMMIT = "a31d82624c27d75f4e771d4fcb78dce16470b383"

def normalize(body):
    if not isinstance(body, dict) or not isinstance(body.get("text"), str) or len(body["text"]) > 350000:
        raise ValueError("题库文件需要小于350KB")
    kind = body.get("format")
    if kind not in {"json", "csv", "tsv"}:
        raise ValueError("支持JSON、CSV或TSV题库")
    result = preview(body["text"].encode(), "questions." + kind)
    if result["errors"]:
        raise ValueError("题库含有无效题目：" + "; ".join(f"第{e['row']}行 {e['message']}" for e in result["errors"][:8]))
    if len(result["questions"]) > 100 or len(json.dumps(result,ensure_ascii=False)) > 350000:
        raise ValueError("每份课程最多100题且规范化题库小于350KB")
    ids = [q["question_id"] for q in result["questions"]]
    if len(ids) != len(set(ids)):
        raise ValueError("题库包含重复题目，请先去重")
    return {"questions": result["questions"], "engine": "DeepTutor practice", "commit": COMMIT}

def check(body):
    if not isinstance(body, dict) or not isinstance(body.get("question"), dict) or not isinstance(body.get("answer"), str) or len(body["answer"]) > 5000:
        raise ValueError("答案或题目格式无效")
    question=normalize_question(body["question"])
    if body["question"].get("question_id") != question["question_id"]:
        raise ValueError("题目已变化，请重新导入规范化题库")
    return {"questionId":question["question_id"],"answer":body["answer"],"correct":check_answer(question,body["answer"])}

def review(body):
    result=check(body)
    state=body.get("state") or {}
    if not isinstance(state,dict):raise ValueError("复习状态无效")
    for key,value in state.items():
        if key not in {"interval_days","ease","streak","lapses","due_at","last_review_at","review_count","version"} or not isinstance(value,(int,float)) or isinstance(value,bool) or not math.isfinite(value):raise ValueError("复习状态无效")
    if state and (not 0 <= state.get("interval_days",1) <= 365 or not 1.3 <= state.get("ease",2.5) <= 3 or not all(0<=state.get(k,0)<=1000000 for k in ["streak","lapses","review_count","version"])):raise ValueError("复习状态范围无效")
    now=body.get("at")
    if not isinstance(now,(float,int)) or isinstance(now,bool) or not 946684800 <= now <= 4102444800:raise ValueError("复习时间无效")
    operation=body.get("id")
    if not isinstance(operation,str) or len(operation)!=36:raise ValueError("操作编号无效")
    result.update({"id":operation,"at":now,"rating":body.get("rating"),"state":schedule(state,body.get("rating"),now)})
    return result

class Handler(BaseHTTPRequestHandler):
    def reply(self,status,body):
        raw=json.dumps(body,ensure_ascii=False).encode();self.send_response(status);self.send_header("Content-Type","application/json; charset=utf-8");self.send_header("Content-Length",str(len(raw)));self.send_header("Cache-Control","no-store");self.end_headers();self.wfile.write(raw)
    def do_GET(self):
        if self.path=="/health":self.reply(200,{"ready":True,"engine":"DeepTutor practice","commit":COMMIT})
        else:self.reply(404,{"error":"Not found"})
    def do_POST(self):
        if self.headers.get("Origin"):return self.reply(403,{"error":"请通过工作台调用"})
        method={"/normalize":normalize,"/check":check,"/review":review}.get(self.path)
        if not method:return self.reply(404,{"error":"Not found"})
        try:
            size=int(self.headers.get("Content-Length",0))
            if not 0<size<=1200000:raise ValueError("请求超限")
            self.reply(200,method(json.loads(self.rfile.read(size))))
        except (ValueError,TypeError,KeyError) as e:self.reply(400,{"error":str(e)})
        except Exception:self.reply(500,{"error":"练习服务未完成，请检查题库格式后重试"})
    def log_message(self,*_):pass
if __name__=="__main__":
    import argparse
    parser=argparse.ArgumentParser();parser.add_argument("--port",type=int,default=8786);args=parser.parse_args();print(f"DeepTutor practice http://127.0.0.1:{args.port}",flush=True);ThreadingHTTPServer(("127.0.0.1",args.port),Handler).serve_forever()
