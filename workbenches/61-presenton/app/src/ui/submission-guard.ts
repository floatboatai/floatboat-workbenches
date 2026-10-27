import { terminalJob, type LocalOperation } from "../contracts/operation.ts";
import type { Job } from "../contracts/jobs.ts";

// Persisted intent remains a guard even when both the POST receipt and every
// history read are unavailable. A failed/404 lookup never proves no task ran.
export async function allowNewSubmission(options: {
  operation: LocalOperation | null;
  jobs: Job[];
  projectId: string;
  query: (id: string) => Promise<Job>;
  confirm: (message: string) => boolean;
}): Promise<boolean> {
  const unresolved = new Set(
    options.jobs
      .filter((job) => job.projectId === options.projectId && !terminalJob(job))
      .map((job) => job.id),
  );
  if (options.operation) {
    const id = options.operation.id;
    let existing = options.jobs.find((job) => job.id === id);
    if (!existing || !terminalJob(existing)) {
      try {
        existing = await options.query(id);
      } catch {
        existing = undefined;
      }
    }
    if (existing && terminalJob(existing)) unresolved.delete(id);
    else unresolved.add(id);
  }
  if (!unresolved.size) return true;
  return options.confirm(
    `先前操作 ${[...unresolved].join("、")} 的结果尚未确认，或仍可能在制作中。再次制作会创建新任务并可能产生额外费用。是否明确创建新任务？`,
  );
}
