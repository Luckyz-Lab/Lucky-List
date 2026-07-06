import { addDays, addMonths, addWeeks, format, isValid, parseISO } from "date-fns";
import type { RepeatFrequency, Task } from "./types";
import { nowIso, uid } from "./utils";

function shiftDate(value: string | null | undefined, frequency: RepeatFrequency) {
  if (!value || frequency === "none") return value ?? null;

  const date = parseISO(value);
  if (!isValid(date)) return value;

  const shifted =
    frequency === "daily"
      ? addDays(date, 1)
      : frequency === "weekly"
        ? addWeeks(date, 1)
        : addMonths(date, 1);

  return value.includes("T") ? shifted.toISOString() : format(shifted, "yyyy-MM-dd");
}

export function createNextRecurringTask(task: Task) {
  const frequency = task.repeatRule.frequency;
  if (frequency === "none") return null;

  const stamp = nowIso();
  const nextId = uid("task");

  return {
    ...task,
    id: nextId,
    progress: 0,
    boardState: "todo",
    startDate: shiftDate(task.startDate, frequency),
    dueAt: shiftDate(task.dueAt, frequency),
    reminderAt: shiftDate(task.reminderAt, frequency),
    archivedAt: null,
    deletedAt: null,
    completedAt: null,
    createdAt: stamp,
    updatedAt: stamp,
    subtasks: task.subtasks.map((subtask, index) => ({
      ...subtask,
      id: uid("subtask"),
      taskId: nextId,
      progress: 0,
      position: index,
      completedAt: null,
      deletedAt: null,
      updatedAt: stamp,
    })),
  } satisfies Task;
}
