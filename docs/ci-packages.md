# 自动打包与官方上传

GitHub Actions 的 [Workbench packages](../.github/workflows/workbenches.yml) 在 PR、推送 `main`、推送 `v*` 标签或手动触发时运行。它读取 `catalog.json`，只选择 `local-verified` 工作台；当前为 32 个。

每个工作台独立执行 `prepare → check → test → package`。`prepare` 获取 `template.lock.json` 固定的官方工具链，依赖安装使用项目锁文件。工作流固定 Node 22.22.2、pnpm 10.22.0 和 Actions 的提交 SHA，最多并行 4 个项目。

## 下载产物

进入一次成功的 Actions 运行，在 Artifacts 中下载对应的 `workbench-<slug>`。每份产物保留 30 天，包含：

- `<registryName>-<version>.fbworkbench`：官方工具生成的工作台源码包。
- `screenshot.png`：仓库已有的真实工作台介绍图。
- `presentation.json`：包身份、介绍文字、图片说明和文件 SHA-256。

解压 GitHub 产物后，在 Floatboat 的「我的 → 工作台 → 导入工作台」选择 `.fbworkbench`。GitHub 提供的外层 ZIP 是下载容器，不是工作台文件本身。

介绍图声明在 `catalog.json` 的 `presentation.screenshots` 中，使用 `docs/screenshots/` 里的真实浏览器截图。图片来源版本及采集证据见[截图说明](screenshots/README.md)；CI 不会重新截图，也不会把旧截图标记成新版本截图。介绍资料作为包旁边的文件传递，不向严格校验的应用 manifest 添加字段。

包默认不包含预览数据、凭证或本地运行目录。该工作流完成构建、应用测试和打包；真实 Host 调用、客户端导入和界面验收仍以各项目已有验收记录为准。

## 启用后端上传

自动上传是独立作业，仅在全部打包成功后运行。PR 不会上传；手动执行也必须选择 `main` 或 `v*` 标签。构建作业接触不到上传密钥。

后端先部署官方上传接口，配置 S3 和私有介绍图存储，并设置 `FLOATBOAT_OFFICIAL_USER_IDS` 为官方账号的用户 ID，多账号用英文逗号分隔。空白名单不允许任何账号上传。API Key 使用该账号在平台「设置 → API Keys」创建的账号密钥，不使用 NewAPI 模型密钥。

在 GitHub 仓库 Settings → Secrets and variables → Actions 配置：

| 类型 | 名称 | 值 |
| --- | --- | --- |
| Variable | `FLOATBOAT_UPLOAD_ENABLED` | `true` |
| Secret | `FLOATBOAT_UPLOAD_URL` | 从安全配置注入已部署接口的完整 HTTPS 地址 |
| Secret | `FLOATBOAT_UPLOAD_API_KEY` | 白名单官方账号的有效平台 API Key |

实际接口域名和路径与密钥一样保存在 Secrets 中，不写入工作流、仓库文档、产物或日志，也不使用普通 Actions Variable。若此前配置过同名 Variable，迁移到 Secret 后删除该 Variable。

未开启时仍正常生成 GitHub Artifacts。开启后缺少地址、密钥、后端白名单或存储配置会使上传作业失败，已生成的 GitHub 产物仍可下载。上传脚本不跟随重定向、不输出接口地址、凭证或后端原始错误正文。临时网络故障、HTTP 408/429/5xx 最多尝试 3 次；401/403 等授权错误立即失败。

接口将 `.fbworkbench` 和介绍图保存为官方账号的上传资料，并返回文件身份与媒体引用。它不自动审核或公开上架；平台已有的作者介绍和截图展示仍使用正常的发布审核流程。当前仓库应用未统一选择发布许可证，上传成功不代表通过商店的许可证和发布要求。

平台现有作者资料已经支持封面和截图画廊。此次 CI 补齐的是工作台源码包、介绍图和作者资料之间的交付流程；后端将图片登记为该账号持有的媒体引用，沿用已有的展示及审核格式。

## 上传协议

请求使用 `Authorization: Bearer <platform API key>` 和 `multipart/form-data`：

- `file`：一个 `.fbworkbench` 文件。
- `presentation`：下列结构的 JSON 字符串。
- `screenshots`：与 JSON 文件名相对应的图片文件，可以重复该字段。

```json
{
  "schemaVersion": 1,
  "registryName": "markmap-studio",
  "version": "0.3.0",
  "name": "Markmap 工作台",
  "shortDescription": "研究与会议脑图工作台",
  "package": {
    "file": "markmap-studio-0.3.0.fbworkbench",
    "sha256": "<64 位文件摘要>"
  },
  "screenshots": [{
    "file": "screenshot.png",
    "sha256": "<64 位图片摘要>",
    "caption": "Markmap 工作台实景"
  }]
}
```

包最大 100 MiB，介绍图最多 10 张，每张最大 10 MiB，图片合计最大 20 MiB；支持 PNG、JPEG、WebP。`shortDescription` 最多 160 字符，`caption` 最多 300 字符，可选 `fullDescription` 最多 32000 字符。后端验证真实图片内容并转换为 WebP，不执行上传的应用代码。

## 本地复现

```sh
pnpm test:tooling
node scripts/ci-workbenches.mjs matrix
pnpm workbench prepare markmap
pnpm workbench check markmap
pnpm workbench test markmap
node scripts/ci-workbenches.mjs package markmap "$PWD/.cache/manual/workbench-markmap"

# 从环境注入 FLOATBOAT_UPLOAD_URL 和 FLOATBOAT_UPLOAD_API_KEY 后运行。
# 目录中应包含一个或多个 workbench-* 子目录；不要把密钥写进仓库。
node scripts/upload-workbenches.mjs "$PWD/.cache/manual"
```

输出目录必须尚不存在，避免混入上一次打包的文件。所有包和截图都在发起网络请求前验证文件摘要。重复发送同一份产物不会改变其工作台身份；修改内容时按应用发布规则更新版本。
