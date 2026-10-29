# 第三方来源

## Ray Optics Simulation 5.5.0（Apache-2.0）

核心固定于 ricktu288/ray-optics 提交 `daf76772c73a85e1a2568c4e2e71613bba1fab77`。`ray-optics/source` 是打包实际用到的上游 `src/core` 文件（Scene、Simulator、Editor、渲染器、公式/方程模块及**完整** `sceneObjs` 注册表，共 42 种场景对象），`ray-optics/locales` 是上游 en / zh-CN 的 `main`、`simulator` 文案。逐文件上游与适配后 SHA-256、打包进 bundle 的 npm 包清单见 `ray-optics-provenance.json`。

适配仅有 `ray-optics/patches/embedding.patch`：canvas2svg 默认导入、bezier-js 命名导入、Scene 中 ModuleObj 类型判断，以及 Editor 在嵌入式页面中按 `getBoundingClientRect + scroll` 换算指针坐标。`ray-optics/adapter/index.js` 是原创入口（MIT），导出 Scene/Simulator/Editor/geometry/sceneObjs 并初始化上游 i18next 文案。没有重写任何光学算法。

### 重建 bundle

```sh
# 在 workbenches/73-ray-optics 下；<upstream> 为固定提交的上游检出（或同一提交的原始文件镜像）
node app/notices/ray-optics/build-vendor.mjs <upstream>
node app/notices/ray-optics/port-examples.mjs <upstream>
```

`build-vendor.mjs` 复制上游 `src/core` 与文案、应用补丁、用固定的 esbuild 0.27.2 打包 `src/ui/vendor/ray-optics.js`（ESM、压缩、许可注释置于文件末尾；`mathjs` 统一解析到 15.2.0，与上游锁文件一致，tex-math-parser 自带的 mathjs 12 不再重复打包），裁掉未用到的源文件，重写 provenance，并从 bundle 自身的 `serializableDefaults` 生成 `src/contracts/native-schema.ts`。`port-examples.mjs` 从上游 `data/galleryScenes` 移植 16 个示例到 `src/contracts/examples-data.ts`：`{{占位}}` 文字按上游 zh-CN 画廊文案替换，删除只用于画廊缩略图的 CropBox 与 `importedFromBeta` 标记，场景名改为中文标题；光学内容不变。每个示例记录上游路径、SHA-256 与 `data/galleryList.json` 中的贡献者，界面卡片显示署名与 Apache-2.0。

## 打包进 bundle 的依赖许可

| 包 | 版本 | 许可 | 文件 |
| --- | --- | --- | --- |
| mathjs | 15.2.0 | Apache-2.0 | mathjs-LICENSE, mathjs-NOTICE |
| evaluatex | 2.2.0 | MIT | evaluatex-LICENSE |
| tex-math-parser | 2.0.5 | ISC | tex-math-parser-LICENSE |
| complex.js | 2.4.3 | MIT | complex.js-LICENSE |
| decimal.js | 10.6.0 | MIT | decimal.js-LICENCE.md |
| fraction.js | 5.3.4 | MIT | fraction.js-LICENSE |
| typed-function | 4.2.2 | MIT | typed-function-LICENSE |
| escape-latex | 1.2.0 | MIT | escape-latex-LICENSE.md |
| javascript-natural-sort | 0.7.1 | MIT | 包内无许可全文，package.json 声明 MIT |
| tiny-emitter | 2.1.0 | MIT | tiny-emitter-LICENSE |
| i18next | 23.16.8 | MIT | i18next-LICENSE |
| bezier-js | 6.1.4 | MIT | bezier-js-LICENSE.md（包与标签未含全文，附官方 LICENSE.md，blob 见 provenance） |
| canvas2svg | 1.0.16 | MIT | canvas2svg-LICENSE |
| seedrandom | 3.0.5 | MIT | seedrandom-LICENSE.txt（取自源码首部） |
| escape-html | 1.0.3 | MIT | escape-html-LICENSE |
| file-saver | 2.0.5 | MIT | file-saver-LICENSE.md |
| @babel/runtime | 7.x | MIT | babel-runtime-LICENSE |

打包后 notices 会随 manifest 资源重定位，测试从资源映射定位并核对 provenance 哈希。原创适配层与本工作台原创示例采用 app/LICENSE 的 MIT，该声明不替换上游及第三方许可。
