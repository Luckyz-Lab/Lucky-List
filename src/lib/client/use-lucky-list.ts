"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect, useMemo, useState } from "react";
import { ensureCloudSession, type CloudSessionState } from "@/lib/auth/cloud";
import { hasPrivateSession, lockPrivateSession } from "@/lib/auth/pin";
import { parseImportFileText, type NormalizedImport } from "@/lib/importers";
import { parseQuickAdd } from "@/lib/quick-add";
import { createNextRecurringTask } from "@/lib/recurrence";
import { createDemoTasks, createSeedTasks, defaultSettings } from "@/lib/sample-data";
import {
  getLegacyLastBackupAt,
  markLegacyBackup,
  migrateLegacyWorkspaceToCloud,
  readLegacyWorkspace,
  writeLocalPreviewSettings,
  writeLocalPreviewTask,
} from "@/lib/tasks/legacy-migration";
import { createTaskRepository, type TaskRepository } from "@/lib/tasks/repository";
import type { BoardState, CloudState, Task, TaskDraft, UserSettings } from "@/lib/types";
import { downloadText, nowIso, taskToCsvRow, uid } from "@/lib/utils";

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

function cloudQueryKeys(userId: string | null) {
  return {
    tasks: ["lucky-list", "tasks", userId] as const,
    settings: ["lucky-list", "settings", userId] as const,
  };
}

