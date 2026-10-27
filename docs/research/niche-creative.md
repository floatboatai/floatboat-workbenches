# 演出与音乐行业候选

核查日期：2026-10-27。仅调研，未做 Floatboat 构建或客户端导入。工作台业务流程和接入难度是基于官方资料的设计建议，不表示上游已有完整业务系统。

## OpenSheetMusicDisplay：乐谱审校与排练准备

- 仓库：[opensheetmusicdisplay/opensheetmusicdisplay](https://github.com/opensheetmusicdisplay/opensheetmusicdisplay)。GitHub API 核查未归档，最后推送 2026-10-23 UTC。
- 用户：乐团资料员、音乐出版社编辑、器乐教师。
- 上游现有：在浏览器将 MusicXML/MXL 渲染为乐谱，选择显示声部、调整页面和显示设置，支持 SVG/PNG 输出。它是渲染器，不是完整交互制谱编辑器；音频播放器和部分高级功能属于另行提供的早期访问功能。[官方 README](https://github.com/opensheetmusicdisplay/opensheetmusicdisplay)、[输入与 API](https://github.com/opensheetmusicdisplay/opensheetmusicdisplay/wiki/Getting-started)。
- 工作台建议：上传 MusicXML/MXL → 选择声部/版式 → 按小节记录审校批注 → 保存审校版本 → 导出乐谱图与批注清单。批注、版本、项目管理需要我们新增。
- 接入：优先采用发布的 JS 包，在 React 容器中调用 load/render；资源同源化，不搬运上游的完整构建系统。小型乐谱先做 CSP 与长谱响应性检查。复杂音符编辑和播放不列为第一版承诺。[包清单](https://github.com/opensheetmusicdisplay/opensheetmusicdisplay/blob/develop/package.json)。
- 许可：[BSD-3-Clause](https://github.com/opensheetmusicdisplay/opensheetmusicdisplay/blob/develop/LICENSE)。软件许可不包含用户上传乐谱的内容授权。
- 判断：**优先 A，难度中**。行业边界清楚，输入输出明确，浏览器适配面较小；仍未在 Floatboat 中验证。

## Open Fixture Library：演出灯具档案与控制台格式转换

- 仓库：[OpenLightingProject/open-fixture-library](https://github.com/OpenLightingProject/open-fixture-library)。GitHub API 核查未归档，最后推送 2026-10-27 UTC。
- 用户：演出灯光师、剧场设备管理员、灯具租赁公司。
- 上游现有：结构化灯具型号、模式与 DMX 通道定义，以及 QLC+、e:cue、DMXControl 等格式转换插件。[项目介绍](https://open-fixture-library.org/about)、[插件清单](https://open-fixture-library.org/about/plugins)。
- 工作台建议：选择/导入灯具定义 → 校验通道和工作模式 → 汇总项目灯具清单 → 导出目标控制台定义与场次配置附件。场次、库存数量与交接记录需要我们新增；不提供实际 DMX 硬件控制。
- 接入：只抽取固定版本的数据模型、校验与指定格式导出器，并新增 React UI。当前完整项目是 Nuxt/Vue，package.json 要求 Node 24.x、npm 11.x，不能原样装进 Node 22 模板。上游明确提醒内部 JSON 格式可能破坏性变更，应固定版本并转换成工作台自己的持久化格式。[运行条件](https://github.com/OpenLightingProject/open-fixture-library/blob/master/package.json)、[格式与稳定性](https://github.com/OpenLightingProject/open-fixture-library/blob/master/docs/fixture-format.md)。
- 许可：[MIT](https://github.com/OpenLightingProject/open-fixture-library/blob/master/LICENSE)。导出插件的依赖和外部灯具素材需要分别记录来源。
- 判断：**优先 B，难度中**。垂直度高，但需抽取模块和锁定格式；不属于直接嵌入整站的项目。
