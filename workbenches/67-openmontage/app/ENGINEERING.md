# OpenMontage 制片工作台

contracts/montage.ts区分可保存编辑和可制作快照：时间草稿可未完成，readyMontage要求2–12个已上传且批准的镜头、总时长<=120秒。shotEdit撤销受影响镜头审批。内容寻址MP4原件通过分块上传、长度/MIME/SHA256校验保存到声明media资源。

App/ShotCard以制片单组织脚本、素材与审批；VideoPreview管理本地Blob URL生命周期；portable.ts把完整原件和工作草稿放进可迁移工程，导入先校验/上传全部原件再新建项目。缺失原件在autosave服务校验阶段保留为工作稿，不宣称模型已保存。

useProduction在POST之前持久化operation ID、projectId及固定快照。未知提交保留pending，显式重试相同编号；未确认时阻止切换/导入。运行信息随便携工程输入时须明确确认只导入编辑副本，原任务不重放。列表有请求序号，前后端统一单调终态归并并校验响应id/state/date。

独立Node服务通过受限Python worker调用固定官方OpenMontage VideoTrimmer/VideoStitch。服务不接收路径、命令或任意脚本；MP4资产按哈希写入唯一临时文件并原子发布。操作ID在异步素材写入前预留，防止并发重复执行；任务文件按队列原子写入。worker独立进程组，取消和4分钟超时终止其组；重启不自动重放任务。

模板SDK、tooling、CSP未改动；无Host模型能力。本地文件、渲染器和上游检出不随普通源码包，应用与服务分别测试。工程文件最大85MB，应用项目记录为素材元数据而非大二进制。
