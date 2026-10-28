"""Exercise the pinned upstream serializer with real LangChain messages; no model inference."""
import json
from pathlib import Path
from langchain_core.messages import HumanMessage, AIMessage, ToolMessage
from deerflow_serialization import serialize_channel_values_for_api
ROOT=Path(__file__).resolve().parents[1]
brief='为城市步行导览准备交付报告：关注清晰的路标、可休息的路线和离线阅读。保留来源，列出需要实地确认的事项。'
report='''# 城市步行导览 · 交付草稿

## 项目目标

让初次来访的人在一小时内完成轻松、清晰的步行路线。

## 设计方向

- 在分岔位置提供一致的方向标记。
- 将休息点与无障碍替代路线放在同一张地图上。
- 离线资料保留关键路线说明和紧急联系入口。

## 待确认

路线长度、开放时间与现场通行条件需要实地核对。

## 示例材料

- [导览需求记录](https://example.org/research/walk-brief)
- [现场核查清单](https://example.org/research/site-checklist)
'''
messages=[HumanMessage(content=brief,id='brief-1'),AIMessage(content='先对照两份示例材料，再起草交付稿。',id='plan-1',tool_calls=[{'name':'web_search','args':{'query':'城市步行导览资料'},'id':'search-1','type':'tool_call'}]),ToolMessage(content=json.dumps({'results':[{'title':'导览需求记录 · 示例','url':'https://example.org/research/walk-brief','content':'来访者希望路线清晰、休息点明确。'},{'title':'现场核查清单 · 示例','url':'https://example.org/research/site-checklist','content':'路线长度、营业时间和通行条件需现场确认。'}]},ensure_ascii=False),tool_call_id='search-1',name='web_search',id='sources-1'),AIMessage(content=report,id='report-1')]
values=serialize_channel_values_for_api({'messages':messages,'title':'城市步行导览','todos':[{'content':'整理导览目标','status':'completed'},{'content':'对照来源材料','status':'completed'},{'content':'复核交付稿','status':'pending'}],'artifacts':['/mnt/user-data/outputs/walk-review.md'],'__pregel_test':'must be removed'})
assert '__pregel_test' not in values
assert values['messages'][0]['type']=='human'
assert values['messages'][2]['type']=='tool'
assert values['messages'][-1]['content']==report
native={'values':values,'next':[],'metadata':{'sample':True,'provenance':'Ordinary sample serialized by real DeerFlow code; not model output'},'checkpoint':{'checkpoint_id':'sample-checkpoint-1'},'checkpoint_id':'sample-checkpoint-1','parent_checkpoint_id':None,'created_at':'2026-10-28T04:00:00Z','tasks':[]}
(ROOT/'app/src/contracts/native-sample.json').write_text(json.dumps(native,ensure_ascii=False,indent=2)+'\n')
hidden=serialize_channel_values_for_api({'messages':[HumanMessage(content=[{'type':'text','text':'internal'},{'type':'image_url','image_url':{'url':'data:image/png;base64,AAAA'}}],additional_kwargs={'hide_from_ui':True})]})
assert len(hidden['messages'][0]['content'])==1
print(json.dumps({'officialSerializer':True,'langchainCore':'1.4.9','fixtureMessages':len(values['messages']),'hiddenDataImageStripping':True,'realModelInference':False}))
