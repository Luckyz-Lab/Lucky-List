import { defaultSettings } from "@/lib/sample-data";
import type { Database, Json } from "@/lib/supabase/database.types";
import type { RepeatRule, Subtask, Task, UserSettings } from "@/lib/types";
import { nowIso } from "@/lib/utils";
import { repeatRuleSchema, taskSchema, userSettingsSchema } from "./schema";

export type TaskRow = Database["public"]["Tables"]["tasks"]["Row"];
export type TaskInsert = Database["public"]["Tables"]["tasks"]["Insert"];
export type SubtaskRow = Database["public"]["Tables"]["subtasks"]["Row"];
export type SubtaskInsert = Database["public"]["Tables"]["subtasks"]["Insert"];
export type SettingsRow = Database["public"]["Tables"]["user_settings"]["Row"];
export type SettingsInsert = Database["public"]["Tables"]["user_settings"]["Insert"];

function repeatRuleFromJson(value: Json): RepeatRule {
  const parsed = repeatRuleSchema.safeParse(value);
  return parsed.success ? parsed.data : { frequency: "none" };
}

function repeatRuleToJson(rule: RepeatRule): Json {
  return repeatRuleSchema.parse(rule) as Json;
}

export function taskToRow(task: Task, userId: string): TaskInsert {
  const normalized = taskSchema.parse({ ...task, userId });
  return {
    id: normalized.id,
    user_id: userId,
    title: normalized.title,
    notes: normalized.notes || null,
    category: normalized.category || null,
    priority: normalized.priority,
    estimate_minutes: normalized.estimateMinutes,
    progress: normalized.progress,
    board_state: normalized.boardState,
    start_date: normalized.startDate || null,
    due_at: normalized.dueAt || null,
    reminder_at: normalized.reminderAt || null,
    repeat_rule: repeatRuleToJson(normalized.repeatRule),
    archived_at: normalized.archivedAt || null,
    deleted_at: normalized.deletedAt || null,
    completed_at: normalized.completedAt || null,
    created_at: normalized.createdAt,
    updated_at: normalized.updatedAt,
  };
}

export function subtaskToRow(subtask: Subtask, userId: string): SubtaskInsert {
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

export function rowToSubtask(row: SubtaskRow): Subtask {
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

export function rowToTask(row: TaskRow, subtasks: Subtask[] = []): Task {
  return taskSchema.parse({
    id: row.id,
    userId: row.user_id,
    title: row.title,
    notes: row.notes ?? "",
    category: row.category ?? "",
    priority: row.priority,
    estimateMinutes: row.estimate_minutes ?? 30,
    progress: row.progress,
    boardState: row.board_state,
    startDate: row.start_date,
    dueAt: row.due_at,
    reminderAt: row.reminder_at,
    repeatRule: repeatRuleFromJson(row.repeat_rule),
    archivedAt: row.archived_at,
    deletedAt: row.deleted_at,
    completedAt: row.completed_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    subtasks,
  });
}

export function settingsToRow(settings: UserSettings, userId: string): SettingsInsert {
  const normalized = userSettingsSchema.parse({ ...settings, userId });
  return {
    id: normalized.id,
    user_id: userId,
    theme: normalized.theme,
    deadline_threshold_days: normalized.deadlineThresholdDays,
    categories: normalized.categories,
    notifications_enabled: normalized.notificationsEnabled,
    default_reminder_mode: normalized.defaultReminderMode,
    daily_digest_enabled: normalized.dailyDigestEnabled,
    daily_digest_time: normalized.dailyDigestTime,
    daily_capacity_minutes: normalized.dailyCapacityMinutes,
    auto_backup_minutes: normalized.autoBackupMinutes,
    last_synced_at: normalized.lastSyncedAt ?? null,
    updated_at: normalized.updatedAt,
  };
}

export function rowToSettings(row: SettingsRow): UserSettings {
  return userSettingsSchema.parse({
    id: row.id,
    userId: row.user_id,
    theme: row.theme,
    deadlineThresholdDays: row.deadline_threshold_days,
    categories: row.categories,
    notificationsEnabled: row.notifications_enabled,
    defaultReminderMode: row.default_reminder_mode ?? "day-start",
    dailyDigestEnabled: row.daily_digest_enabled ?? true,
    dailyDigestTime: row.daily_digest_time ?? "09:00",
    dailyCapacityMinutes: row.daily_capacity_minutes ?? 360,
    autoBackupMinutes: row.auto_backup_minutes,
    lastSyncedAt: row.last_synced_at,
    updatedAt: row.updated_at,
  });
}

export function createDefaultSettingsForUser(userId: string): UserSettings {
  return {
    ...defaultSettings,
    id: `settings_${userId}`,
    userId,
    lastSyncedAt: null,
    updatedAt: nowIso(),
  };
}