export function useLuckyList() {
  const queryClient = useQueryClient();
  const [booting, setBooting] = useState(true);
  const [isAuthed, setIsAuthed] = useState(false);
  const [cloudState, setCloudState] = useState<CloudState>("checking");
  const [cloudMessage, setCloudMessage] = useState("กำลังตรวจสถานะข้อมูลออนไลน์...");
  const [cloudSession, setCloudSession] = useState<CloudSessionState | null>(null);
  const [repository, setRepository] = useState<TaskRepository | null>(null);
  const [localPreviewTasks, setLocalPreviewTasks] = useState<Task[]>([]);
  const [localPreviewSettings, setLocalPreviewSettings] = useState<UserSettings>(defaultSettings);
  const [lastBackupAt, setLastBackupAt] = useState<string | null>(null);

  const userId = cloudSession?.mode === "cloud" ? cloudSession.userId : null;
  const queryKeys = cloudQueryKeys(userId);

  const refreshLocalPreview = useCallback(async () => {
    const legacy = await readLegacyWorkspace();
    setLocalPreviewTasks(legacy.tasks.filter((task) => !task.deletedAt).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)));
    setLocalPreviewSettings(legacy.settings);
    setLastBackupAt(await getLegacyLastBackupAt());
  }, []);

  const refreshCloud = useCallback(async () => {
    if (!repository) {
      await refreshLocalPreview();
      return;
    }
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: queryKeys.tasks }),
      queryClient.invalidateQueries({ queryKey: queryKeys.settings }),
    ]);
    setLastBackupAt(await getLegacyLastBackupAt());
  }, [queryClient, queryKeys.settings, queryKeys.tasks, refreshLocalPreview, repository]);

  useEffect(() => {
    let cancelled = false;

    async function boot() {
      if (!hasPrivateSession()) {
        if (!cancelled) {
          setIsAuthed(false);
          setCloudState("checking");
          setCloudMessage("ใส่ PIN เพื่อปลดล็อก Lucky List");
          setBooting(false);
        }
        return;
      }

      if (!cancelled) {
        setIsAuthed(true);
        setCloudState("checking");
        setCloudMessage("กำลังตรวจสถานะข้อมูลออนไลน์...");
      }

      const session = await ensureCloudSession();
      if (cancelled) return;

      setCloudSession(session);
      setCloudMessage(session.message);

      if (session.mode === "cloud") {
        const nextRepository = createTaskRepository(session.client, session.userId);
        setRepository(nextRepository);
        try {
          const migrated = await migrateLegacyWorkspaceToCloud(nextRepository, session.userId);
          if (!cancelled) {
            setCloudState("ready");
            setCloudMessage(migrated.migrated ? `พร้อมใช้งานออนไลน์ - ย้ายงานเดิม ${migrated.count} งานแล้ว` : session.message);
            setLastBackupAt(await getLegacyLastBackupAt());
            await Promise.all([
              queryClient.invalidateQueries({ queryKey: cloudQueryKeys(session.userId).tasks }),
              queryClient.invalidateQueries({ queryKey: cloudQueryKeys(session.userId).settings }),
            ]);
          }
        } catch (error) {
          if (!cancelled) {
            setCloudState("error");
            setCloudMessage(error instanceof Error ? error.message : "ย้ายข้อมูลขึ้นออนไลน์ไม่สำเร็จ");
          }
        }
      } else if (session.mode === "local-preview") {
        setRepository(null);
        await refreshLocalPreview();
        if (!cancelled) {
          setCloudState("local-preview");
          setCloudMessage(session.message);
        }
      } else {
        setRepository(null);
        lockPrivateSession();
        if (!cancelled) {
          setIsAuthed(false);
          setCloudState("error");
          setCloudMessage(session.message);
        }
      }

      if (!cancelled) setBooting(false);
    }

    void boot();
    return () => {
      cancelled = true;
    };
  }, [queryClient, refreshLocalPreview]);

  const tasksQuery = useQuery({
    queryKey: queryKeys.tasks,
    queryFn: () => {
      if (!repository) throw new Error("พื้นที่เก็บข้อมูลออนไลน์ยังไม่พร้อม");
      return repository.listTasks();
    },
    enabled: Boolean(repository && userId),
  });

  const settingsQuery = useQuery({
    queryKey: queryKeys.settings,
    queryFn: () => {
      if (!repository) throw new Error("พื้นที่เก็บข้อมูลออนไลน์ยังไม่พร้อม");
      return repository.getSettings();
    },
    enabled: Boolean(repository && userId),
  });

  useEffect(() => {
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const theme = (settingsQuery.data ?? localPreviewSettings).theme;
    const applyTheme = () => {
      document.documentElement.classList.toggle("dark", theme === "dark" || (theme === "system" && media.matches));
    };
    applyTheme();
    media.addEventListener("change", applyTheme);
    return () => media.removeEventListener("change", applyTheme);
  }, [localPreviewSettings, settingsQuery.data]);

  const activeRepository = repository;
  const tasks = useMemo(
    () => (activeRepository ? tasksQuery.data ?? [] : localPreviewTasks),
    [activeRepository, localPreviewTasks, tasksQuery.data],
  );
  const settings = useMemo(
    () => (activeRepository ? settingsQuery.data ?? defaultSettings : localPreviewSettings),
    [activeRepository, localPreviewSettings, settingsQuery.data],
  );
  const loading = booting || (Boolean(activeRepository) && (tasksQuery.isLoading || settingsQuery.isLoading));
  const cloudConnected = Boolean(activeRepository && cloudState === "ready");

  const requireWritableCloud = useCallback(async () => {
    if (!activeRepository) return null;
    if (!navigator.onLine) {
      setCloudState("offline");
      setCloudMessage("ไม่มีอินเทอร์เน็ต - พักการบันทึกออนไลน์ไว้ก่อน");
      throw new Error("ต้องเชื่อมต่ออินเทอร์เน็ตก่อนบันทึกงาน");
    }
    setCloudState("saving");
    setCloudMessage("กำลังบันทึกข้อมูล...");
    return activeRepository;
  }, [activeRepository]);

  const afterCloudWrite = useCallback(async (message = "ข้อมูลล่าสุดแล้ว") => {
    await refreshCloud();
    setCloudState("ready");
    setCloudMessage(message);
  }, [refreshCloud]);

  const persistTask = useCallback(
    async (task: Task) => {
      const repo = await requireWritableCloud();
      if (repo) {
        await repo.saveTask(task);
        await afterCloudWrite("บันทึกข้อมูลแล้ว");
        return task;
      }

      if (cloudState === "local-preview") {
        await writeLocalPreviewTask(task);
        await refreshLocalPreview();
        return task;
      }

      setCloudState("error");
      setCloudMessage("ต้องเชื่อมต่อข้อมูลออนไลน์ก่อนบันทึกงาน");
      throw new Error("ต้องเชื่อมต่อข้อมูลออนไลน์ก่อนบันทึกงาน");
    },
    [afterCloudWrite, cloudState, refreshLocalPreview, requireWritableCloud],
  );

  const saveTask = useCallback(
    async (input: TaskDraft) => {
      const stamp = nowIso();
      const existing = input.id ? tasks.find((task) => task.id === input.id) : null;
      const wasDone = Boolean(existing && (existing.boardState === "done" || existing.progress >= 100));
      const task = normalizeProgress({
        id: input.id ?? uid("task"),
        userId: userId ?? existing?.userId ?? null,
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

      await persistTask(task);

      const nextTask = !wasDone ? createNextRecurringTask(task) : null;
      if (nextTask) await persistTask({ ...nextTask, userId: userId ?? null });
      return task;
    },
    [persistTask, tasks, userId],
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
      await persistTask({ ...task, deletedAt: nowIso(), updatedAt: nowIso() });
    },
    [persistTask],
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
        title: `${task.title} (สำเนา)`,
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
      const updated = {
        ...settings,
        ...patch,
        id: userId ? `settings_${userId}` : settings.id,
        userId: userId ?? settings.userId ?? null,
        updatedAt: nowIso(),
      };

      const repo = await requireWritableCloud();
      if (repo) {
        const saved = await repo.saveSettings(updated);
        await afterCloudWrite("บันทึกการตั้งค่าแล้ว");
        return saved;
      }

      if (cloudState === "local-preview") {
        await writeLocalPreviewSettings(updated);
        await refreshLocalPreview();
        return updated;
      }

      setCloudState("error");
      setCloudMessage("ต้องเชื่อมต่อข้อมูลออนไลน์ก่อนบันทึกการตั้งค่า");
      throw new Error("ต้องเชื่อมต่อข้อมูลออนไลน์ก่อนบันทึกการตั้งค่า");
    },
    [afterCloudWrite, cloudState, refreshLocalPreview, requireWritableCloud, settings, userId],
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

  const refresh = useCallback(async () => {
    await refreshCloud();
  }, [refreshCloud]);

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
      const content = JSON.stringify(createBackupPayload(), null, 2);
      const stamp = await markLegacyBackup(content);
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
    const content = JSON.stringify(createBackupPayload(), null, 2);
    await markLegacyBackup(content);
    downloadText(
      `Lucky_List_Backup_${new Date().toISOString().slice(0, 10)}.json`,
      content,
      "application/json;charset=utf-8",
    );
  }, [createBackupPayload]);

  const exportCsv = useCallback(() => {
    const headers = ["ID", "ชื่องาน", "หมวดหมู่", "ความสำคัญ", "ความคืบหน้า", "สถานะ", "เริ่ม", "กำหนดส่ง", "เตือน", "ทำซ้ำ", "เสร็จเมื่อ", "รายละเอียด"];
    downloadText(
      `Lucky_List_Report_${new Date().toISOString().slice(0, 10)}.csv`,
      `\uFEFF${[headers.join(","), ...tasks.map(taskToCsvRow)].join("\n")}`,
      "text/csv;charset=utf-8",
    );
  }, [tasks]);

  const importNormalized = useCallback(
    async (normalized: NormalizedImport) => {
      if (normalized.tasks.length) {
        if (activeRepository && userId) {
          setCloudState("saving");
          setCloudMessage("กำลังนำเข้างาน...");
          await activeRepository.importTasks(normalized.tasks.map((task) => ({ ...task, userId })));
          await afterCloudWrite(`นำเข้างาน ${normalized.tasks.length} งานแล้ว`);
        } else if (cloudState === "local-preview") {
          for (const task of normalized.tasks) await writeLocalPreviewTask(task);
          await refreshLocalPreview();
        } else {
          throw new Error("ต้องเชื่อมต่อข้อมูลออนไลน์ก่อนนำเข้างาน");
        }
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

      return normalized;
    },
    [activeRepository, afterCloudWrite, cloudState, refreshLocalPreview, saveSettings, settings, userId],
  );

  const importFile = useCallback(
    async (file: File) => {
      const text = await file.text();
      return importNormalized(parseImportFileText(text, file.name));
    },
    [importNormalized],
  );

  const addDemoTasks = useCallback(
    async (count = 50) => {
      const demoTasks = createDemoTasks(count).map((task) => ({ ...task, userId: userId ?? null }));
      if (activeRepository && userId) {
        setCloudState("saving");
        setCloudMessage(`กำลังเพิ่มงานตัวอย่าง ${count} งาน...`);
        await activeRepository.importTasks(demoTasks);
        await afterCloudWrite(`เพิ่มงานตัวอย่าง ${demoTasks.length} งานแล้ว`);
      } else if (cloudState === "local-preview") {
        for (const task of demoTasks) await writeLocalPreviewTask(task);
        await refreshLocalPreview();
      } else {
        throw new Error("ต้องเชื่อมต่อข้อมูลออนไลน์ก่อนเพิ่มงานตัวอย่าง");
      }
      return demoTasks;
    },
    [activeRepository, afterCloudWrite, cloudState, refreshLocalPreview, userId],
  );

  useEffect(() => {
    if (booting || activeRepository || localPreviewTasks.length) return;
    if (cloudState !== "local-preview") return;
    const seedTasks = createSeedTasks();
    void Promise.all(seedTasks.map(writeLocalPreviewTask)).then(refreshLocalPreview);
  }, [activeRepository, booting, cloudState, localPreviewTasks.length, refreshLocalPreview]);

  const visibleTasks = useMemo(() => tasks.filter((task) => !task.deletedAt), [tasks]);

  return {
    tasks: visibleTasks,
    settings,
    loading,
    cloudState,
    cloudMessage,
    cloudConnected,
    isAuthed,
    saveTask,
    moveTask,
    quickAdd,
    deleteTask,
    archiveTask,
    cloneTask,
    updateSubtask,
    saveSettings,
    refreshCloud,
    exportJson,
    backupNow,
    exportLatestLocalBackup,
    exportCsv,
    importFile,
    addDemoTasks,
    lastBackupAt,
    refresh,
  };
}
