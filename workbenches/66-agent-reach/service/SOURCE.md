# 固定上游与适配边界

Agent-Reach 1.6.0，MIT。

- 上游提交：https://github.com/Panniantong/Agent-Reach/tree/14c213405669414492bda0f8d52cc6531d062c45
- 安装锁：requirements.lock.txt固定git SHA与传递依赖版本。
- 服务直接导入上游channels/github.py、channels/web.py、channels/v2ex.py和runtime/result.py，不修改这些模块。
- GitHub调用原生_read/_search，但将HTTP读取函数替换为匿名urllib REST，避免运行gh或读取Config凭据。
- Web调用_jina_read，V2EX调用公开_api_hot/_api_read/_api_node；没有会话初始化、登录、安装、浏览器访问或远端写操作。
- 本服务添加输入和响应容量、并发上限、loopback监听、浏览器Origin拒绝以及查询hash绑定。渠道正文仍是上游解析结果。
- 许可副本位于../app/notices/agent-reach-LICENSE.txt，随工作台源码包保留。
