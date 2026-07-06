"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { db } from "./local-db";
import { enqueueSettings, enqueueTask, syncWithSupabase } from "./sync";
import { parseImportFileText, type NormalizedImport } from "../importers";
import { parseQuickAdd } from "../quick-add";
import { createNextRecurringTask } from "../recurrence";
import { createClient, hasSupabaseEnv } from "../supabase/client";
import { createSeedTasks, defaultSettings } from "../sample-data";
import type { BoardState, SyncState, Task, UserSettings } from "../types";
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
  const [syncMessage, setSyncMessage] = useState("PIN local mode");
  const [isAuthed, setIsAuthed] = useState(false);
  const [syncConnected, setSyncConnected] = useState(false);
  const [lastBackupAt, setLastBackupAt] = useState<string | null>(null);

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
      const backupMeta = await db.meta.get("last_backup_at");
      if (backupMeta?.value && !cancelled) setLastBackupAt(backupMeta.value);

      const client = createClient();
      const privateSession = localStorage.getItem("lucky_private_session") === "true";
      if (client) {
        const { data } = await client.auth.getSession();
        if (!cancelled) {
          setSyncConnected(Boolean(data.session));
          setIsAuthed(Boolean(data.session) || privateSession);
          setSyncMessage(data.session ? "Supabase sync ready" : "PIN local mode");
        }
      } else {
        if (!cancelled) {
          setSyncConnected(false);
          setIsAuthed(privateSession || !hasSupabaseEnv());
          setSyncMessage("PIN local mode");
        }
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
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const applyTheme = () => {
      document.documentElement.classList.toggle("dark", settings.theme === "dark" || (settings.theme === "system" && media.matches));
    };
    applyTheme();
    media.addEventListener("change", applyTheme);
    return () => media.removeEventListener("change", applyTheme);
  }, [settings.theme]);

  const saveTask = useCallback(
    async (input: Partial<Task> & Pick<Task, "title">) => {
      const stamp = nowIso();
      const existing = input.id ? await db.tasks.get(input.id) : null;
      const wasDone = Boolean(existing && (existing.boardState === "done" || existing.progress >= 100));
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
      const nextTask = !wasDone ? createNextRecurringTask(task) : null;
      if (nextTask) {
        await db.tasks.put(nextTask);
        await enqueueTask(nextTask);
      }
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

  const quickAdd = useCallback(
    async (text: string) => {
      const parsed = parseQuickAdd(text);
      if (!parsed) return null;
      const task = await saveTask(parsed.task);
      const category = parsed.task.category?.trim();
      if (category && !settings.categories.some((item) => item.toLowerCase() === category.toLowerCase())) {
        await saveSettings({ categories: [...settings.categories, category] });
      }
      return task;
    },
    [saveSettings, saveTask, settings.categories],
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
      setSyncMessage("PIN local mode - backup JSON for portability");
      return;
    }
    const { data } = await client.auth.getSession();
    if (!data.session?.user.id) {
      setSyncState("idle");
      setSyncConnected(false);
      setSyncMessage("PIN local mode - Supabase sync optional");
      return;
    }
    setSyncConnected(true);
    setSyncState("syncing");
    setSyncMessage("Syncing...");
    try {
      const result = await syncWithSupabase(client, data.session.user.id);
      await refresh();
      setSyncState("synced");
      setSyncConnected(true);
      setSyncMessage(`Synced ${result.pushed} up / ${result.pulled} down`);
    } catch (error) {
      setSyncState("error");
      setSyncMessage(error instanceof Error ? error.message : "Sync failed");
    }
  }, [refresh]);

  const createBackupPayload = useCallback(
    () => ({
      identifier: "LUCKY_LIST_DATA",
      generated_at: nowIso(),
      tasks,
      settings,
      payload: {
        tasks,
        systemCategories: settings.categories,
        deadlineDaysThreshold: settings.deadlineThresholdDays,
        isDarkTheme: settings.theme === "dark",
      },
    }),
    [settings, tasks],
  );

  const backupNow = useCallback(
    async (download = false) => {
      const stamp = nowIso();
      const content = JSON.stringify(createBackupPayload(), null, 2);
      await Promise.all([
        db.meta.put({ key: "latest_backup_json", value: content }),
        db.meta.put({ key: "last_backup_at", value: stamp }),
      ]);
      setLastBackupAt(stamp);
      if (download) {
        downloadText(
          `Lucky_List_Backup_${new Date().toISOString().slice(0, 10)}.json`,
          content,
          "application/json;charset=utf-8",
        );
      }
      return stamp;
    },
    [createBackupPayload],
  );

  useEffect(() => {
    if (loading || settings.autoBackupMinutes <= 0) return;
    const interval = window.setInterval(() => {
      void backupNow(false);
    }, Math.max(1, settings.autoBackupMinutes) * 60 * 1000);
    return () => window.clearInterval(interval);
  }, [backupNow, loading, settings.autoBackupMinutes]);

  const exportJson = useCallback(() => {
    void backupNow(true);
  }, [backupNow]);

  const exportLatestLocalBackup = useCallback(async () => {
    const latest = await db.meta.get("latest_backup_json");
    if (!latest?.value) {
      await backupNow(true);
      return;
    }
    downloadText(
      `Lucky_List_Backup_${new Date().toISOString().slice(0, 10)}.json`,
      latest.value,
      "application/json;charset=utf-8",
    );
  }, [backupNow]);

  const exportCsv = useCallback(() => {
    const headers = ["ID", "Title", "Category", "Priority", "Progress", "Status", "Start", "Due", "Reminder", "Repeat", "Completed", "Notes"];
    downloadText(
      `Lucky_List_Report_${new Date().toISOString().slice(0, 10)}.csv`,
      `\uFEFF${[headers.join(","), ...tasks.map(taskToCsvRow)].join("\n")}`,
      "text/csv;charset=utf-8",
    );
  }, [tasks]);

  const importNormalized = useCallback(
    async (normalized: NormalizedImport) => {
      if (normalized.tasks.length) {
        await db.tasks.bulkPut(normalized.tasks);
        for (const task of normalized.tasks) await enqueueTask(task);
      }
      if (Object.keys(normalized.settings).length) {
        await saveSettings({
          categories: normalized.settings.categories ?? settings.categories,
          deadlineThresholdDays: normalized.settings.deadlineThresholdDays ?? settings.deadlineThresholdDays,
          theme: normalized.settings.theme ?? settings.theme,
          notificationsEnabled: normalized.settings.notificationsEnabled ?? settings.notificationsEnabled,
          autoBackupMinutes: normalized.settings.autoBackupMinutes ?? settings.autoBackupMinutes,
        });
      }
      await refresh();
      return normalized;
    },
    [refresh, saveSettings, settings],
  );

  const importFile = useCallback(
    async (file: File) => {
      const text = await file.text();
      return importNormalized(parseImportFileText(text, file.name));
    },
    [importNormalized],
  );

  const visibleTasks = useMemo(() => tasks.filter((task) => !task.deletedAt), [tasks]);

  return {
    tasks: visibleTasks,
    settings,
    loading,
    syncState,
    syncMessage,
    syncConnected,
    isAuthed,
    saveTask,
    moveTask,
    quickAdd,
    deleteTask,
    archiveTask,
    cloneTask,
    updateSubtask,
    saveSettings,
    runSync,
    exportJson,
    backupNow,
    exportLatestLocalBackup,
    exportCsv,
    importFile,
    lastBackupAt,
    refresh,
  };
}
