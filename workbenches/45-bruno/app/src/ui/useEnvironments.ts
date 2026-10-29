// Environment editing: structured variable tables ⇄ native environments/*.bru,
// with secret values kept only in page memory.
import { useCallback, useEffect, useMemo, useState, type MutableRefObject, type SetStateAction } from "react";
import { environmentName, envVars, type Collection, type EnvVar, type Parsed } from "../contracts/bruno";
import { isRecord } from "../contracts/project";
import { sourceHash } from "./model";
import { bru } from "./native";

type EnvEntry = { vars: EnvVar[]; hash: string | null };
export interface EnvHost {
  data: Collection;
  draft: Record<string, unknown>;
  documentKey: string;
  setData: (v: SetStateAction<Collection>) => void;
  setDraft: (v: SetStateAction<Record<string, unknown>>) => void;
}

function decodeEnv(v: unknown): EnvEntry | null {
  try {
    if (!isRecord(v)) return null;
    return { vars: envVars(v.vars), hash: typeof v.hash === "string" ? v.hash : null };
  } catch {
    return null;
  }
}

export function useEnvironments(latest: MutableRefObject<EnvHost>, parsed: Record<string, Parsed | { error: string }>) {
  const p = latest.current;
  const files = p.data.files;
  const [secrets, setSecrets] = useState<Record<string, Record<string, string>>>({});
  const [envError, setEnvError] = useState<Record<string, string>>({});
  useEffect(() => {
    setSecrets({});
    setEnvError({});
  }, [p.documentKey]);

  const varsFor = useCallback(
    (id: string): EnvVar[] | null => {
      const f = files.find((x) => x.id === id);
      if (!f) return null;
      const entry = decodeEnv(p.draft["env-" + id]);
      if (entry && (entry.hash === null || entry.hash === sourceHash(f.source))) return entry.vars;
      const state = parsed[sourceHash(f.source)];
      return state && !("error" in state) ? (state.environment ?? []) : null;
    },
    [files, p.draft, parsed],
  );
  const setVars = useCallback(
    (id: string, vars: EnvVar[]) => {
      latest.current.setDraft((v) => ({
        ...v,
        ["env-" + id]: { vars: vars.map((x) => (x.secret ? { ...x, value: "" } : x)), hash: null },
      }));
    },
    [latest],
  );
  const pending = useMemo(
    () =>
      Object.entries(p.draft)
        .filter(([k]) => k.startsWith("env-"))
        .map(([k, v]) => [k.slice(4), decodeEnv(v)] as const)
        .filter(([, e]) => e && e.hash === null) as [string, EnvEntry][],
    [p.draft],
  );
  useEffect(() => {
    if (!pending.length) return;
    const key = p.documentKey;
    const timer = setTimeout(() => {
      for (const [id, entry] of pending) {
        const sent = entry.vars;
        void bru("/api/bru/environment", { variables: sent })
          .then((r) => {
            if (!isRecord(r) || typeof r.source !== "string" || latest.current.documentKey !== key) return;
            const source = r.source;
            latest.current.setData((v) => ({ ...v, files: v.files.map((f) => (f.id === id ? { ...f, source } : f)) }));
            latest.current.setDraft((v) => {
              const cur = decodeEnv(v["env-" + id]);
              if (!cur || JSON.stringify(cur.vars) !== JSON.stringify(sent)) return v;
              return { ...v, ["env-" + id]: { vars: sent, hash: sourceHash(source) } };
            });
            setEnvError((m) => ({ ...m, [id]: "" }));
          })
          .catch((e) => {
            if (latest.current.documentKey === key)
              setEnvError((m) => ({ ...m, [id]: "未写入环境文件：" + (e instanceof Error ? e.message : "失败") }));
          });
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [pending, p.documentKey, latest]);

  function add(name: string) {
    const id = crypto.randomUUID();
    latest.current.setData((v) => ({
      ...v,
      files: [...v.files, { id, path: `environments/${name}.bru`, source: "vars {\n  baseUrl: {{$localEcho}}\n}\n" }],
      activeEnvironment: v.activeEnvironment || name,
    }));
  }
  function rename(id: string, name: string) {
    const f = files.find((x) => x.id === id);
    if (!f) return;
    const old = environmentName(f.path);
    latest.current.setData((v) => ({
      ...v,
      files: v.files.map((x) => (x.id === id ? { ...x, path: `environments/${name}.bru` } : x)),
      activeEnvironment: v.activeEnvironment === old ? name : v.activeEnvironment,
    }));
    setSecrets((s) => {
      if (!s[old]) return s;
      const n = { ...s, [name]: s[old] };
      delete n[old];
      return n;
    });
  }
  function remove(id: string) {
    const f = files.find((x) => x.id === id);
    if (!f) return;
    const name = environmentName(f.path);
    latest.current.setData((v) => ({
      ...v,
      files: v.files.filter((x) => x.id !== id),
      activeEnvironment: v.activeEnvironment === name ? undefined : v.activeEnvironment,
    }));
    latest.current.setDraft((v) => {
      const n = { ...v };
      delete n["env-" + id];
      return n;
    });
  }
  /** Marking a variable secret moves its value into memory; unmarking writes it back to the file. */
  function toggleSecret(id: string, env: string, index: number, secret: boolean) {
    const vars = varsFor(id);
    if (!vars?.[index]) return;
    const row = vars[index];
    if (secret) {
      setSecrets((s) => ({ ...s, [env]: { ...s[env], [row.name]: row.value } }));
      setVars(id, vars.map((v, i) => (i === index ? { ...v, secret: true, value: "" } : v)));
    } else {
      const value = secrets[env]?.[row.name] ?? "";
      setVars(id, vars.map((v, i) => (i === index ? { ...v, secret: false, value } : v)));
      setSecrets((s) => {
        const n = { ...s, [env]: { ...s[env] } };
        delete n[env][row.name];
        return n;
      });
    }
  }
  const setSecret = (env: string, name: string, value: string) =>
    setSecrets((s) => ({ ...s, [env]: { ...s[env], [name]: value } }));
  return { secrets, setSecret, varsFor, setVars, envError, add, rename, remove, toggleSecret };
}
