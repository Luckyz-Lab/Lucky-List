import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";
import type { Task, UserSettings } from "@/lib/types";
import {
  createDefaultSettingsForUser,
  rowToSettings,
  rowToSubtask,
  rowToTask,
  settingsToRow,
  subtaskToRow,
  taskToRow,
} from "./mappers";

export type TaskRepository = {
  listTasks: () => Promise<Task[]>;
  getSettings: () => Promise<UserSettings>;
  saveTask: (task: Task) => Promise<Task>;
  deleteTask: (task: Task) => Promise<Task>;
  archiveTask: (task: Task, archived: boolean) => Promise<Task>;
  saveSettings: (settings: UserSettings) => Promise<UserSettings>;
  importTasks: (tasks: Task[]) => Promise<Task[]>;
};

export function createTaskRepository(client: SupabaseClient<Database>, userId: string): TaskRepository {
  async function saveTask(task: Task) {
    const taskRow = taskToRow(task, userId);
    const { error: taskError } = await client.from("tasks").upsert(taskRow);
    if (taskError) throw taskError;

    const { error: deleteSubtasksError } = await client.from("subtasks").delete().eq("task_id", task.id);
    if (deleteSubtasksError) throw deleteSubtasksError;

    const subtaskRows = task.subtasks.filter((subtask) => !subtask.deletedAt).map((subtask) => subtaskToRow(subtask, userId));
    if (subtaskRows.length) {
      const { error: subtaskError } = await client.from("subtasks").insert(subtaskRows);
      if (subtaskError) throw subtaskError;
    }

    return task;
  }

  return {
    async listTasks() {
      const { data: taskRows, error: taskError } = await client
        .from("tasks")
        .select("*")
        .eq("user_id", userId)
        .order("updated_at", { ascending: false });
      if (taskError) throw taskError;

      const taskIds = (taskRows ?? []).map((task) => task.id);
      const subtasksByTask = new Map<string, ReturnType<typeof rowToSubtask>[]>();

      if (taskIds.length) {
        const { data: subtaskRows, error: subtaskError } = await client
          .from("subtasks")
          .select("*")
          .eq("user_id", userId)
          .in("task_id", taskIds)
          .order("position", { ascending: true });
        if (subtaskError) throw subtaskError;

        for (const row of subtaskRows ?? []) {
          const list = subtasksByTask.get(row.task_id) ?? [];
          list.push(rowToSubtask(row));
          subtasksByTask.set(row.task_id, list);
        }
      }

      return (taskRows ?? []).map((task) => rowToTask(task, subtasksByTask.get(task.id) ?? []));
    },

    async getSettings() {
      const { data, error } = await client.from("user_settings").select("*").eq("user_id", userId).maybeSingle();
      if (error) throw error;
      if (data) return rowToSettings(data);

      const settings = createDefaultSettingsForUser(userId);
      const { data: created, error: createError } = await client
        .from("user_settings")
        .upsert(settingsToRow(settings, userId), { onConflict: "user_id" })
        .select("*")
        .single();
      if (createError) throw createError;
      return rowToSettings(created);
    },

    saveTask,

    async deleteTask(task) {
      return saveTask(task);
    },

    async archiveTask(task, archived) {
      return saveTask({ ...task, archivedAt: archived ? task.archivedAt : null });
    },

    async saveSettings(settings) {
      const { data, error } = await client
        .from("user_settings")
        .upsert(settingsToRow(settings, userId), { onConflict: "user_id" })
        .select("*")
        .single();
      if (error) throw error;
      return rowToSettings(data);
    },

    async importTasks(tasks) {
      const saved: Task[] = [];
      for (const task of tasks) {
        saved.push(await saveTask(task));
      }
      return saved;
    },
  };
}

