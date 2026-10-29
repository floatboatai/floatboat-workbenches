# 第三方来源与许可

[上游](https://github.com/pdfme/pdfme)；@pdfme/{ui,common,schemas,generator,converter,pdf-lib} 六包精确 5.4.6。

pdfme 六包为 MIT；可复现入口和打包脚本位于 scripts/，保留 vendor/pdfme-browser.js.LEGAL.txt。完整已安装生产依赖许可见 app/src/vendor/THIRD_PARTY_LICENSES.txt。

Noto Sans CJK SC Regular 为 SIL OFL 1.1，固定官方提交 f8d157532fbfaeda587e826d4cd5b21a49186f7c。[字体](https://raw.githubusercontent.com/notofonts/noto-cjk/f8d157532fbfaeda587e826d4cd5b21a49186f7c/Sans/OTF/SimplifiedChinese/NotoSansCJKsc-Regular.otf) 原字节存为 app/src/assets/noto-sans-sc.otf；[原许可](https://raw.githubusercontent.com/notofonts/noto-cjk/f8d157532fbfaeda587e826d4cd5b21a49186f7c/Sans/LICENSE) 存为 OFL.txt。

0.9.0 的浏览器包另含 pdfme 的全部字段插件（bwip-js MIT、air-datepicker MIT、date-fns MIT 等，随上述依赖树安装，许可见 THIRD_PARTY_LICENSES.txt）以及 @pdfme/converter 使用的 pdfjs-dist 3.11.174（Apache-2.0）。示例标志 `app/src/assets/sample-logo.png` 与证书底图 `app/src/assets/certificate-background.pdf` 由 `scripts/make-samples.mjs` 生成，属于本应用源码；示例中的公司、人名、电话与地址均为虚构的普通演示数据。

应用源码许可遵循总仓库，第三方各自许可独立适用。源包不包含预览数据库、模型凭据或本地用户文件。
