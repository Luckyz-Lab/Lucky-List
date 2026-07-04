"use client";

import type { SupabaseClient } from "@supabase/supabase-js";
import { db } from "./local-db";
import type { MutationQueueItem, Subtask, Task, UserSettings } from "../types";
import { nowIso, uid } from "../utils";

type TaskRow = {
  id: string;
  user_id: string;
  title: string;
  notes: string | null;
  category: string | null;
  priority: string;
  progress: number;
  board_state: string;
  start_date: string | null;
  due_at: string | null;
  reminder_at: string | null;
  repeat_rule: unknown;
  archived_at: string | null;
  deleted_at: string | null;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
};

type SubtaskRow = {
  id: string;
  user_id: string;
  task_id: string;
  title: string;
  progress: number;
  position: number;
  completed_at: string | null;
  deleted_at: string | null;
  updated_at: string;
};

function taskToRow(task: Task, userId: string): TaskRow {
  return {
    id: task.id,
    user_id: userId,
    title: task.title,
    notes: task.notes || null,
    category: task.category || null,
    priority: task.priority,
    progress: task.progress,
    board_state: task.boardState,
    start_date: task.startDate || null,
    due_at: task.dueAt || null,
    reminder_at: task.reminderAt || null,
    repeat_rule: task.repeatRule,
    archived_at: task.archivedAt || null,
    deleted_at: task.deletedAt || null,
    completed_at: task.completedAt || null,
    created_at: task.createdAt,
    updated_at: task.updatedAt,
  };
}

function subtaskToRow(subtask: Subtask, userId: string): SubtaskRow {
  return {
    id: subtask.id,
    user_id: userId,
    task_id: subtask.taskId,
    title: subtask.title,
    progress: subtask.progress,
    position: subtask.position,
    completed_at: subtask.completedAt || null,
    deleted_at: subtask.deletedAt || null,
    updated_at: subtask.updatedAt,
  };
}

function rowToTask(row: TaskRow, subtasks: Subtask[]): Task {
  return {
    id: row.id,
    userId: row.user_id,
    title: row.title,
    notes: row.notes ?? "",
    category: row.category ?? "",
    priority: row.priority as Task["priority"],
    progress: row.progress,
    boardState: row.board_state as Task["boardState"],
    startDate: row.start_date,
    dueAt: row.due_at,
    reminderAt: row.reminder_at,
    repeatRule: (row.repeat_rule as Task["repeatRule"]) ?? { frequency: "none" },
    archivedAt: row.archived_at,
    deletedAt: row.deleted_at,
    completedAt: row.completed_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    subtasks,
  };
}

function rowToSubtask(row: SubtaskRow): Subtask {
  return {
    id: row.id,
    taskId: row.task_id,
    title: row.title,
    progress: row.progress,
    position: row.position,
    completedAt: row.completed_at,
    deletedAt: row.deleted_at,
    updatedAt: row.updated_at,
  };
}

export async function enqueueTask(task: Task, operation: MutationQueueItem["operation"] = "upsert") {
  await db.queue.put({
    id: uid("queue"),
    entity: "task",
    operation,
    payload: task,
    createdAt: nowIso(),
    attempts: 0,
  });
}

export async function enqueueSettings(settings: UserSettings) {
  await db.queue.put({
    id: uid("queue"),
    entity: "settings",
    operation: "upsert",
    payload: settings,
    createdAt: nowIso(),
    attempts: 0,
  });
}

export async function syncWithSupabase(client: SupabaseClient, userId: string) {
  const queue = await db.queue.orderBy("createdAt").toArray();

  for (const item of queue) {
    try {
      if (item.entity === "task") {
        const task = item.payload as Task;
        await client.from("tasks").upsert(taskToRow(task, userId));
        if (task.subtasks.length) {
          await client.from("subtasks").upsert(task.subtasks.map((subtask) => subtaskToRow(subtask, userId)));
        }
      }
      if (item.entity === "settings") {
        const settings = item.payload as UserSettings;
        await client.from("user_settings").upsert({
          id: settings.id,
          user_id: userId,
          theme: settings.theme,
          deadline_threshold_days: settings.deadlineThresholdDays,
          categories: settings.categories,
          notifications_enabled: settings.notificationsEnabled,
          auto_backup_minutes: settings.autoBackupMinutes,
          last_synced_at: settings.lastSyncedAt,
          updated_at: settings.updatedAt,
        });
      }
      await db.queue.delete(item.id);
    } catch (error) {
      await db.queue.update(item.id, {
        attempts: item.attempts + 1,
        lastError: error instanceof Error ? error.message : "Unknown sync error",
      });
      throw error;
    }
  }

  const lastSyncedAt = (await db.meta.get("last_synced_at"))?.value ?? "1970-01-01T00:00:00.000Z";
  const { data: taskRows, error: taskError } = await client
    .from("tasks")
    .select("*")
    .gt("updated_at", lastSyncedAt)
    .order("updated_at", { ascending: true });
  if (taskError) throw taskError;

  const taskIds = (taskRows ?? []).map((row) => row.id);
  let subtaskRows: SubtaskRow[] = [];
  if (taskIds.length) {
    const { data, error } = await client.from("subtasks").select("*").in("task_id", taskIds);
    if (error) throw error;
    subtaskRows = data ?? [];
  }

  const subtasksByTask = new Map<string, Subtask[]>();
  subtaskRows.forEach((row) => {
    const list = subtasksByTask.get(row.task_id) ?? [];
    list.push(rowToSubtask(row));
    subtasksByTask.set(row.task_id, list);
  });

  for (const row of taskRows ?? []) {
    const task = rowToTask(row, subtasksByTask.get(row.id) ?? []);
    await db.tasks.put(task);
  }

  const syncedAt = nowIso();
  await db.meta.put({ key: "last_synced_at", value: syncedAt });
  const settings = await db.settings.get("settings_default");
  if (settings) {
    await db.settings.put({ ...settings, lastSyncedAt: syncedAt, updatedAt: nowIso() });
  }
  return { pushed: queue.length, pulled: taskRows?.length ?? 0, syncedAt };
}
