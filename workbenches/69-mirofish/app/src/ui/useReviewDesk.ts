import { useEffect, useMemo, useRef, useState } from "react";
import { useProjects, request, download } from "./workspace";
import { isRecord } from "../contracts/project";
import {
  seed,
  reviewValue,
  fromNative,
  nativeResult,
  actorKey,
  actionKey,
  content,
  markdown,
  type Review,
} from "../contracts/simulation";
export function useReviewDesk() {
  const p = useProjects(seed, reviewValue, "周末市集 · 情景复核", {
    storageKey: "mirofish-review-v1",
  });
  const [importOpen, setImportOpen] = useState(false),
    [io, setIo] = useState(false),
    [service, setService] = useState({
      available: false,
      message: "正在检查MiroFish…",
    }),
    [simulations, setSimulations] = useState<
      Array<{ id: string; status: string }>
    >([]);
  const file = useRef<HTMLInputElement>(null),
    bundle = useRef<HTMLInputElement>(null),
    epoch = useRef(p.documentKey);
  epoch.current = p.documentKey;
  const mutable = !p.loading && !p.busy && !io;
  const raw = typeof p.draft.nativeRaw === "string" ? p.draft.nativeRaw : "",
    platform =
      typeof p.draft.logPlatform === "string" ? p.draft.logPlatform : "",
    rawActor = typeof p.draft.actor === "string" ? p.draft.actor : "all",
    rawRound = typeof p.draft.round === "string" ? p.draft.round : "all",
    selected = typeof p.draft.selected === "string" ? p.draft.selected : "";
  const actors = useMemo(
      () => [...new Map(p.data.actions.map((a) => [actorKey(a), a])).values()],
      [p.data.actions],
    ),
    rounds = useMemo(
      () =>
        [...new Set(p.data.actions.map((a) => a.round_num))].sort(
          (a, b) => a - b,
        ),
      [p.data.actions],
    );
  const actor = actors.some((a) => actorKey(a) === rawActor) ? rawActor : "all",
    round = rounds.some((r) => String(r) === rawRound) ? rawRound : "all";
  const filtered = p.data.actions
    .map((a, i) => ({ a, i, key: actionKey(a, i) }))
    .filter(
      ({ a }) =>
        (actor === "all" || actorKey(a) === actor) &&
        (round === "all" || String(a.round_num) === round),
    );
  const chosen = filtered.find((x) => x.key === selected) ?? filtered[0],
    note = chosen ? p.data.annotations[chosen.key] : undefined,
    reviewed = Object.values(p.data.annotations).filter(
      (n) => n.reviewed,
    ).length;
  async function check() {
    try {
      const v = await request("/api/service");
      if (isRecord(v)) {
        setService({
          available: v.available === true,
          message: String(v.message),
        });
        if (v.available === true) {
          const list = await request("/api/simulations");
          if (!Array.isArray(list)) throw new Error("模拟列表无效");
          setSimulations(
            list.map((v) => {
              if (
                !isRecord(v) ||
                typeof v.id !== "string" ||
                typeof v.status !== "string"
              )
                throw new Error("模拟列表无效");
              return { id: v.id, status: v.status };
            }),
          );
        }
      }
    } catch (e) {
      p.report(e);
    }
  }
  useEffect(() => {
    void check();
  }, []);
  function annotate(patch: { note?: string; reviewed?: boolean }) {
    if (chosen)
      p.setData((d) => ({
        ...d,
        annotations: {
          ...d.annotations,
          [chosen.key]: {
            ...(d.annotations[chosen.key] ?? { note: "", reviewed: false }),
            ...patch,
          },
        },
      }));
  }
  async function readNative(f?: File) {
    if (!f) return;
    const key = epoch.current;
    setIo(true);
    try {
      if (f.size > 850000) throw new Error("结果超过850KB，请按轮次拆分导出。");
      const text = await f.text();
      if (key !== epoch.current) return;
      p.setDraft((d) => ({ ...d, nativeRaw: text, nativeName: f.name }));
      setImportOpen(true);
    } catch (e) {
      p.report(e);
    } finally {
      setIo(false);
    }
  }
  async function applyNative() {
    setIo(true);
    try {
      const name =
        typeof p.draft.nativeName === "string"
          ? p.draft.nativeName
          : "粘贴的模拟结果";
      const result = fromNative(raw, name, platform);
      if (
        await p.replace(result, result.simulationId || name, {
          nativeRaw: raw,
          logPlatform: platform,
        })
      )
        setImportOpen(false);
    } catch (e) {
      p.report(e);
    } finally {
      setIo(false);
    }
  }
  async function importBundle(f?: File) {
    if (!f) return;
    setIo(true);
    try {
      if (f.size > 12 * 1024 * 1024)
        throw new Error("复核工程或恢复稿不能超过12MB");
      let v: unknown = JSON.parse(await f.text());
      if (isRecord(v) && isRecord(v.snapshot))
        v = {
          format: "floatboat-mirofish-v1",
          title: v.snapshot.title,
          data: v.snapshot.data,
          draft: v.snapshot.extra,
        };
      if (
        !isRecord(v) ||
        v.format !== "floatboat-mirofish-v1" ||
        typeof v.title !== "string"
      )
        throw new Error("复核工程格式无效");
      await p.replace(
        reviewValue(v.data),
        v.title,
        isRecord(v.draft) ? v.draft : {},
      );
    } catch (e) {
      p.report(e);
    } finally {
      setIo(false);
    }
  }
  async function fromService(id: string) {
    if (!id) return;
    const key = epoch.current;
    setIo(true);
    try {
      const result = reviewValue(
        await request("/api/simulations/" + encodeURIComponent(id) + "/result"),
      );
      if (key === epoch.current) await p.replace(result, id);
    } catch (e) {
      if (key === epoch.current) p.report(e);
    } finally {
      setIo(false);
    }
  }
  async function fresh() {
    setIo(true);
    try {
      return await p.fresh();
    } finally {
      setIo(false);
    }
  }
  async function open(id: string) {
    setIo(true);
    try {
      return await p.open(id);
    } finally {
      setIo(false);
    }
  }
  return {
    p: { ...p, fresh, open },
    mutable,
    raw,
    platform,
    actor,
    round,
    actors,
    rounds,
    filtered,
    chosen,
    note,
    reviewed,
    importOpen,
    setImportOpen,
    file,
    bundle,
    service,
    simulations,
    check,
    annotate,
    readNative,
    applyNative,
    importBundle,
    fromService,
  };
}
