# Mesh2Motion实现边界

上游固定提交 `eef2de986dab53283cb636f860d502d64b8073e7`。`src/vendor`包含22个由上游TS机械转译的ESM模块；原文和逐文件SHA256在manifest资产`notices`，核心求解算法未改。TypeScript5.9.3仅去除类型和规范相对导入后缀，`SkinningAlgorithm`与`AnimationUtility`提供窄类型边界。Three.js固定0.185.0。代码MIT，所带官方人形模型/骨架/动作CC0。

## 原生闭环

未绑定自包含GLB→保留原件→原生权重计算/边界平滑→Three.js SkinnedMesh→单选官方动作→真实动画GLB。人形骨架66关节，动作库87项。源模型按官方样例高度1.829564米等比归一化并落地，手动调整骨架相对偏移与整体比例。原生模型、关节、权重不以自写静态外观替代。

`src/contracts/glb.ts`检查文件头、资源范围、外部URI、压缩扩展、实例化顶点预算、层级循环、位置有限性和贴图尺寸。`src/ui/native.ts`将嵌入贴图bufferView解码为data图像，避免blob图像和远程请求，保留sampler；不修改CSP。源文件不改变，导出由GLTFExporter生成。只接受未绑定静态普通GLB输入，拒绝扩展、Morph、外部资源和压缩格式。

## 持久化与异步边界

资源保存在声明的`originals`数据目录，以SHA256为相对文件名，临时写入后原子重命名。source≤1,000,000字节，bound≤1,400,000字节，上传JSON适配1.95MB请求预算。正式文档≤850KB UTF8，工作数据恢复≤2MB，整个保存请求≤1.95MB。文档仅保存资源引用、关节偏移、比例、动作、暂停播放位置、相机/目标、骨架可见性和便笺。未完成数字/搜索位于extra；无效数值保留草稿且不覆盖最近有效模型。

背景保存不会锁编辑。Shared autosave使用事务、稳定mutationId和乐观revision，IndexedDB存储完整工作副本。服务端异步验证原件存在且哈希匹配，再允许正式模型入库；缺资源保持恢复草稿。切换开始立即撤销activeKey并递增operationId，旧视图/绑定/导出回执不能修改新项目。源与绑定结果按bindingKey区分，改关节即显式提示重新绑定。导出捕获点击时文档与资源，不使用迟到可变场景。刷新不会自动绑定或播放动画。

完整工程JSON≤8MB，含源与绑定结果原件；下载恢复稿只含引用与完整工作副本，跨实例可补齐匹配哈希文件。导入先核验资源再创建新项目。资源补齐/重新绑定后递增独立视图版本，确保相同哈希资源重新可用时也重新加载。普通源码包不带业务数据。

## 三维生命周期

每个视图拥有renderer/controls/geometry/material/texture，源切换与卸载dispose，初始化更新OrbitControls朝向。静止按需重绘，播放显式启动；相机控件变化保存，canvas可键盘聚焦用方向键平移。reduced-motion不自动播放；WebGL错误保留资料/参数并给出重试说明。单文件最多16000顶点、64mesh、256nodes；贴图单边2048、总像素8388608，适用于轻量游戏人形资产，不承诺高面数或自动语义骨骼识别。

## 验证

`pnpm workbench:check`、`pnpm test`、`pnpm dev -- --no-watch`、`pnpm package -- --output <新路径>`。核心测试读取manifest逻辑资源路径，支持导出包资源重定位。业务测试包含真实上游7399顶点绑定及动画顶点变化、坏几何、数据库幂等与冲突、大工作稿及缺原件恢复。真实Chrome验收与包哈希见项目`ACCEPTANCE.md`和`acceptance-evidence.json`。Host模型未使用，Floatboat客户端导入未验证。
