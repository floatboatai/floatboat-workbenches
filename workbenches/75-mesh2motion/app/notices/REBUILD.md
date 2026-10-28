# 固定原生模块来源

代码取自 https://github.com/Mesh2Motion/mesh2motion-app 的提交eef2de986dab53283cb636f860d502d64b8073e7，保留22个TS文件原文于upstream-src。代码按LICENSE-MIT.MD，engine-assets三个官方人形文件按LICENSE-CC0.MD。Three.js0.185.0许可另附。

src/vendor中的JS由TypeScript5.9.3 `transpileModule`生成，compilerOptions为target ES2022、module ESNext。只规范相对import为.js后缀，没有改写求解算法。窄.d.ts是本工作台的类型接口。重建不需要运行上游应用或改变模板构建链。

逐源文件与编译文件的SHA256、资产大小/hash记录在provenance.json。human-library.ts从固定GLB的joint/animation名称派生。所有这些记录在单测中按manifest resource实际映射复验，支持导出源码包的资源重定位。

工作台重新实现生命周期、资源读取、纹理解码、持久化和任务UI；核心绑定调用上游SkinningAlgorithm，动作清理和缩放调用AnimationUtility。各副本拥有独立场景，避免复用其他项目的运行状态。
