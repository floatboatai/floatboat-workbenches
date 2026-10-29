// ABOUTME: 群体推演台外壳：一行文件条、六段推演流程带（资料→图谱→人设→推演→观察→报告）与当前阶段工作区。
import { useEffect, useState } from "react";
import { Menu } from "lucide-react";
import { FileMenu } from "./FileMenu";
import { Notice, RenderBoundary } from "./workspace";
import { STAGES, useStudio, type Stage, type Studio } from "./useStudio";
import { SeedStage } from "./SeedStage";
import { GraphStage } from "./GraphStage";
import { AgentsStage } from "./AgentsStage";
import { RunStage } from "./RunStage";
import { ObserveStage } from "./ObserveStage";
import { ReportStage } from "./ReportStage";

function stageNote(st: Studio, id: Stage) {
  const s = st.s;
  switch (id) {
    case "seed":
      return s.seeds.length ? `${s.seeds.length} 份 · ${s.seeds.reduce((n, d) => n + d.text.length, 0).toLocaleString()} 字` : "待添加";
    case "graph":
      return s.entities.length ? `${s.entities.length} 实体 · ${s.relations.length} 关系` : "待抽取";
    case "agents":
      return s.agents.length ? `${s.agents.length} 个智能体` : "待生成";
    case "run":
      return `${s.params.rounds} 轮 · ${s.events.length} 事件`;
    case "observe":
      return st.activeRun ? st.activeRun.label.replace(/ · .*$/, "") + ` · ${st.activeRun.summary.actions} 动作` : "尚无运行";
    case "report":
      return s.report.markdown ? (s.report.source === "host" ? "模型深化" : s.report.source === "rule" ? "规则生成" : "已编辑") : "未生成";
  }
}
const done = (st: Studio, id: Stage) =>
  id === "seed" ? st.s.seeds.length > 0 : id === "graph" ? st.s.entities.length > 0 : id === "agents" ? st.s.agents.length > 0 : id === "run" || id === "observe" ? st.s.runs.length > 0 : Boolean(st.s.report.markdown);

export function App() {
  const st = useStudio();
  const { p } = st;
  const [files, setFiles] = useState(false);
  const phase = p.autoState.phase;
  useEffect(() => {
    // Narrow screens scroll the stage ribbon; keep the current stage visible.
    document.querySelector(".ribbon [aria-current]")?.scrollIntoView({ block: "nearest", inline: "nearest" });
  }, [st.stage]);
  return (
    <>
      <a className="skip" href="#stage">
        跳到当前阶段
      </a>
      <header className="filebar">
        <button className="files-button" aria-haspopup="dialog" onClick={() => setFiles(true)}>
          <Menu size={16} aria-hidden="true" />
          推演档案
        </button>
        <input className="title" aria-label="推演名称" name="title" autoComplete="off" value={p.title} disabled={!st.mutable} onChange={(e) => p.setTitle(e.target.value)} />
        <span className={"save " + phase} role="status" aria-live="polite">
          {p.autoState.message}
        </span>
        {["offline", "conflict"].includes(phase) ? (
          <span className="save-actions">
            <button onClick={() => void p.save()}>重试保存</button>
            {p.current ? <button onClick={() => void st.open(p.current!.id)}>打开服务器版本</button> : null}
            <button onClick={() => p.exportDraft()}>下载恢复稿</button>
          </span>
        ) : null}
        <span className="spacer" />
        <span className="channels" aria-label="推演通道">
          <span className="chip ok" title="本地规则推演在工作台内运行，无需外部服务">
            <i aria-hidden="true" />
            本地引擎
          </span>
          <button className={"chip " + (st.service.available ? "ok" : "off")} onClick={() => p.setDraft((d) => ({ ...d, stage: "run", engine: "mirofish" }))}>
            <i aria-hidden="true" />
            MiroFish {st.service.available ? "已连接" : "未连接"}
          </button>
          <span className={"chip " + (st.model.available ? "ok" : "off")} title={st.model.available ? "可用 Floatboat 模型改写人设与深化报告" : "未连接 Floatboat；规则人设与规则报告照常可用"}>
            <i aria-hidden="true" />
            模型 {st.model.available ? "可用" : "未连接"}
          </span>
        </span>
      </header>
      <nav className="ribbon" aria-label="推演流程">
        <ol>
          {STAGES.map((x, i) => (
            <li key={x.id}>
              <button aria-current={st.stage === x.id ? "step" : undefined} className={done(st, x.id) ? "done" : ""} onClick={() => st.setStage(x.id)}>
                <b>{i + 1}</b>
                <span>
                  {x.label}
                  <small>{stageNote(st, x.id)}</small>
                </span>
              </button>
            </li>
          ))}
        </ol>
        {st.io ? (
          <span className="busy" role="status">
            {st.io}
          </span>
        ) : null}
      </nav>
      <Notice error={p.error} notice={p.notice} onClose={() => (p.setError(""), p.setNotice(""))} />
      <main id="stage" className={"stage stage-" + st.stage} tabIndex={-1}>
        <RenderBoundary>
          {p.loading ? (
            <p className="loading">正在打开上次的推演…</p>
          ) : st.stage === "seed" ? (
            <SeedStage st={st} />
          ) : st.stage === "graph" ? (
            <GraphStage st={st} />
          ) : st.stage === "agents" ? (
            <AgentsStage st={st} />
          ) : st.stage === "run" ? (
            <RunStage st={st} />
          ) : st.stage === "observe" ? (
            <ObserveStage st={st} />
          ) : (
            <ReportStage st={st} />
          )}
        </RenderBoundary>
      </main>
      <FileMenu st={st} open={files} close={() => setFiles(false)} />
    </>
  );
}
