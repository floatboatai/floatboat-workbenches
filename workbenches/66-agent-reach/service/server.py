"""Read-only Agent-Reach core adapter: no setup/login/browser-session access."""
from __future__ import annotations
from http.server import BaseHTTPRequestHandler,ThreadingHTTPServer
import hashlib
import json
import re
import time
import threading
import urllib.request
import urllib.error
from agent_reach.channels.github import GitHubChannel
from agent_reach.channels.v2ex import V2EXChannel
from agent_reach.channels.web import WebChannel
from agent_reach.runtime.result import envelope,classify,ReachError,BAD_INPUT,NOT_FOUND,RATE_LIMITED

COMMIT='14c213405669414492bda0f8d52cc6531d062c45'
SLOTS=threading.BoundedSemaphore(2)

def public_github(path,timeout,accept='application/vnd.github+json'):
    if not path.startswith('/') or '\\' in path:raise ValueError('Invalid GitHub API path')
    # Deliberately use anonymous public REST. Do not invoke gh or Config(), which
    # could read the user's existing credentials. Upstream channel parsing is unchanged.
    req=urllib.request.Request('https://api.github.com'+path,headers={'User-Agent':'floatboat-agent-reach','Accept':accept})
    try:
        with urllib.request.urlopen(req,timeout=timeout) as response:raw=response.read(800001)
    except urllib.error.HTTPError as e:
        if e.code==404:raise ReachError(NOT_FOUND,'公开来源不存在') from None
        if e.code==429 or (e.code==403 and e.headers.get('X-RateLimit-Remaining')=='0'):raise ReachError(RATE_LIMITED,'公开接口达到限额，请稍后重试') from None
        raise
    if len(raw)>800000:raise ValueError('来源响应超过800KB')
    return raw

def collect(payload):
    if not isinstance(payload,dict):raise ValueError('请求无效')
    channel,action,query=payload.get('channel'),payload.get('action'),payload.get('query')
    if not isinstance(query,str) or len(query)>2000:raise ValueError('请输入2000字符以内的查询或链接')
    allowed={'github':{'read','search'},'web':{'read'},'v2ex':{'hot','read','node'}}
    if channel not in allowed or action not in allowed[channel]:raise ReachError(BAD_INPUT,'本工作台仅接入公开GitHub、网页及V2EX渠道')
    start=time.monotonic()
    try:
        if channel=='github':
            items=GitHubChannel._read(public_github,query,24) if action=='read' else GitHubChannel._search(public_github,query,5,24)
            backend='github-public-api'
        elif channel=='web':items=WebChannel()._jina_read(target=query,timeout=25);backend='jina'
        else:
            c=V2EXChannel();backend='v2ex-api'
            if action=='hot':items=c._api_hot(limit=5,timeout=24)
            elif action=='read':items=c._api_read(target=query,timeout=24)
            else:
                if not re.fullmatch('[a-zA-Z0-9_-]{1,80}',query):raise ValueError('节点名称只允许字母、数字、连字符和下划线')
                items=c._api_node(node_name=query,limit=5,timeout=24)
        result=envelope(channel=channel,action=action,backend=backend,items=items,elapsed_ms=int((time.monotonic()-start)*1000))
    except Exception as error:
        result=envelope(channel=channel,action=action,error=classify(error),elapsed_ms=int((time.monotonic()-start)*1000))
    if len(json.dumps(result,ensure_ascii=False).encode())>500000:raise ValueError('采集结果超过500KB，请选择更小的来源')
    fingerprint=hashlib.sha256((channel+'\n'+action+'\n'+query).encode()).hexdigest()
    return {'envelope':result,'inputHash':fingerprint,'commit':COMMIT}

class Handler(BaseHTTPRequestHandler):
    def reply(self,status,body):
        raw=json.dumps(body,ensure_ascii=False).encode();self.send_response(status);self.send_header('Content-Type','application/json; charset=utf-8');self.send_header('Content-Length',str(len(raw)));self.send_header('Cache-Control','no-store');self.end_headers();self.wfile.write(raw)
    def do_GET(self):
        if self.path=='/health':self.reply(200,{'ready':True,'engine':'Agent-Reach','version':'1.6.0','commit':COMMIT,'channels':['github','web','v2ex']})
        else:self.reply(404,{'error':'Not found'})
    def do_POST(self):
        if self.path!='/collect':return self.reply(404,{'error':'Not found'})
        if self.headers.get('Origin'):return self.reply(403,{'error':'请通过工作台服务调用'})
        if not SLOTS.acquire(blocking=False):return self.reply(503,{'error':'已有采集任务，请稍后重试'})
        try:
            length=int(self.headers.get('Content-Length',0))
            if not 0<length<=12000:raise ValueError('请求超限')
            self.reply(200,collect(json.loads(self.rfile.read(length))))
        except (ValueError,ReachError) as e:self.reply(400,{'error':str(e)[:1000]})
        except Exception:self.reply(500,{'error':'采集服务未完成，请稍后检查来源状态'})
        finally:SLOTS.release()
    def log_message(self,*_):pass
if __name__=='__main__':
    import argparse
    parser=argparse.ArgumentParser();parser.add_argument('--port',type=int,default=8783);args=parser.parse_args();print(f'Agent-Reach public adapter http://127.0.0.1:{args.port}',flush=True);ThreadingHTTPServer(('127.0.0.1',args.port),Handler).serve_forever()
