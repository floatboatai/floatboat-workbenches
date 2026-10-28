# 动效剪辑 · HyperFrames

为品牌发布和产品介绍制作短篇文字动效：编辑镜头、文案和时长，在时间轴上预览，导出可继续编辑的工程或HyperFrames HTML，再通过真实HyperFrames CLI渲染MP4。

![动效剪辑工作台](../../docs/screenshots/hyperframes.png)

## 使用

```sh
pnpm workbench prepare hyperframes
pnpm workbench dev hyperframes
```

渲染服务独立运行；需要Node22、FFmpeg及Chrome。依赖固定为官方`hyperframes@0.8.210`，普通工作台源码包不包含渲染器、浏览器或视频缓存。

```sh
cd workbenches/62-hyperframes/renderer
pnpm install --frozen-lockfile
pnpm start
```

默认服务`http://127.0.0.1:8782`。通过`HYPERFRAMES_RENDERER_URL`为工作台指定其他地址；远程要求HTTPS，可在两端设置`HYPERFRAMES_RENDERER_TOKEN`。可通过`HYPERFRAMES_BROWSER_PATH`选择Chrome。不要把凭据写入工程文件。

## 功能边界

- 三种可编辑文字构图、镜头顺序/复制/删除、逐镜头时长、品牌与强调色、播放定位。
- 完整工程与未应用JSON草稿自动保存，离线本机恢复、乐观冲突保护；导入创建新项目。
- 原生HyperFrames HTML和项目JSON导出；真实1280×720、24fps、H.264 MP4渲染下载。
- 渲染任务固定输入快照、操作编号幂等、进程中断状态和取消。修改当前工程不改变旧输出。

首版限制12镜头、60秒。工作台只生成固定模板的安全HTML，不执行用户任意HTML/JavaScript。没有接入在线AI素材生成、音频、任意视频上传或完整HyperFrames Studio。HTML需要HyperFrames渲染环境；工作台预览采用同一SVG构图和近似入场进度，最终视频以真实CLI结果为准。

打包：`pnpm workbench package hyperframes`。导入：Floatboat → 我的 → 工作台 → 导入工作台。客户端导入未实测；独立服务须另启动。验收见[ACCEPTANCE.md](ACCEPTANCE.md)。上游Apache-2.0许可保留于`app/notices/`。
