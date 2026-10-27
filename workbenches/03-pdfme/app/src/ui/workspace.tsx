import { Component, type ReactNode, useEffect, useRef, useState } from "react";
import type { ProjectSummary } from "../contracts/project";
import { useWorkbenchState, type AutosaveOptions } from "./autosave-client";
import { request } from "./requests";
export { request, download } from "./requests";
export function useProjects<T>(seed:T,validate:(value:unknown)=>T,defaultTitle:string,options:AutosaveOptions<T>={}) {
  const project=useWorkbenchState(seed,validate,defaultTitle,options);
  const [aiBusy,setAiBusy]=useState(false),[suggestion,setSuggestion]=useState<T|null>(null);
  const generation=useRef(0);
  useEffect(()=>{generation.current++;setSuggestion(null);},[project.documentKey]);
  useEffect(()=>{const raw=project.draft.__aiSuggestion;if(raw===undefined){setSuggestion(null);return;}try{setSuggestion(validate(raw));}catch{setSuggestion(null);}},[project.documentKey,project.draft.__aiSuggestion]);
  function discardSuggestion(){setSuggestion(null);project.setDraft(extra=>{const next={...extra};delete next.__aiSuggestion;return next;});}
  async function generate(prompt:string){const token=++generation.current;setAiBusy(true);project.setError('');discardSuggestion();try{const result=validate(await request('/api/generate',{method:'POST',body:JSON.stringify({prompt})}));if(token===generation.current){setSuggestion(result);project.setDraft(extra=>({...extra,__aiSuggestion:result}));}}catch(e){if(token===generation.current)project.report(e);}finally{setAiBusy(false);}}
  function applySuggestion(){if(suggestion){project.setData(suggestion);discardSuggestion();project.setNotice('已采用生成稿。');}}
  return {...project,aiBusy,suggestion,generate,applySuggestion,discardSuggestion};
}
export function ProjectPicker({
  items,
  id,
  disabled,
  onOpen,
}: {
  items: ProjectSummary[];
  id?: string;
  disabled: boolean;
  onOpen: (id: string) => void;
}) {
  return (
    <label className="project-picker">
      <span className="sr-only">打开已保存项目</span>
      <select
        aria-label="打开已保存项目"
        value={id ?? ""}
        disabled={disabled}
        onChange={(event) => {
          if (event.target.value) onOpen(event.target.value);
        }}
      >
        <option value="">当前草稿</option>
        {items.map((item) => (
          <option key={item.id} value={item.id}>
            {item.title}
          </option>
        ))}
      </select>
    </label>
  );
}
export function Notice({ error, notice }: { error: string; notice: string }) {
  return error ? (
    <p className="notice error" role="alert">
      {error}
    </p>
  ) : notice ? (
    <p className="notice" role="status">
      {notice}
    </p>
  ) : null;
}
export class RenderBoundary extends Component<
  { children: ReactNode },
  { failed: boolean }
> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    return this.state.failed ? (
      <section role="alert" className="render-error">
        <p>编辑器加载失败，已保存内容仍在。</p>
        <button onClick={() => location.reload()}>刷新重试</button>
      </section>
    ) : (
      this.props.children
    );
  }
}
