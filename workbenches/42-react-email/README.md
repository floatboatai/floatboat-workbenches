# React Email 工作台

状态：计划中，尚未实现。

目标：邮件模板编写、个性化预览与 HTML 导出工作台

上游：https://github.com/resend/react-email

适配路线：优先取 @react-email/render 与剥离后的模板组件；Floatboat 管理模板、变量和预览，邮件投递作为独立可选接入。

限制：当前 react-email 主包 runtime 依赖含 esbuild，editor 又依赖主包，不能原样满足纯 JS 依赖限制；需裁剪或选择验证过的组件版本。

许可：MIT
