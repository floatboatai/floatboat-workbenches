import type { Project } from '../contracts/project';
export type SavePhase = 'idle' | 'pending' | 'saving' | 'saved' | 'draft' | 'offline' | 'conflict';
export interface WorkingCopy<T> { title: string; data: T; extra: Record<string, unknown> }
export interface SaveRequest<T> {
  documentId: string;
  mutationId: string;
  draftRevision: number;
  projectId: string | null;
  projectRevision: number | null;
  snapshot: WorkingCopy<T>;
}
export interface SaveReceipt<T> {
  phase: 'saved' | 'draft' | 'conflict';
  message: string;
  draftRevision: number;
  project: Project<T> | null;
  savedAt: string;
}
export interface DraftRecord<T> extends SaveRequest<T> {
  revision: number;
  receipt: SaveReceipt<T>;
  updatedAt: string;
}
export interface CachedDraft<T> {
  documentId: string;
  revision: number;
  snapshot: WorkingCopy<T>;
  current: Project<T> | null;
  acknowledged: string;
  pending: SaveRequest<T> | null;
  savedAt: string;
}
export function fingerprint(value: unknown): string { return JSON.stringify(value); }
