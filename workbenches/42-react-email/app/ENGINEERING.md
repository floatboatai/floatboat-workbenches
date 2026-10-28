# Engineering

## 官方组件与运行边界

模板固定3b55d46f7ae25e939ce3299073c37ed334d69c02，React19.2.3/Node22。官方现役 react-email@6.11.4 统一包带 esbuild^0.28.0 等CLI依赖，不能直接作为此模板运行依赖。旧 @react-email/components 与独立组件包npm已标deprecated，不采用这条路线。

从官方tag react-email@6.11.4（commit 2e3c28c89a4ee18bd302325f51d5cf4f93c7ea06）选择Html/Head/Body/Container/Preview/Section/Text/Heading/Button/Hr/Row/Column及递归工具，共19文件，唯一外部import为react。原始源码未经修改，保存在third-party/react-email-source；逐文件SHA-256、固定来源与转译信息在react-email-provenance.json，MIT原文随包。TypeScript5.9.3将官方TS/TSX转成src/server/vendor的ES2022 JS及声明；19源码对应38生成文件，已独立重新生成并比较全部字节。源码与生成模块都进入源码包。

官方 @react-email/render@2.1.1 在服务端直接调用 render/toPlainText（Node>=20、React18/19peer，纯JS依赖）。src/server/render-email.ts只组装官方组件与固定内联样式，不自造HTML渲染器。没有CLI、esbuild、native或WASM运行依赖；模板自带esbuild仍只用于官方构建工具链。没有改SDK或CSP。

## 状态与接口

contracts/email.ts将工作稿恢复与正式模型验证分开。server/routes.ts提供projects/autosave/render本地HTTP；render无外部请求。React通过page.fetch调用。ui/App.tsx负责组件编排和异步校样，renderKey含documentKey与完整业务数据；请求取消与结果身份共同隔离过期渲染。iframe srcDoc + sandbox空权限禁止脚本，不添加allow-scripts/allow-same-origin。HTML/纯文本导出仅使用当前内容对应的校样。

原件之外的输入：文本全经React转义，只有严格标识符模板替换；按钮href替换后验证http/https。未应用JSON在extra独立保存。SQLite版本比较与幂等mutation、IndexedDB副本、丢回执重试由既有共享autosave实现。业务transitionRef在await前加锁；字段及导入入口禁用，后台保存保持可编辑。正式数据输入聚合850KB限制在改变状态前报错，恢复允许2MB结构；草稿不会因超正式容量而被静默截断。

## 验证与再生成

本目录运行pnpm workbench:check、pnpm test、pnpm dev -- --no-watch、pnpm package。源码工作树可运行pnpm exec tsc -p app/third-party/compile-upstream.json再生成官方组件；包内资源由官方工具重定位，Host直接编译已包含的生成JS模块，无需联网取组件源码。

默认包不含业务数据库、示例编辑状态或缓存。模型capabilities=[]；不发送邮件。hostImport=unverified。
