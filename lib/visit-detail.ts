import type { Task } from './api';

export function calculateDuration(start: string, end: string): string {
  const toSeconds = (value: string) => {
    if (!/^\d{2}:\d{2}(:\d{2}(\.\d+)?)?$/.test(value)) return NaN;
    const [h, m, s = 0] = value.split(':').map(Number);
    return h < 24 && m < 60 && s < 60 ? h * 3600 + m * 60 + s : NaN;
  };
  const seconds = (toSeconds(end) - toSeconds(start) + 86400) % 86400;
  if (!Number.isFinite(seconds)) return 'Duration unavailable';
  const minutes = Math.floor(seconds / 60);
  return minutes >= 60 ? `${Math.floor(minutes / 60)}h ${minutes % 60}m` : `${minutes}m`;
}

export function filterVisitHistory<T extends { purpose?: string | null }>(visits: T[], query: string): T[] {
  const search = query.trim().toLowerCase();
  return search ? visits.filter(visit => (visit.purpose || '').toLowerCase().includes(search)) : visits;
}

export type VisitTask = Task & {
  createdAt?: string;
  updatedAt?: string;
  storeName?: string;
  storeCity?: string;
  assignedBy?: string;
};

/** Icon returns both task DTO keys and normalized task keys across endpoints. */
export function normalizeVisitTask(value: unknown, type: string, visitId: number): VisitTask {
  const row = (value && typeof value === 'object' ? value : {}) as Record<string, unknown>;
  const text = (...keys: string[]) => {
    for (const key of keys) if (typeof row[key] === 'string' && row[key].trim()) return row[key].trim();
    return '';
  };
  return {
    id: Number(row.id),
    title: text('title', 'taskTitle'),
    description: text('description', 'taskDesciption', 'taskDescription'),
    type: text('type', 'taskType') || type,
    status: text('status'),
    priority: text('priority').toLowerCase(),
    assignedTo: text('assignedTo', 'assignedToName'),
    dueDate: text('dueDate'),
    visitId: Number(row.visitId) || visitId,
    createdAt: text('createdAt'),
    updatedAt: text('updatedAt'),
    storeName: text('storeName'),
    storeCity: text('storeCity'),
    assignedBy: text('assignedBy', 'assignedByName'),
  };
}
