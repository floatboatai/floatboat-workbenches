// ABOUTME: 推演档案：新建、示例、打开已保存与本机恢复稿、导入推演文件或 MiroFish 原生结果、导出与恢复稿。
import { useRef, useState } from "react";
import { FilePlus2, FolderOpen, Upload, Download, LifeBuoy, BookOpen, Trash2 } from "lucide-react";
import { Dialog } from "./Dialog";
import type { Studio } from "./useStudio";

export function FileMenu({ st, open, close }: { st: Studio; open: boolean; close: () => void }) {
  const { p, mutable } = st;
  const file = useRef<HTMLInputElement>(null);
  const raw = typeof p.draft.nativeRaw === "string" ? p.draft.nativeRaw : "";
  const [platform, setPlatform] = useState("");
  const after = (ok: boolean | void | Promise<boolean | void>) => void Promise.resolve(ok).then((v) => v !== false && close());
  return (
    <Dialog open={open} close={close} title="推演档案" eyebrow="FILES" className="files">
      <div className="file-actions">
        <button disabled={!mutable} onClick={() => after(st.fresh())}>
          <FilePlus2 size={16} aria-hidden="true" />
          新建空白推演
        </button>
        <button disabled={!mutable} onClick={() => after(st.example())}>
          <BookOpen size={16} aria-hidden="true" />
          打开示例：滨河低排放区
        </button>
        <button disabled={!mutable} onClick={() => file.current?.click()}>
          <Upload size={16} aria-hidden="true" />
          导入文件…
        </button>
        <input
          ref={file}
          type="file"
          hidden
          aria-label="导入推演文件、MiroFish 结果或资料"
          accept=".json,.jsonl,.ndjson,.txt,.md,.markdown,.csv,.tsv,.html,.htm,.pdf"
          onChange={(e) => {
            const f = e.target.files?.[0];
            e.target.value = "";
            if (f) void st.importFile(f).then(close);
          }}
        />
      </div>
      <p className="hint">
        可导入：本工作台导出的 <code>.mirofish.json</code>、恢复稿、0.5 复核工程；MiroFish 的 <code>run-status/detail</code>、<code>actions</code> 响应或 <code>actions.jsonl</code>（最大 40MB，新建一份推演）；TXT/MD/HTML/CSV/PDF 资料会加入当前推演。
      </p>
      {raw ? (
        <section className="native-retry">
          <h3>未完成的原生导入</h3>
          <p className="error-text">{String(p.draft.nativeError ?? "")}</p>
          <label>
            JSONL 来自哪个平台日志
            <select value={platform} onChange={(e) => setPlatform(e.target.value)}>
              <option value="">记录自带平台字段</option>
              <option value="twitter">Twitter 日志</option>
              <option value="reddit">Reddit 日志</option>
            </select>
          </label>
          <div className="row">
            <button className="primary" disabled={!mutable} onClick={() => after(st.importNative(raw, String(p.draft.nativeName ?? "粘贴的结果"), platform))}>
              重新导入为新推演
            </button>
            <button onClick={() => st.discard("nativeRaw")}>放弃</button>
          </div>
        </section>
      ) : null}
      <h3>已保存的推演</h3>
      <ul className="file-list">
        {p.items.length === 0 ? <li className="muted">还没有保存的推演；编辑后会自动保存。</li> : null}
        {p.items.map((item) => (
          <li key={item.id}>
            <button className={item.id === p.current?.id ? "current" : ""} disabled={!mutable || item.id === p.current?.id} onClick={() => after(st.open(item.id))}>
              <FolderOpen size={15} aria-hidden="true" />
              <span>{item.title}</span>
              <small>{item.id.startsWith("local:") ? "本机恢复稿" : item.id.startsWith("draft:") ? "未完成草稿" : new Date(item.updatedAt).toLocaleString("zh-CN", { hour12: false })}</small>
            </button>
          </li>
        ))}
      </ul>
      <h3>导出</h3>
      <div className="file-actions">
        <button onClick={() => void st.exportBundle()}>
          <Download size={16} aria-hidden="true" />
          推演文件 .mirofish.json
        </button>
        <button onClick={() => p.exportDraft()}>
          <LifeBuoy size={16} aria-hidden="true" />
          下载恢复稿
        </button>
        {p.current ? (
          <button className="danger" disabled={!mutable} onClick={() => after(p.remove())}>
            <Trash2 size={16} aria-hidden="true" />
            删除此推演
          </button>
        ) : null}
      </div>
      <p className="hint">报告与数据（CSV、JSONL、图谱 JSON）在“观察”和“报告”阶段导出。推演文件包含资料、图谱、人设、参数、运行记录与报告；本地运行按保存的输入重新生成，导入结果的原始动作随文件附带。</p>
    </Dialog>
  );
}
