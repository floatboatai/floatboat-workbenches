import { useRef, type SetStateAction } from "react";
import {
  seed,
  validateProject,
  restoreProjectDraft,
  restoreWorkingCopy,
  type EvidenceProject,
  type EvidenceWorkingCopy,
} from "../contracts/evidence";
import { useProjects } from "./workspace";

/** Keep the whole edited snapshot below the recovery and wire budgets. */
export function useEvidenceProjects() {
  const project = useProjects(seed, validateProject, "青禾展览 · 采购访谈", {
    storageKey: "langextract-evidence-v1",
    restoreDraftData: restoreProjectDraft,
  });
  const work = useRef<EvidenceWorkingCopy>({
    title: project.title,
    data: project.data,
    extra: project.draft,
  });
  work.current = {
    title: project.title,
    data: project.data,
    extra: project.draft,
  };
  const ownedError = useRef<string | null>(null);
  function checked(next: EvidenceWorkingCopy): EvidenceWorkingCopy | null {
    try {
      const value = restoreWorkingCopy(next);
      if (ownedError.current) {
        const previous = ownedError.current;
        project.setError((error) => (error === previous ? "" : error));
        ownedError.current = null;
      }
      return value;
    } catch (error) {
      ownedError.current =
        error instanceof Error ? error.message : "工作稿容量不足。";
      project.setError(ownedError.current);
      return null;
    }
  }
  return {
    ...project,
    setData(value: SetStateAction<EvidenceProject>): boolean {
      const data =
        typeof value === "function" ? value(work.current.data) : value;
      const next = checked({ ...work.current, data });
      if (!next) return false;
      work.current = next;
      project.setData(next.data);
      return true;
    },
    setDraft(value: SetStateAction<Record<string, unknown>>): boolean {
      const extra =
        typeof value === "function" ? value(work.current.extra) : value;
      const next = checked({ ...work.current, extra });
      if (!next) return false;
      work.current = next;
      project.setDraft(next.extra);
      return true;
    },
    setTitle(value: SetStateAction<string>): boolean {
      const title =
        typeof value === "function" ? value(work.current.title) : value;
      const next = checked({ ...work.current, title });
      if (!next) return false;
      work.current = next;
      project.setTitle(next.title);
      return true;
    },
    async replace(
      data: EvidenceProject,
      title: string,
      extra: Record<string, unknown> = {},
    ): Promise<boolean> {
      const next = checked({ title, data, extra });
      if (!next) return false;
      const replaced = await project.replace(next.data, next.title, next.extra);
      if (replaced) work.current = next;
      return replaced;
    },
  };
}
