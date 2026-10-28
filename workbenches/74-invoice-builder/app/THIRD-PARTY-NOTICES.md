# 第三方与资源归属

- Invoice Builder：piratuks/invoice-builder commit2979d91742008be0d2376e919be9e404657a900b，MIT，Copyright2025 Evaldas L. 许可全文位于`notices/INVOICE-BUILDER-LICENSE.txt`。保留的上游原始源码、每文件SHA-256和生成产物hash位于`notices/provenance.json`。
- 本地生成的`src/vendor/money.js`与`pdf.js`来自上游64个有运行依赖关系的源码文件，经esbuild0.27.2 tree-shake/ESM转译。PDFDocument唯一补丁移除其32字体导入及registerFonts调用；金额计算、原生版式和各section组件保持上游逻辑。工作台通过manifest资源注册字体，应用自有adapter提供经过验证的InvoiceFromData。
- `@react-pdf/renderer`4.9.0、`@react-pdf/image`3.1.2：官方React PDF库，MIT。`date-fns`4.1.0：MIT。依赖版本锁定在package/lock文件。
- PDF.js (`pdfjs-dist`6.4.299)：Mozilla，Apache-2.0；仅用于展示本应用生成的PDF，使用同源静态worker并关闭WASM。
- Workbench Sans SC：从Google Fonts `ofl/notosanssc/NotoSansSC[wght].ttf`（SHA-256见`fonts/PROVENANCE.json`）以fontTools4.68.0生成400/700静态实例，保留全部原始字形并改家族名，遵循OFL-1.1。许可全文为`fonts/OFL.txt`。没有将变量字体默认的Thin字重冒充Regular。

原始上游链接：https://github.com/piratuks/invoice-builder/tree/2979d91742008be0d2376e919be9e404657a900b 。源码包包含上游通知与字体资源；Node依赖安装后保留各依赖自身LICENSE。
