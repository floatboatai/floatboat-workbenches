# 第三方来源

Ray Optics核心固定于daf76772c73a85e1a2568c4e2e71613bba1fab77，Apache-2.0。原生源码在ray-optics/source，逐文件原始与适配后SHA-256见ray-optics-provenance.json。

适配包括元件注册表收窄、Bezier命名导入、canvas2svg默认导入、未开放ModuleObj类型判断，以及Editor嵌套/滚动页面的canvas坐标修正。未重写光学算法。生成bundle：

`node_modules/.bin/esbuild app/notices/ray-optics/source/index.js --bundle --platform=browser --format=esm --outfile=app/src/ui/vendor/ray-optics.js`

工具版本为固定模板esbuild0.27.2。打包后notices会重定位，从manifest资源映射定位源码。seedrandom许可来自3.0.5源码首部；bezier-js6.1.4包与标签声明MIT但未含全文，附官方当前LICENSE.md，准确blob在provenance中。其他直接依赖的许可也在此目录。

原创适配层采用app/LICENSE的MIT，该声明不替换上游及第三方许可。
