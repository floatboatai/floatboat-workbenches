import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type SetStateAction,
} from "react";
import {
  isRecord,
  isSummary,
  type Project,
  type ProjectSummary,
} from "../contracts/project";
import {
  fingerprint,
  type CachedDraft,
  type DraftRecord,
  type SavePhase,
  type SaveReceipt,
  type SaveRequest,
  type WorkingCopy,
} from "../contracts/autosave";
import {
  readCache,
  writeDraftCache,
  readActiveCache,
  listDraftCache,
  clearCache,
} from "./autosave-cache";
import { request, download } from "./requests";
type LocalCopy<T> = CachedDraft<T> & { conflicted?: boolean };
const validLocalId = (value: unknown): value is string =>
  typeof value === "string" &&
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value,
  );
export interface AutosaveOptions<T> {
  storageKey?: string;
  restoreDraftData?: (value: unknown) => T;
}
export function useWorkbenchState<T>(
  seed: T,
  validate: (value: unknown) => T,
  defaultTitle: string,
  options: AutosaveOptions<T> = {},
) {
  const storageKey = options.storageKey ?? defaultTitle;
  const initial: WorkingCopy<T> = {
    title: defaultTitle,
    data: structuredClone(seed),
    extra: {},
  };
  const [work, setWork] = useState<WorkingCopy<T>>(initial),
    workRef = useRef(work);
  workRef.current = work;
  const [current, setCurrentState] = useState<Project<T> | null>(null),
    currentRef = useRef(current);
  const [items, setItems] = useState<ProjectSummary[]>([]),
    [loading, setLoading] = useState(true),
    [busy, setBusy] = useState(false);
  const [error, setErrorState] = useState(""),
    [notice, setNotice] = useState("");
  const saveError = useRef<string | null>(null);
  const setError = useCallback((value: SetStateAction<string>) => {
    saveError.current = null;
    setErrorState(value);
  }, []);
  const saveReport = (value: unknown) => {
    const message = value instanceof Error ? value.message : String(value);
    saveError.current = message;
    setErrorState(message);
  };
  const clearSaveError = () => {
    const owned = saveError.current;
    saveError.current = null;
    if (owned !== null)
      setErrorState((previous) => (previous === owned ? "" : previous));
  };
  const [autoState, setAutoState] = useState<{
    phase: SavePhase;
    message: string;
    savedAt: string;
  }>({ phase: "idle", message: "编辑后自动保存", savedAt: "" });
  const [loadEpoch, setLoadEpoch] = useState(0),
    [tick, setTick] = useState(0);
  const doc = useRef<{ id: string; revision: number }>({
      id: crypto.randomUUID(),
      revision: 0,
    }),
    ack = useRef(fingerprint(initial)),
    pending = useRef<SaveRequest<T> | null>(null);
  const flight = useRef<Promise<SaveReceipt<T> | null> | null>(null),
    active = useRef(true),
    edited = useRef(false),
    conflicted = useRef(false),
    failures = useRef(0),
    loaded = useRef(false),
    epoch = useRef(0);
  const blocked = useRef<string | null>(null);
  const restore = useRef(options.restoreDraftData ?? validate);
  restore.current = options.restoreDraftData ?? validate;
  const report = (e: unknown) =>
    setError(e instanceof Error ? e.message : "操作失败，请重试。");
  function markCurrent(value: Project<T> | null) {
    currentRef.current = value;
    setCurrentState(value);
    if (value)
      setItems((previous) => [
        {
          id: value.id,
          title: value.title,
          revision: value.revision,
          updatedAt: value.updatedAt,
        },
        ...previous.filter((p) => p.id !== value.id),
      ]);
  }
  function update(value: SetStateAction<WorkingCopy<T>>, user = true) {
    const next = typeof value === "function" ? value(workRef.current) : value;
    workRef.current = next;
    if (user && fingerprint(next) !== fingerprint(work)) edited.current = true;
    setWork(next);
  }
  const setData = (value: SetStateAction<T>) =>
    update((w) => ({
      ...w,
      data:
        typeof value === "function"
          ? (value as (previous: T) => T)(w.data)
          : value,
    }));
  const setTitle = (value: SetStateAction<string>) =>
    update((w) => ({
      ...w,
      title: typeof value === "function" ? value(w.title) : value,
    }));
  const setDraft = (value: SetStateAction<Record<string, unknown>>) =>
    update((w) => ({
      ...w,
      extra: typeof value === "function" ? value(w.extra) : value,
    }));
  function cacheValue(): LocalCopy<T> {
    return {
      documentId: doc.current.id,
      revision: doc.current.revision,
      snapshot: workRef.current,
      current: currentRef.current,
      acknowledged: ack.current,
      pending: pending.current,
      savedAt: new Date().toISOString(),
      conflicted: conflicted.current,
    };
  }
  function unsynced(copy: LocalCopy<T>) {
    return (
      !!copy.pending ||
      copy.conflicted === true ||
      fingerprint(copy.snapshot) !== copy.acknowledged
    );
  }
  function mergeLocal(previous: ProjectSummary[], copies: LocalCopy<T>[]) {
    const known = new Set(copies.map((copy) => "local:" + copy.documentId));
    const waiting = copies.filter(unsynced),
      hidden = new Set(
        waiting.flatMap((copy) => [
          "draft:" + copy.documentId,
          // An unacknowledged create may already exist remotely. Known projects stay
          // selectable while a newer local draft is pending; their identity must not blink.
          ...(!copy.current ? [copy.documentId] : []),
        ]),
      );
    return [
      ...waiting.map((copy) => ({
        id: "local:" + copy.documentId,
        title: "本机草稿 · " + (copy.snapshot.title.trim() || "未命名"),
        revision: copy.revision,
        updatedAt: copy.savedAt,
      })),
      ...previous.filter((item) => !known.has(item.id) && !hidden.has(item.id)),
    ];
  }
  async function cache() {
    const copy = cacheValue();
    await writeDraftCache(storageKey, copy.documentId, copy);
    if (active.current) setItems((previous) => mergeLocal(previous, [copy]));
    try {
      sessionStorage.setItem(storageKey + ":active", copy.documentId);
    } catch {
      /* The IndexedDB active pointer remains available in another same-origin tab. */
    }
  }
  const refresh = useCallback(async () => {
    const [projects, drafts, local] = await Promise.allSettled([
      request("/api/projects"),
      request("/api/autosave/list"),
      listDraftCache(storageKey),
    ]);
    const copies: LocalCopy<T>[] = [];
    if (local.status === "fulfilled")
      for (const entry of local.value)
        try {
          copies.push(decodeCache(entry.value, entry.id));
        } catch {
          /* Never replay malformed cached requests. */
        }
    const list =
      projects.status === "fulfilled" &&
      Array.isArray(projects.value) &&
      projects.value.every(isSummary)
        ? projects.value
        : null;
    const serverDrafts =
      drafts.status === "fulfilled" && Array.isArray(drafts.value)
        ? drafts.value.filter(isSummary)
        : null;
    setItems((previous) =>
      mergeLocal(
        list && serverDrafts ? [...list, ...serverDrafts] : previous,
        copies,
      ),
    );
    if (!list || !serverDrafts)
      throw new Error("项目列表暂不可用；本机草稿仍可打开。");
  }, [storageKey]);
  function decodeProject(value: unknown): Project<T> {
    if (!isSummary(value) || !isRecord(value))
      throw new Error("项目响应无效。");
    return { ...value, data: validate(value.data) };
  }
  function decodeWork(value: unknown): WorkingCopy<T> {
    if (
      !isRecord(value) ||
      typeof value.title !== "string" ||
      value.title.length > 120 ||
      !isRecord(value.extra)
    )
      throw new Error("草稿格式无效，请导出恢复文件。");
    return {
      title: value.title,
      data: restore.current(value.data),
      extra: value.extra,
    };
  }
  function decodeCache(value: unknown, expectedId?: string): LocalCopy<T> {
    if (
      !isRecord(value) ||
      !validLocalId(value.documentId) ||
      (expectedId !== undefined && value.documentId !== expectedId) ||
      !Number.isInteger(value.revision) ||
      typeof value.revision !== "number" ||
      value.revision < 0 ||
      typeof value.acknowledged !== "string" ||
      typeof value.savedAt !== "string" ||
      !Number.isFinite(Date.parse(value.savedAt)) ||
      (value.conflicted !== undefined && typeof value.conflicted !== "boolean")
    )
      throw new Error("本机草稿格式无效，请导出恢复文件。");
    const snapshot = decodeWork(value.snapshot),
      current = value.current === null ? null : decodeProject(value.current);
    let command: SaveRequest<T> | null = null;
    if (value.pending !== null) {
      const pending = value.pending;
      if (
        !isRecord(pending) ||
        pending.documentId !== value.documentId ||
        !validLocalId(pending.mutationId) ||
        pending.draftRevision !== value.revision ||
        pending.projectId !== (current?.id ?? null) ||
        pending.projectRevision !== (current?.revision ?? null)
      )
        throw new Error("本机待同步请求格式无效，已阻止自动重放。");
      decodeWork(pending.snapshot);
      command = {
        documentId: value.documentId,
        mutationId: pending.mutationId,
        draftRevision: value.revision,
        projectId: current?.id ?? null,
        projectRevision: current?.revision ?? null,
        // Preserve the original wire content and key order for idempotent replay.
        snapshot: structuredClone(pending.snapshot) as WorkingCopy<T>,
      };
    }
    return {
      documentId: value.documentId,
      revision: value.revision,
      snapshot,
      current,
      acknowledged: value.acknowledged,
      pending: command,
      savedAt: value.savedAt,
      conflicted: value.conflicted === true,
    };
  }
  function restoreLocal(copy: LocalCopy<T>, offline = false) {
    // Keep the original project revision and mutation. Fetching a newer project here would bypass conflicts.
    reset(copy.snapshot, copy.current, true, undefined, false);
    doc.current = { id: copy.documentId, revision: copy.revision };
    ack.current = copy.acknowledged;
    pending.current = copy.pending;
    conflicted.current = copy.conflicted === true;
    edited.current = unsynced(copy);
    setAutoState({
      phase: conflicted.current
        ? "conflict"
        : offline
          ? "offline"
          : edited.current
            ? "pending"
            : "saved",
      message: conflicted.current
        ? "草稿已保留，项目有版本冲突。请打开服务器版本或导出草稿。"
        : offline
          ? "已恢复本机草稿，等待重新连接。"
          : edited.current
            ? "正在恢复待同步草稿…"
            : "已恢复本机草稿。",
      savedAt: copy.savedAt,
    });
    if (loaded.current) void cache().catch(() => {});
  }
  async function localCopy(id: string) {
    if (!validLocalId(id)) throw new Error("本机草稿标识无效。");
    return decodeCache(await readCache(storageKey + ":" + id), id);
  }
  function validRecord(value: unknown): value is DraftRecord<T> {
    return (
      isRecord(value) &&
      typeof value.documentId === "string" &&
      typeof value.revision === "number" &&
      isRecord(value.snapshot) &&
      isRecord(value.receipt)
    );
  }
  function reset(
    snapshot: WorkingCopy<T>,
    project: Project<T> | null,
    saved: boolean,
    record?: DraftRecord<T>,
    write = true,
  ) {
    epoch.current++;
    blocked.current = null;
    doc.current = {
      id: record?.documentId ?? crypto.randomUUID(),
      revision: record?.revision ?? 0,
    };
    pending.current = null;
    conflicted.current = record?.receipt.phase === "conflict";
    failures.current = 0;
    ack.current = saved ? fingerprint(snapshot) : "";
    edited.current = !saved;
    update(snapshot, false);
    markCurrent(project);
    setLoadEpoch((x) => x + 1);
    setError("");
    setNotice("");
    setAutoState({
      phase:
        record?.receipt.phase ??
        (saved ? (project ? "saved" : "idle") : "pending"),
      message:
        record?.receipt.message ??
        (saved ? (project ? "已自动保存" : "编辑后自动保存") : "等待自动保存…"),
      savedAt: record?.updatedAt ?? "",
    });
    if (loaded.current && write) void cache().catch(() => {});
  }
  useEffect(() => {
    active.current = true;
    void (async () => {
      let cached: LocalCopy<T> | undefined;
      try {
        let id: string | null = null;
        try {
          id = sessionStorage.getItem(storageKey + ":active");
        } catch {
          /* Use the persistent active pointer. */
        }
        const raw = validLocalId(id)
          ? await readCache(storageKey + ":" + id)
          : undefined;
        const value = raw ?? (await readActiveCache(storageKey));
        if (value !== undefined) cached = decodeCache(value);
      } catch {
        /* Server recovery and valid local list entries remain available. */
      }
      try {
        await refresh();
        if (edited.current) return;
        const recent = await request("/api/autosave/recent");
        if (!active.current || edited.current) return;
        if (cached) {
          const remote = await request("/api/autosave/" + cached.documentId);
          if (
            validRecord(remote) &&
            remote.revision >= cached.revision &&
            !unsynced(cached)
          )
            reset(
              decodeWork(remote.snapshot),
              remote.receipt.project
                ? decodeProject(remote.receipt.project)
                : cached.current,
              true,
              remote,
            );
          else restoreLocal(cached);
        } else if (validRecord(recent)) {
          const project = recent.receipt.project
            ? decodeProject(recent.receipt.project)
            : recent.projectId
              ? decodeProject(
                  await request("/api/projects/" + recent.projectId),
                )
              : null;
          reset(decodeWork(recent.snapshot), project, true, recent);
        }
      } catch (e) {
        if (cached && !edited.current) restoreLocal(cached, true);
        else report(e);
      } finally {
        if (active.current) {
          loaded.current = true;
          setLoading(false);
          setTick((x) => x + 1);
        }
      }
    })();
    return () => {
      active.current = false;
    };
  }, [storageKey, refresh]);
  async function persist(force = false): Promise<SaveReceipt<T> | null> {
    while (flight.current) await flight.current;
    if (conflicted.current) {
      saveReport("项目存在版本冲突，请先导出草稿或打开服务器版本。");
      return null;
    }
    const now = fingerprint(workRef.current);
    if (
      !pending.current &&
      now === ack.current &&
      (!force || currentRef.current)
    )
      return null;
    const generation = epoch.current;
    if (!pending.current)
      pending.current = {
        documentId: doc.current.id,
        mutationId: crypto.randomUUID(),
        draftRevision: doc.current.revision,
        projectId: currentRef.current?.id ?? null,
        projectRevision: currentRef.current?.revision ?? null,
        snapshot: structuredClone(workRef.current),
      };
    const command = pending.current;
    const task = (async () => {
      let local = false;
      try {
        await cache();
        local = true;
      } catch {
        /* Continue trying the durable server. */
      }
      setAutoState({ phase: "saving", message: "正在自动保存…", savedAt: "" });
      try {
        const raw = await request("/api/autosave", {
          method: "POST",
          body: JSON.stringify(command),
        });
        if (
          !isRecord(raw) ||
          !["saved", "draft", "conflict"].includes(String(raw.phase)) ||
          typeof raw.draftRevision !== "number" ||
          typeof raw.message !== "string" ||
          typeof raw.savedAt !== "string"
        )
          throw new Error("自动保存响应无效。");
        const receipt = raw as unknown as SaveReceipt<T>;
        if (receipt.project) receipt.project = decodeProject(receipt.project);
        if (generation !== epoch.current) return receipt;
        doc.current.revision = receipt.draftRevision;
        pending.current = null;
        ack.current = fingerprint(command.snapshot);
        failures.current = 0;
        if (receipt.phase === "saved" && receipt.project) {
          markCurrent(receipt.project);
          setItems((previous) => [
            {
              id: receipt.project!.id,
              title: receipt.project!.title,
              revision: receipt.project!.revision,
              updatedAt: receipt.project!.updatedAt,
            },
            ...previous.filter(
              (p) =>
                p.id !== receipt.project!.id &&
                p.id !== "draft:" + doc.current.id,
            ),
          ]);
          if (fingerprint(workRef.current) === fingerprint(command.snapshot)) {
            const data =
              fingerprint(workRef.current.data) ===
              fingerprint(receipt.project.data)
                ? workRef.current.data
                : receipt.project.data;
            const canonical = {
              ...workRef.current,
              title: receipt.project.title,
              data,
            };
            if (
              canonical.title !== workRef.current.title ||
              canonical.data !== workRef.current.data
            )
              update(canonical, false);
            ack.current = fingerprint(canonical);
          }
        }
        if (receipt.phase !== "saved")
          setItems((previous) => [
            {
              id: "draft:" + doc.current.id,
              title: "草稿 · " + (command.snapshot.title.trim() || "未命名"),
              revision: receipt.draftRevision,
              updatedAt: receipt.savedAt,
            },
            ...previous.filter((p) => p.id !== "draft:" + doc.current.id),
          ]);
        conflicted.current = receipt.phase === "conflict";
        clearSaveError();
        const changed =
          fingerprint(workRef.current) !== ack.current && !conflicted.current;
        setAutoState({
          phase: changed ? "pending" : receipt.phase,
          message: changed ? "有新更改，等待自动保存…" : receipt.message,
          savedAt: receipt.savedAt,
        });
        await cache().catch(() => {});
        return receipt;
      } catch (e) {
        if (generation !== epoch.current) return null;
        const status =
          e instanceof Error && "status" in e && typeof e.status === "number"
            ? e.status
            : 0;
        const conflict = status === 409,
          rejected =
            status >= 400 && status < 500 && status !== 409 && status !== 429;
        conflicted.current = conflict;
        failures.current++;
        if (rejected) {
          pending.current = null;
          blocked.current = fingerprint(command.snapshot);
        }
        setAutoState({
          phase: conflict ? "conflict" : "offline",
          message: conflict
            ? "草稿发生冲突，本机输入已保留。"
            : rejected
              ? (local
                  ? "草稿已暂存本机，暂不能同步。 "
                  : "自动保存未完成。 ") +
                (e instanceof Error ? e.message : "请检查输入。")
              : local
                ? "草稿已暂存本机，连接恢复后重试。"
                : "自动保存未完成，请保持页面打开或导出草稿。",
          savedAt: "",
        });
        await cache().catch(() => {});
        if (force) saveReport(e);
        return null;
      } finally {
        flight.current = null;
        setTick((x) => x + 1);
      }
    })();
    flight.current = task;
    return task;
  }
  const signature = fingerprint(work),
    dirty = signature !== ack.current;
  useEffect(() => {
    if (
      !loaded.current ||
      !edited.current ||
      conflicted.current ||
      (!dirty && !pending.current) ||
      blocked.current === signature
    )
      return;
    if (blocked.current !== signature) blocked.current = null;
    if (!flight.current)
      setAutoState((previous) =>
        previous.phase === "offline"
          ? previous
          : { ...previous, phase: "pending", message: "等待自动保存…" },
      );
    const local = setTimeout(() => {
      void cache().catch(() => {});
    }, 120);
    const delay = failures.current
      ? Math.min(30000, 1500 * 2 ** Math.min(failures.current - 1, 4))
      : 700;
    const timer = setTimeout(() => {
      void persist();
    }, delay);
    return () => {
      clearTimeout(local);
      clearTimeout(timer);
    };
  }, [signature, loading, loadEpoch, tick]);
  useEffect(() => {
    const wake = () => setTick((x) => x + 1);
    window.addEventListener("online", wake);
    return () => window.removeEventListener("online", wake);
  }, []);
  useEffect(() => {
    const before = (e: BeforeUnloadEvent) => {
      if (fingerprint(workRef.current) !== ack.current || pending.current) {
        void cache().catch(() => {});
        e.preventDefault();
        e.returnValue = "";
      }
    };
    window.addEventListener("beforeunload", before);
    return () => window.removeEventListener("beforeunload", before);
  }, []);
  async function leave() {
    if (!dirty && !pending.current && !conflicted.current) return true;
    if (!conflicted.current) await persist();
    if (fingerprint(workRef.current) === ack.current && !conflicted.current)
      return true;
    try {
      await cache();
      return confirm(
        "草稿尚未完全同步。已保留本机草稿，可从项目列表找回。切换项目吗？",
      );
    } catch {
      saveReport("草稿尚未同步，且无法写入本机存储。请导出恢复草稿。");
      return confirm(
        "草稿尚未同步，且无法暂存本机。切换将丢失当前更改；建议先取消并导出恢复草稿。仍要放弃并切换吗？",
      );
    }
  }
  async function save(override?: T) {
    if (override !== undefined) setData(override);
    setBusy(true);
    clearSaveError();
    try {
      const receipt = await persist(true);
      if (receipt) {
        if (receipt.phase !== "saved") {
          saveReport(receipt.message);
          return null;
        }
        return receipt.project;
      }
      return autoState.phase === "draft" ||
        conflicted.current ||
        pending.current ||
        fingerprint(workRef.current) !== ack.current
        ? null
        : currentRef.current;
    } finally {
      setBusy(false);
    }
  }
  async function open(id: string): Promise<boolean> {
    if (!(await leave())) return false;
    setBusy(true);
    setError("");
    try {
      if (id.startsWith("local:")) {
        restoreLocal(await localCopy(id.slice(6)));
      } else if (id.startsWith("draft:")) {
        const d = await request("/api/autosave/" + id.slice(6));
        if (!validRecord(d)) throw new Error("草稿不存在。");
        const project = d.receipt.project
          ? decodeProject(d.receipt.project)
          : d.projectId
            ? decodeProject(await request("/api/projects/" + d.projectId))
            : null;
        reset(decodeWork(d.snapshot), project, true, d);
      } else {
        const [raw, d] = await Promise.all([
          request("/api/projects/" + id),
          request("/api/autosave/project/" + id),
        ]);
        const project = decodeProject(raw);
        if (
          validRecord(d) &&
          d.projectRevision === project.revision &&
          d.receipt.phase !== "conflict"
        )
          reset(decodeWork(d.snapshot), project, true, d);
        else
          reset(
            { title: project.title, data: project.data, extra: {} },
            project,
            true,
          );
      }
      return true;
    } catch (e) {
      report(e);
      return false;
    } finally {
      setBusy(false);
    }
  }
  async function fresh(): Promise<boolean> {
    if (!(await leave())) return false;
    reset(
      { title: defaultTitle, data: structuredClone(seed), extra: {} },
      null,
      true,
    );
    return true;
  }
  async function replace(
    data: T,
    title: string,
    extra: Record<string, unknown> = {},
  ): Promise<boolean> {
    if (!(await leave())) return false;
    reset({ title, data, extra }, null, false);
    return true;
  }
  async function remove(): Promise<boolean> {
    const selected = currentRef.current;
    if (
      !selected ||
      !confirm("删除「" + selected.title + "」？此操作不能撤销。")
    )
      return false;
    while (flight.current) await flight.current;
    setBusy(true);
    setError("");
    try {
      const c = currentRef.current ?? selected;
      await request("/api/projects/" + c.id, {
        method: "DELETE",
        body: JSON.stringify({ revision: c.revision }),
      });
      await request("/api/autosave/" + doc.current.id, {
        method: "DELETE",
      }).catch(() => {});
      await clearCache(storageKey + ":" + doc.current.id).catch(() => {});
      reset(
        { title: defaultTitle, data: structuredClone(seed), extra: {} },
        null,
        true,
      );
      await refresh();
      return true;
    } catch (e) {
      report(e);
      return false;
    } finally {
      setBusy(false);
    }
  }
  const exportDraft = () =>
    download(
      new Blob([JSON.stringify(cacheValue(), null, 2)], {
        type: "application/json",
      }),
      "workbench-working-copy.json",
    );
  return {
    items,
    current,
    data: work.data,
    setData,
    title: work.title,
    setTitle,
    draft: work.extra,
    setDraft,
    busy,
    error,
    setError,
    report,
    notice,
    setNotice,
    loading,
    dirty,
    autoState,
    documentKey: doc.current.id + "-" + loadEpoch,
    loadEpoch,
    refresh,
    save,
    open,
    fresh,
    replace,
    remove,
    exportDraft,
  };
}
