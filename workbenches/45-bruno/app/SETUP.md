# HTTP 执行范围

本工作台无需账号或秘密即可运行。HTTP 从工作台 Node 服务发出，只在点击「发送」（或 ⌘/Ctrl+Enter）时产生；刷新、导入、恢复、自动保存不会发送或重发。

工作台进程同时在 127.0.0.1 的随机端口启动一个本机回声服务，示例环境「本机回声」的 `baseUrl` 为 `{{$localEcho}}`。它只回显收到的请求，不转发、不存储。导出到 Bruno 桌面版时该变量无法解析，把环境里的 `baseUrl` 改成你的服务地址即可。

支持：GET/POST/PUT/PATCH/DELETE/HEAD/OPTIONS；Query 与 `/:path` 参数；请求头；none/json/text/xml/form-urlencoded/multipart 文本字段/GraphQL 正文；none/inherit/Bearer/Basic/API Key 认证；集合、文件夹与请求级 headers/vars/auth 继承；环境变量与秘密变量；vars:post-response；声明式 assert。

不执行：pre/post-request 脚本、tests、其他认证模式、multipart 文件、代理与客户端证书（bruno.json 中的这些设置原样保留并提示）、gRPC/WebSocket。无 eval、不读取系统环境变量、不转发浏览器 Cookie。

秘密：环境里标为「秘密」的值只留在页面内存，刷新后需重新填写；不写入 .bru、自动保存、导出或执行记录。其他手动输入（含直接写在 Auth 里的明文 token）与响应历史属于工作稿和完整工程导出范围；请把凭据写成 `{{变量}}` 并标为秘密。

网络预算：30 秒超时（`settings { timeout: … }` 1–120 秒）、响应正文 2 MiB、重定向不跟随。连接被拒绝/DNS/连接超时/TLS 失败表示未送达，可直接重试；POST/PATCH 在等待响应时超时、断开或取消时回执未知，需核对后手动确认才会再次发送。
