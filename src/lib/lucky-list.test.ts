import { describe, expect, it, beforeEach, vi } from "vitest";
import { savePin, verifyPin, resetPin } from "@/lib/auth/pin";
import { parseImportFileText } from "@/lib/importers";
import { parseQuickAdd } from "@/lib/quick-add";
import { createNextRecurringTask } from "@/lib/recurrence";
import { createDemoTasks } from "@/lib/sample-data";
import { rowToTask, taskToRow } from "@/lib/tasks/mappers";
import { taskSchema } from "@/lib/tasks/schema";
import type { Task } from "@/lib/types";

const baseTask: Task = {
  id: "task_1",
  userId: "user_1",
  title: "Prepare board review",
  notes: "Check the board before standup",
  category: "Project",
  priority: "High",
  progress: 50,
  boardState: "wip",
  startDate: "2026-07-07",
  dueAt: "2026-07-08",
  reminderAt: "2026-07-08T02:00:00.000Z",
  repeatRule: { frequency: "weekly", weekdays: [2] },
  archivedAt: null,
  deletedAt: null,
  completedAt: null,
  createdAt: "2026-07-07T00:00:00.000Z",
  updatedAt: "2026-07-07T01:00:00.000Z",
  subtasks: [
    {
      id: "subtask_1",
      taskId: "task_1",
      title: "Collect notes",
      progress: 25,
      position: 0,
      completedAt: null,
      deletedAt: null,
      updatedAt: "2026-07-07T01:00:00.000Z",
    },
  ],
};

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

beforeEach(() => {
  const store = new Map<string, string>();
  vi.stubGlobal("localStorage", {
    clear: () => store.clear(),
    getItem: (key: string) => store.get(key) ?? null,
    removeItem: (key: string) => {
      store.delete(key);
    },
    setItem: (key: string, value: string) => {
      store.set(key, value);
    },
  });
});

describe("PIN auth", () => {
  it("saves and verifies a local PIN", async () => {
    await savePin("1234");
    await expect(verifyPin("1234")).resolves.toBe(true);
    await expect(verifyPin("9999")).resolves.toBe(false);
    resetPin();
    await expect(verifyPin("1234")).resolves.toBe(false);
  });
});

describe("task mapping and validation", () => {
  it("round-trips task rows through the Supabase mapper", () => {
    const row = taskToRow(baseTask, "user_1");
    const mapped = rowToTask(
      {
        ...row,
        notes: row.notes ?? null,
        category: row.category ?? null,
        priority: row.priority ?? "Normal",
        progress: row.progress ?? 0,
        board_state: row.board_state ?? "todo",
        start_date: row.start_date ?? null,
        due_at: row.due_at ?? null,
        reminder_at: row.reminder_at ?? null,
        repeat_rule: row.repeat_rule ?? { frequency: "none" },
        archived_at: row.archived_at ?? null,
        deleted_at: row.deleted_at ?? null,
        completed_at: row.completed_at ?? null,
        created_at: row.created_at ?? baseTask.createdAt,
        updated_at: row.updated_at ?? baseTask.updatedAt,
      },
      baseTask.subtasks,
    );

    expect(mapped.title).toBe(baseTask.title);
    expect(mapped.boardState).toBe("wip");
    expect(mapped.repeatRule.frequency).toBe("weekly");
    expect(mapped.subtasks).toHaveLength(1);
  });

  it("rejects invalid task progress", () => {
    expect(() => taskSchema.parse({ ...baseTask, progress: 101 })).toThrow();
  });
});

describe("task utilities", () => {
  it("parses quick add metadata", () => {
    const parsed = parseQuickAdd("Review invoices #Finance high tomorrow 09:30");
    expect(parsed?.task.title).toBe("Review invoices");
    expect(parsed?.task.category).toBe("Finance");
    expect(parsed?.task.priority).toBe("High");
    expect(parsed?.task.reminderAt).toContain("T02:30:00.000Z");
  });

  it("normalizes JSON imports", () => {
    const parsed = parseImportFileText(JSON.stringify({ tasks: [baseTask] }), "backup.json");
    expect(parsed.tasks).toHaveLength(1);
    expect(parsed.tasks[0].title).toBe(baseTask.title);
  });

  it("creates the next recurring task", () => {
    const next = createNextRecurringTask(baseTask);
    expect(next?.id).not.toBe(baseTask.id);
    expect(next?.boardState).toBe("todo");
    expect(next?.progress).toBe(0);
    expect(next?.dueAt).toBe("2026-07-15");
  });

  it("creates Supabase-compatible UUIDs for demo tasks", () => {
    const demoTasks = createDemoTasks(8);
    expect(demoTasks).toHaveLength(8);
    for (const task of demoTasks) {
      expect(task.id).toMatch(uuidPattern);
      for (const subtask of task.subtasks) {
        expect(subtask.id).toMatch(uuidPattern);
        expect(subtask.taskId).toBe(task.id);
      }
    }
  });
});
