# FigCraft 原生引擎服务

可选组件：工作台没有它也能完成校样（内置读写 document.json 与近似渲染）；它提供原生渲染与原生 PNG/PDF。Node 22 + FigCraft CLI **0.11.2**。适配器使用真实Rust CPU引擎，不调用模型，不启动桌面窗口。原生文件最多1.35MB/60000图层/500页，修改前与只读渲染前执行`text.refit`，使无引擎期间改过的文字框按真实字体重排；输出有大小与超时限制。每次渲染在独立临时目录中运行，CLI读写root限制到该目录；只暴露固定的文字/名称/填色/交付状态动作。

1. 从[官方v0.11.2 Release](https://github.com/storytold/figcraft/releases/tag/v0.11.2)下载对应CLI。macOS独立包为`figcraft-cli-0.11.2-macos-universal.zip`，Linux/Windows使用对应官方包中的CLI。按Release的SHA256SUMS核对。
2. 在本目录执行`pnpm install --frozen-lockfile --ignore-scripts`。
3. 设置`FIGCRAFT_CLI`为本机CLI绝对路径后运行`pnpm start`。默认仅监听`127.0.0.1:8796`，`PORT`可调整。
4. 工作台服务默认连接该地址。可设置`FIGCRAFT_SERVICE_URL`；远程地址要求HTTPS。可选`FIGCRAFT_SERVICE_TOKEN`在服务和工作台服务器两侧一致设置，凭据不写入项目文件。

验收：设置CLI路径后`pnpm test`运行5项真实CLI/边界测试（含 refit）。返回的原生文件可在FigCraft中继续编辑。源码包不包含CLI、依赖安装目录或临时工作数据；CLI随自身许可证/字体许可分发。本目录源码和锁文件跟随Git仓库，需单独启动服务。
