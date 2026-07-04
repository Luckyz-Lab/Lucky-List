"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { db } from "./local-db";
import { enqueueSettings, enqueueTask, syncWithSupabase } from "./sync";
import { createClient, hasSupabaseEnv } from "../supabase/client";
import { createSeedTasks, defaultSettings } from "../sample-data";
import type { BoardState, ImportPayload, Subtask, SyncState, Task, TaskPriority, UserSettings } from "../types";
import { downloadText, nowIso, taskToCsvRow, uid } from "../utils";

function normalizeProgress(task: Task): Task {
  if (!task.subtasks.length) return task;
  const active = task.subtasks.filter((subtask) => !subtask.deletedAt);
  if (!active.length) return task;
  const progress = Math.round(active.reduce((sum, subtask) => sum + subtask.progress, 0) / active.length);
  return {
    ...task,
    progress,
    boardState: progress >= 100 ? "done" : task.boardState,
    completedAt: progress >= 100 ? task.completedAt ?? nowIso() : null,
  };
}

export function useLuckyList() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [settings, setSettings] = useState<UserSettings>(defaultSettings);
  const [loading, setLoading] = useState(true);
  const [syncState, setSyncState] = useState<SyncState>("idle");
  const [syncMessage, setSyncMessage] = useState("Local mode");
  const [isAuthed, setIsAuthed] = useState(false);

  const refresh = useCallback(async () => {
    const [localTasks, localSettings] = await Promise.all([
      db.tasks.toArray(),
      db.settings.get("settings_default"),
    ]);
    setTasks(localTasks.filter((task) => !task.deletedAt).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)));
    setSettings(localSettings ?? defaultSettings);
  }, []);

  useEffect(() => {
    let cancelled = false;
    async function boot() {
      const localSettings = await db.settings.get("settings_default");
      if (!localSettings) await db.settings.put(defaultSettings);
      const count = await db.tasks.count();
      if (count === 0) await db.tasks.bulkPut(createSeedTasks());

      const client = createClient();
      const privateSession = localStorage.getItem("lucky_private_session") === "true";
      if (client) {
        const { data } = await client.auth.getSession();
        if (!cancelled) setIsAuthed(Boolean(data.session) || privateSession);
      } else {
        setIsAuthed(privateSession || !hasSupabaseEnv());
      }
      await refresh();
      if (!cancelled) setLoading(false);
    }
    boot();
    return () => {
      cancelled = true;
    };
  }, [refresh]);

  useEffect(() => {
    document.documentElement.classList.toggle("dark", settings.theme !== "light");
  }, [settings.theme]);

  const saveTask = useCallback(
    async (input: Partial<Task> & Pick<Task, "title">) => {
      const stamp = nowIso();
      const existing = input.id ? await db.tasks.get(input.id) : null;
      const task: Task = normalizeProgress({
        id: input.id ?? uid("task"),
        userId: input.userId ?? existing?.userId ?? null,
        title: input.title.trim(),
        notes: input.notes ?? existing?.notes ?? "",
        category: input.category ?? existing?.category ?? "",
        priority: input.priority ?? existing?.priority ?? "Normal",
        progress: input.progress ?? existing?.progress ?? 0,
        boardState: input.boardState ?? existing?.boardState ?? "todo",
        startDate: input.startDate ?? existing?.startDate ?? new Date().toISOString().slice(0, 10),
        dueAt: input.dueAt ?? existing?.dueAt ?? null,
        reminderAt: input.reminderAt ?? existing?.reminderAt ?? null,
        repeatRule: input.repeatRule ?? existing?.repeatRule ?? { frequency: "none" },
        archivedAt: input.archivedAt ?? existing?.archivedAt ?? null,
        deletedAt: input.deletedAt ?? existing?.deletedAt ?? null,
        completedAt: input.completedAt ?? existing?.completedAt ?? null,
        createdAt: existing?.createdAt ?? stamp,
        updatedAt: stamp,
        subtasks: input.subtasks ?? existing?.subtasks ?? [],
      });
      if (task.boardState === "done" || task.progress >= 100) {
        task.progress = 100;
        task.boardState = "done";
        task.completedAt = task.completedAt ?? stamp;
      }
      await db.tasks.put(task);
      await enqueueTask(task);
      await refresh();
      return task;
    },
    [refresh],
  );

  const moveTask = useCallback(
    async (task: Task, boardState: BoardState) => {
      await saveTask({
        ...task,
        boardState,
        progress: boardState === "done" ? 100 : task.progress === 100 ? 80 : task.progress,
        completedAt: boardState === "done" ? nowIso() : null,
      });
    },
    [saveTask],
  );

  const deleteTask = useCallback(
    async (task: Task) => {
      const updated = { ...task, deletedAt: nowIso(), updatedAt: nowIso() };
      await db.tasks.put(updated);
      await enqueueTask(updated, "delete");
      await refresh();
    },
    [refresh],
  );

  const archiveTask = useCallback(
    async (task: Task, archived: boolean) => {
      await saveTask({ ...task, archivedAt: archived ? nowIso() : null });
    },
    [saveTask],
  );

  const cloneTask = useCallback(
    async (task: Task) => {
      const newId = uid("task");
      await saveTask({
        ...task,
        id: newId,
        title: `${task.title} (copy)`,
        progress: 0,
        boardState: "todo",
        completedAt: null,
        archivedAt: null,
        subtasks: task.subtasks.map((subtask, index) => ({
          ...subtask,
          id: uid("subtask"),
          taskId: newId,
          progress: 0,
          position: index,
          completedAt: null,
          updatedAt: nowIso(),
        })),
      });
    },
    [saveTask],
  );

  const updateSubtask = useCallback(
    async (task: Task, subtaskId: string, progress: number) => {
      await saveTask({
        ...task,
        subtasks: task.subtasks.map((subtask) =>
          subtask.id === subtaskId
            ? {
                ...subtask,
                progress,
                completedAt: progress >= 100 ? nowIso() : null,
                updatedAt: nowIso(),
              }
            : subtask,
        ),
      });
    },
    [saveTask],
  );

  const saveSettings = useCallback(
    async (patch: Partial<UserSettings>) => {
      const updated = { ...settings, ...patch, updatedAt: nowIso() };
      await db.settings.put(updated);
      await enqueueSettings(updated);
      setSettings(updated);
      return updated;
    },
    [settings],
  );

  const runSync = useCallback(async () => {
    if (!navigator.onLine) {
      setSyncState("offline");
      setSyncMessage("Offline - changes are saved locally");
      return;
    }
    const client = createClient();
    if (!client) {
      setSyncState("idle");
      setSyncMessage("Local mode - add Supabase env to sync");
      return;
    }
    const { data } = await client.auth.getSession();
    if (!data.session?.user.id) {
      setSyncState("idle");
      setSyncMessage("Sign in to sync");
      return;
    }
    setSyncState("syncing");
    setSyncMessage("Syncing...");
    try {
      const result = await syncWithSupabase(client, data.session.user.id);
      await refresh();
      setSyncState("synced");
      setSyncMessage(`Synced ${result.pushed} up / ${result.pulled} down`);
    } catch (error) {
      setSyncState("error");
      setSyncMessage(error instanceof Error ? error.message : "Sync failed");
    }
  }, [refresh]);

  const exportJson = useCallback(() => {
    downloadText(
      `Lucky_List_Backup_${new Date().toISOString().slice(0, 10)}.json`,
      JSON.stringify({ identifier: "LUCKY_LIST_DATA", generated_at: nowIso(), tasks, settings }, null, 2),
      "application/json;charset=utf-8",
    );
  }, [settings, tasks]);

  const exportCsv = useCallback(() => {
    const headers = ["ID", "Title", "Category", "Priority", "Progress", "Status", "Start", "Due", "Completed", "Notes"];
    downloadText(
      `Lucky_List_Report_${new Date().toISOString().slice(0, 10)}.csv`,
      `\uFEFF${[headers.join(","), ...tasks.map(taskToCsvRow)].join("\n")}`,
      "text/csv;charset=utf-8",
    );
  }, [tasks]);

  const importJson = useCallback(
    async (file: File) => {
      const text = await file.text();
      const data = JSON.parse(text) as ImportPayload;
      const importedTasks = data.tasks ?? data.payload?.tasks;
      if (Array.isArray(importedTasks)) {
        const normalized = importedTasks.map((raw) => {
          const item = raw as Partial<Task> & Record<string, unknown>;
          const id = String(item.id ?? uid("task"));
          const subtasks = Array.isArray(item.subtasks)
            ? (item.subtasks as (Partial<Subtask> & { text?: string })[]).map((subtask, index) => ({
                id: String(subtask.id ?? uid("subtask")),
                taskId: id,
                title: String(subtask.title ?? subtask.text ?? "Subtask"),
                progress: Number(subtask.progress ?? 0),
                position: Number(subtask.position ?? index),
                completedAt: subtask.completedAt ?? null,
                deletedAt: subtask.deletedAt ?? null,
                updatedAt: String(subtask.updatedAt ?? nowIso()),
              }))
            : [];
          return {
            id,
            title: String(item.title ?? item.name ?? "Untitled task"),
            notes: String(item.notes ?? ""),
            category: String(item.category ?? ""),
            priority: (item.priority as TaskPriority) ?? "Normal",
            progress: Number(item.progress ?? item.status ?? 0),
            boardState: ((item.boardState as BoardState) ?? (Number(item.progress ?? item.status ?? 0) >= 100 ? "done" : "todo")),
            startDate: (item.startDate as string) ?? null,
            dueAt: (item.dueAt as string) ?? (item.deadline as string) ?? null,
            reminderAt: (item.reminderAt as string) ?? null,
            repeatRule: item.repeatRule ?? { frequency: "none" },
            archivedAt: (item.archivedAt as string) ?? null,
            deletedAt: (item.deletedAt as string) ?? null,
            completedAt: (item.completedAt as string) ?? (item.completeDate as string) ?? null,
            createdAt: (item.createdAt as string) ?? (item.addDate as string) ?? nowIso(),
            updatedAt: nowIso(),
            subtasks,
          } satisfies Task;
        });
        await db.tasks.bulkPut(normalized);
        for (const task of normalized) await enqueueTask(task);
      }
      if (data.payload?.systemCategories || data.settings) {
        await saveSettings({
          categories: data.payload?.systemCategories ?? data.settings?.categories ?? settings.categories,
          deadlineThresholdDays: data.payload?.deadlineDaysThreshold ?? data.settings?.deadlineThresholdDays ?? settings.deadlineThresholdDays,
        });
      }
      await refresh();
    },
    [refresh, saveSettings, settings],
  );

  const visibleTasks = useMemo(() => tasks.filter((task) => !task.deletedAt), [tasks]);

  return {
    tasks: visibleTasks,
    settings,
    loading,
    syncState,
    syncMessage,
    isAuthed,
    saveTask,
    moveTask,
    deleteTask,
    archiveTask,
    cloneTask,
    updateSubtask,
    saveSettings,
    runSync,
    exportJson,
    exportCsv,
    importJson,
    refresh,
  };
}
