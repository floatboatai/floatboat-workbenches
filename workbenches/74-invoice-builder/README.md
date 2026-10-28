# Invoice Builder 工作台

版本 **0.7.0**。面向小工作室的报价与商业发票制作：填写客户和条目、核对金额、调整纸张、查看真实PDF并导出。

## 实际集成

使用 [piratuks/invoice-builder](https://github.com/piratuks/invoice-builder) 提交 `2979d91742008be0d2376e919be9e404657a900b` 的金额计算与原生PDFDocument/版式组件，采用官方React PDF渲染器。未引入Electron、sqlite3或PostgreSQL；项目存储由固定Floatboat模板的SQLite与完整工作稿承担。

- 报价/商业发票，出具方与客户快照，最多80条明细。
- CNY、USD、EUR、JPY；全单税费、固定或百分比折扣、运费和已付金额。
- 两种原生布局、A4/Letter、文字密度、表头与主题色、Logo和签名PNG/JPEG。
- 纸张内容预览；显式生成的真实PDF校样使用PDF.js，支持页码、可读文字和下载。
- 单据工程JSON可往返；恢复稿包括未完成字段。上游文档JSON是原生InvoiceFromData导出，不能当作任意上游数据库备份导入。

初始数据为虚构设计工作室报价。项目名称和字段输入后自动保存；空数量、未完成小数、非法日期等以草稿保留，不会冒充正式单据。PDF只从校验通过的点击快照生成，期间继续输入会使旧结果失效。切换项目后旧PDF和图片回执不会写入新项目。

## 本地运行

从总仓库根目录执行：

```sh
pnpm workbench prepare invoice-builder
pnpm workbench check invoice-builder
pnpm workbench test invoice-builder
pnpm workbench dev invoice-builder
pnpm workbench package invoice-builder
```

生成的 `.fbworkbench` 在 **Floatboat → 我的 → 工作台 → 导入工作台** 选择。源码包默认不带预览业务数据。客户端实际导入尚未验证；本项目不使用Host模型、WASM或外部服务。

## 范围与容量

单据制作与金额核对，不执行税控开票、寄送、收款或记账，不承诺地区税务合规。已付金额是用户维护的汇总草稿，不是银行流水。未实现上游完整CRM、库存、电子发票网络和模板设计器。

正式单据最多80项、每项说明360字、收款信息1000字、全部明细/说明/条款合计30000字；更长未完成输入可在结构预算内保存为草稿。JPY单价等金额只接受整数，其他币种最多2位小数，数量最多3位小数；不支持负数/贷项单据。使用上游显示舍入规则，浮点计算不应被当作高精度会计引擎。

每张Logo/签名原件150KiB、400万像素；PNG/JPEG原件直接随项目保存，完整工程包含这些字节。正式数据850KB UTF-8，工作数据结构恢复2MB，完整自动保存请求1.95MB。恢复入口允许12MiB外层文件（包含共享恢复封装的历史/待确认记录），但实际snapshot仍受1.95MB限制。浏览器本机恢复仅覆盖同一来源；冲突时先导出恢复稿，再明确打开服务器版本。

[验收记录](ACCEPTANCE.md) · [结构化证据](acceptance-evidence.json) · [设计](app/DESIGN.md) · [原生来源](app/notices/provenance.json)

## 许可

原创适配MIT；上游Invoice Builder保留MIT及版权声明。中文字体来自Google Fonts的Noto Sans SC，按OFL实例化400/700静态字体并重命名为Workbench Sans SC，保留原始字形覆盖；字体与来源记录随包。详细归属见 [第三方说明](app/THIRD-PARTY-NOTICES.md)。
