// ABOUTME: 字幕稿工作状态的共享类型（自动保存项目 + 数据变换入口）。
import type { useProjects } from "./workspace";
import type { Transcript } from "../contracts/transcript";
export type Desk = ReturnType<typeof useProjects<Transcript>>;
export type ChangeData = (change: (value: Transcript) => Transcript) => void;
