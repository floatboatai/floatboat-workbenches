import { lazy, Suspense, useState } from "react";
import {
  Activity,
  Download,
  Play,
  Plus,
  Save,
  Sparkles,
  Trash2,
} from "lucide-react";
import {
  executeFlow,
  seed,
  signature,
  validateFlow,
  type Operation,
  type RunResult,
} from "../contracts/flow";
import {
  download,
  Notice,
  ProjectPicker,
  RenderBoundary,
  request,
  useProjects,
} from "./workspace";
const FlowCanvas = lazy(() =>
  import("./FlowCanvas").then((module) => ({ default: module.FlowCanvas })),
);
const operationLabels: Record<Operation, string> = {
  input: "输入文本",
  uppercase: "转为大写",
  prefix: "添加前缀",
  output: "输出",
};
export function Studio() {
  const p = useProjects(seed, validateFlow, "文本处理流程");
  const [selected, setSelected] = useState("input"),
    [operation, setOperation] = useState<Operation>("uppercase"),
    [from, setFrom] = useState("input"),
    [to, setTo] = useState("output"),
    [running, setRunning] = useState(false),
    [prompt, setPrompt] = useState(""),
    [showAi, setShowAi] = useState(false);
  const locked = p.busy || p.aiBusy || running,
    node =
      p.data.nodes.find((value) => value.id === selected) || p.data.nodes[0];
  const run = p.data.lastRun,
    stale = run && run.signature !== signature(p.data);
  function updateNode(patch: Partial<typeof node.data>) {
    p.setData({
      ...p.data,
      nodes: p.data.nodes.map((value) =>
        value.id === node.id
          ? { ...value, data: { ...value.data, ...patch } }
          : value,
      ),
    });
  }
  function addStep() {
    const id = crypto.randomUUID(),
      output = p.data.nodes.find((value) => value.data.operation === "output"),
      incoming = output
        ? p.data.edges.find((edge) => edge.target === output.id)
        : undefined;
    const next = {
      id,
      type: "step" as const,
      position: { x: 240 + p.data.nodes.length * 65, y: 340 },
      data: {
        label: operationLabels[operation],
        operation,
        value: operation === "prefix" ? "前缀：" : "",
      },
    };
    p.setData({
      ...p.data,
      nodes: [...p.data.nodes, next],
      edges:
        incoming && output
          ? [
              ...p.data.edges.filter((edge) => edge.id !== incoming.id),
              { id: crypto.randomUUID(), source: incoming.source, target: id },
              { id: crypto.randomUUID(), source: id, target: output.id },
            ]
          : p.data.edges,
    });
    setSelected(id);
  }
  function removeNode() {
    if (node.data.operation === "input" || node.data.operation === "output") {
      p.setError("保留输入与输出步骤。可以修改其内容。");
      return;
    }
    const before = p.data.edges.filter((edge) => edge.target === node.id),
      after = p.data.edges.filter((edge) => edge.source === node.id);
    const edges = p.data.edges.filter(
      (edge) => edge.source !== node.id && edge.target !== node.id,
    );
    if (before.length === 1 && after.length === 1)
      edges.push({
        id: crypto.randomUUID(),
        source: before[0].source,
        target: after[0].target,
      });
    p.setData({
      ...p.data,
      nodes: p.data.nodes.filter((value) => value.id !== node.id),
      edges,
    });
    setSelected(p.data.nodes[0].id);
  }
  function connect() {
    if (from === to) {
      p.setError("不能连接到步骤自身。");
      return;
    }
    p.setData({
      ...p.data,
      edges: [
        ...p.data.edges,
        { id: crypto.randomUUID(), source: from, target: to },
      ],
    });
  }
  async function runFlow() {
    setRunning(true);
    p.setError("");
    try {
      const value = await request("/api/run", {
        method: "POST",
        body: JSON.stringify({ data: p.data }),
      });
      const checked = validateFlow({ ...p.data, lastRun: value });
      p.setData(checked);
      await p.save(checked);
    } catch (error) {
      p.report(error);
    } finally {
      setRunning(false);
    }
  }
  const safeName = p.title.replace(/[\\/:*?"<>|]/g, "_") || "流程";
  return (
    <main className="flow-studio">
      <a className="skip-link" href="#inspector">
        跳到步骤参数
      </a>
      <header className="command-bar">
        <div className="flow-brand">
          <Activity aria-hidden="true" size={25} />
          <div>
            <h1>流程实验室</h1>
            <span>文本进入，结果出来</span>
          </div>
        </div>
        <ProjectPicker
          items={p.items}
          id={p.current?.id}
          disabled={locked}
          onOpen={(id) => void p.open(id)}
        />
        <div className="command-actions">
          <button onClick={p.fresh} disabled={locked}>
            <Plus aria-hidden="true" size={15} />
            新建
          </button>
          <button onClick={() => void p.save()} disabled={locked}>
            <Save aria-hidden="true" size={15} />
            保存
          </button>
          <button
            onClick={() =>
              download(
                new Blob([JSON.stringify(p.data, null, 2)], {
                  type: "application/json",
                }),
                safeName + ".json",
              )
            }
          >
            <Download aria-hidden="true" size={15} />
            配置
          </button>
          <button
            aria-expanded={showAi}
            onClick={() => setShowAi((value) => !value)}
          >
            <Sparkles aria-hidden="true" size={15} />
            生成配置
          </button>
          <button
            className="run-button"
            onClick={() => void runFlow()}
            disabled={locked}
          >
            <Play aria-hidden="true" size={15} />
            {running ? "运行中…" : "运行并保存"}
          </button>
        </div>
      </header>
      <div className="flow-title">
        <label className="sr-only" htmlFor="title">
          流程名称
        </label>
        <input
          id="title"
          name="title"
          autoComplete="off"
          value={p.title}
          maxLength={120}
          disabled={locked}
          onChange={(event) => p.setTitle(event.target.value)}
        />
        <span role="status">
          {p.loading
            ? "正在加载…"
            : p.busy
              ? "正在保存…"
              : p.dirty
                ? "尚未保存"
                : p.current
                  ? "已保存"
                  : "新流程"}
        </span>
        <span className="flow-count">
          {p.data.nodes.length} 个步骤 / {p.data.edges.length} 条连接
        </span>
      </div>
      <Notice error={p.error} notice={p.notice} />
      {showAi ? (
        <section className="ai-flow">
          <form
            onSubmit={(event) => {
              event.preventDefault();
              void p.generate(prompt);
            }}
          >
            <label htmlFor="prompt">描述文本处理步骤</label>
            <textarea
              id="prompt"
              name="prompt"
              autoComplete="off"
              required
              maxLength={12000}
              value={prompt}
              onChange={(event) => setPrompt(event.target.value)}
              placeholder="例如：把 hello 转为大写，并加上「通知：」前缀…"
            />
            <button disabled={locked}>
              {p.aiBusy ? "正在生成…" : "生成建议"}
            </button>
          </form>
          {p.suggestion ? (
            <div>
              <h2>配置建议</h2>
              <ol>
                {p.suggestion.nodes.map((step) => (
                  <li key={step.id}>
                    {step.data.label} · {operationLabels[step.data.operation]}{" "}
                    {step.data.value}
                  </li>
                ))}
              </ol>
              <button className="run-button" onClick={p.applySuggestion}>
                采用配置
              </button>
              <p>采用后检查连接，再运行。</p>
            </div>
          ) : null}
        </section>
      ) : null}
      <div className="flow-layout">
        <section className="canvas-region" aria-label="流程画布">
          <RenderBoundary>
            <Suspense
              fallback={
                <p role="status" className="loading">
                  正在加载流程画布…
                </p>
              }
            >
              <FlowCanvas
                key={p.current?.id || "new"}
                data={p.data}
                onChange={p.setData}
                onSelect={setSelected}
                locked={locked}
              />
            </Suspense>
          </RenderBoundary>
          <div className="canvas-caption">
            拖动步骤调整位置 · 使用参数面板也可创建连接
          </div>
        </section>
        <aside className="inspector" id="inspector">
          <div className="section-label">步骤参数</div>
          <label htmlFor="selected">选中步骤</label>
          <select
            id="selected"
            value={node.id}
            onChange={(event) => setSelected(event.target.value)}
          >
            {p.data.nodes.map((value) => (
              <option key={value.id} value={value.id}>
                {value.data.label}
              </option>
            ))}
          </select>
          <label htmlFor="node-name">步骤名称</label>
          <input
            id="node-name"
            name="nodeName"
            autoComplete="off"
            value={node.data.label}
            maxLength={80}
            disabled={locked}
            onChange={(event) => updateNode({ label: event.target.value })}
          />
          <div className="operation-tag">
            {operationLabels[node.data.operation]}
          </div>
          {node.data.operation === "input" ||
          node.data.operation === "prefix" ? (
            <>
              <label htmlFor="node-value">
                {node.data.operation === "input" ? "输入内容" : "前缀内容"}
              </label>
              <textarea
                id="node-value"
                name="nodeValue"
                autoComplete="off"
                value={node.data.value}
                maxLength={10000}
                disabled={locked}
                onChange={(event) => updateNode({ value: event.target.value })}
              />
            </>
          ) : (
            <p className="muted">
              {node.data.operation === "uppercase"
                ? "把上一节点的文本转为大写。"
                : "返回前一步的文本作为最终结果。"}
            </p>
          )}
          <button
            className="danger"
            onClick={removeNode}
            disabled={
              locked ||
              node.data.operation === "input" ||
              node.data.operation === "output"
            }
          >
            <Trash2 aria-hidden="true" size={14} />
            删除此步骤
          </button>
          <div className="section-label">添加步骤</div>
          <label className="sr-only" htmlFor="operation">
            步骤类型
          </label>
          <select
            id="operation"
            value={operation}
            onChange={(event) => setOperation(event.target.value as Operation)}
          >
            <option value="uppercase">转为大写</option>
            <option value="prefix">添加前缀</option>
          </select>
          <button
            onClick={addStep}
            disabled={locked || p.data.nodes.length >= 30}
          >
            <Plus aria-hidden="true" size={14} />
            插入到输出前
          </button>
          <div className="section-label">连接管理</div>
          <label htmlFor="from">从</label>
          <select
            id="from"
            value={from}
            onChange={(event) => setFrom(event.target.value)}
          >
            {p.data.nodes.map((value) => (
              <option key={value.id} value={value.id}>
                {value.data.label}
              </option>
            ))}
          </select>
          <label htmlFor="to">到</label>
          <select
            id="to"
            value={to}
            onChange={(event) => setTo(event.target.value)}
          >
            {p.data.nodes.map((value) => (
              <option key={value.id} value={value.id}>
                {value.data.label}
              </option>
            ))}
          </select>
          <button onClick={connect} disabled={locked}>
            添加连接
          </button>
          <ul className="edge-list">
            {p.data.edges.map((edge) => (
              <li key={edge.id}>
                <span>
                  {
                    p.data.nodes.find((value) => value.id === edge.source)?.data
                      .label
                  }{" "}
                  →{" "}
                  {
                    p.data.nodes.find((value) => value.id === edge.target)?.data
                      .label
                  }
                </span>
                <button
                  aria-label="删除此连接"
                  disabled={locked}
                  onClick={() =>
                    p.setData({
                      ...p.data,
                      edges: p.data.edges.filter(
                        (value) => value.id !== edge.id,
                      ),
                    })
                  }
                >
                  ×
                </button>
              </li>
            ))}
          </ul>
        </aside>
      </div>
      <section className="run-log">
        <header>
          <h2>执行结果</h2>
          {run ? (
            <span>
              {stale
                ? "配置已变化，请重新运行"
                : new Date(run.at).toLocaleString()}
            </span>
          ) : null}
          {run ? (
            <button
              onClick={() =>
                download(
                  new Blob([run.output], { type: "text/plain" }),
                  safeName + "-结果.txt",
                )
              }
            >
              导出上次结果
            </button>
          ) : null}
        </header>
        {run ? (
          <>
            <output className="run-output">{run.output || "（空文本）"}</output>
            <div className="step-results">
              {run.steps.map((step, index) => (
                <details key={step.id}>
                  <summary>
                    <span>{index + 1}</span>
                    {step.label}
                  </summary>
                  <label>输入</label>
                  <pre>{step.input || "（空）"}</pre>
                  <label>输出</label>
                  <pre>{step.output || "（空）"}</pre>
                </details>
              ))}
            </div>
          </>
        ) : (
          <p className="muted">
            运行后，这里显示每个步骤真实接收和输出的文本。
          </p>
        )}
      </section>
    </main>
  );
}
