# 0.6.0 本地验收

`pnpm workbench:check` 与 `pnpm test` 8/8 通过。共享autosave和App大文件提示为非阻断提醒。

真实Chrome：自制12秒WAV先原生metadata读取，再AudioContext解码。WaveSurfer真实波形、播放时间前进、速度/缩放、原生区间边界拖动、两个重叠区间仅循环选中项通过。原件、JSON、CSV、含原件工程与恢复稿实际下载；嵌入原件字节一致；伪造时长拒绝；缺失原件按指纹重附后摘录仍在。

自动保存：刷新、延迟期间输入、提交后丢回执重试、双标签冲突、未完成时间与未应用JSON恢复、snapshot恢复稿下载回导为新副本、新建等待旧保存并锁定编辑，通过。Waveform切换时inert且range回调同步guard；保存中普通输入不锁定。

1440px和375px窄屏、键盘焦点、reduced-motion、无横向溢出；正常流程零控制台异常。截图为真实自然示例，音频为自制合成音。React Best Practices与最新Web Interface Guidelines已应用，第三方许可随资源打包。

默认源码包CRC、源码与资源字节核对通过，manifest仅官方打包资源路径重定位；无业务音频、SQLite或node_modules。预览 http://127.0.0.1:62242/ 。客户端导入 `hostImport=unverified`。

预算：每原件32MiB、10分钟；metadata在分配解码缓冲前检查；16kHz校验解码最多128MiB，实际内存仍受浏览器影响；500选段、850KB工作稿。累计原件随使用增长。没有转录、剪切、降噪或重新编码。
