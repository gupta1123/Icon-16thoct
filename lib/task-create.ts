export interface TaskCreatePayload {
  taskTitle: string;
  // The backend contract uses this spelling.
  taskDesciption: string;
  taskType: "complaint" | "requirement";
  dueDate: string;
  assignedToId: number;
  assignedById: number;
  storeId: number;
  status: string;
  priority: string;
  visitId?: number;
}

export function buildTaskCreatePayload<T extends TaskCreatePayload["taskType"]>(
  task: TaskCreatePayload & { taskType: T },
): TaskCreatePayload & { taskType: T } {
  const taskTitle = task.taskTitle.trim();
  if (!taskTitle) throw new Error("Please enter a title.");
  for (const [label, id] of [
    ["assigned employee", task.assignedToId],
    ["assigning employee", task.assignedById],
    ["store", task.storeId],
  ] as const) {
    if (!Number.isSafeInteger(id) || id <= 0) throw new Error(`Please select a valid ${label}.`);
  }
  if (task.visitId !== undefined && (!Number.isSafeInteger(task.visitId) || task.visitId <= 0)) {
    throw new Error("Could not identify the visit. Reload the page and try again.");
  }

  const dueDate = task.dueDate.split("T")[0];
  const parsedDueDate = new Date(`${dueDate}T00:00:00Z`);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dueDate) || !Number.isFinite(parsedDueDate.getTime()) || parsedDueDate.toISOString().slice(0, 10) !== dueDate) {
    throw new Error("Please select a valid due date.");
  }
  if (!["high", "medium", "low"].includes(task.priority)) {
    throw new Error("Please select a complaint or requirement type.");
  }

  return {
    taskTitle,
    taskDesciption: task.taskDesciption.trim(),
    taskType: task.taskType,
    dueDate,
    assignedToId: task.assignedToId,
    assignedById: task.assignedById,
    storeId: task.storeId,
    status: task.status || "Assigned",
    priority: task.priority,
    ...(task.visitId !== undefined ? { visitId: task.visitId } : {}),
  };
}
