# 镜头制作 · OpenMontage

从现有MP4原片制作短片：为镜头补充说明、设置入出点、逐个确认，再用OpenMontage原始VideoTrimmer和VideoStitch工具裁切、统一格式和组接成片。

![镜头制作](../../docs/screenshots/openmontage.png)

## 运行

```sh
pnpm workbench prepare openmontage
pnpm workbench dev openmontage
```

制作服务独立启动，需Node22、Python3.10+、Git和FFmpeg/ffprobe：

```sh
cd workbenches/67-openmontage/service
pnpm setup
pnpm start
```

setup仅在service/.local/upstream安装固定官方提交`e01dbf433f46eeb91d39bf905e194162921019a3`；不会覆盖已有修改。已有该提交检出可用`OPENMONTAGE_SOURCE`指定路径。`OPENMONTAGE_PYTHON`选择Python命令，`OPENMONTAGE_DATA`选择服务输出目录。默认服务`http://127.0.0.1:8797`，工作台通过`OPENMONTAGE_SERVICE_URL`和可选`OPENMONTAGE_SERVICE_TOKEN`连接；远程要求HTTPS。

## 已实现

- 逐镜头MP4上传、回放、顺序、标题/说明、精确入出点与人工审批。修改镜头撤销其审批。
- 说明、未完成时间与未应用JSON自动保存；丢回执、冲突和完整工作稿恢复。
- 完整工程导出包含原片；导入逐个校验内容哈希、上传原件后创建新项目，不重放历史制作任务。
- 真实官方工具裁切与拼接：720p、24fps、H.264 MP4；原始输入快照与成片任务独立。
- 制作前持久化操作编号与快照，同编号重试幂等；服务重启将未完成任务标中断，取消阻止迟到结果复活。

本版仅实现“已有素材→分镜审批→裁切组接”管线，不含AI生成视频、配音、素材搜索或完整OpenMontage编排。单素材20MB、工程原件总量60MB、2–12镜头、成片120秒。原件在工作台数据资源中，成片在独立服务数据目录中；普通源码包不包含这些数据或外部服务。

打包：`pnpm workbench package openmontage`。导入：Floatboat → 我的 → 工作台 → 导入工作台。客户端导入未实测，独立服务另行安装。原始上游源码使用AGPL-3.0，许可原文随包保留；[验收记录](ACCEPTANCE.md)区分真实上游与合同测试。
