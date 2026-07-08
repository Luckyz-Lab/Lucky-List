"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { Task } from "../types";
import { categoryLabel, formatThaiDate, isDoneTask, priorityLabel, taskSort } from "../utils";

type NotificationSupport = NotificationPermission | "unsupported";

export type ReminderHistoryItem = {
  id: string;
  taskId?: string;
  title: string;
  body: string;
  kind: "reminder" | "digest";
  createdAt: string;
};

type ReminderOptions = {
  dailyDigestEnabled: boolean;
  dailyDigestTime: string;
};

const notifiedStorageKey = "lucky_list_notified_reminders_v2";
const snoozeStorageKey = "lucky_list_snoozed_reminders";
const historyStorageKey = "lucky_list_notification_history";
const digestStorageKey = "lucky_list_daily_digest_dates";

function readJson<T>(key: string, fallback: T): T {
  try {
    return JSON.parse(localStorage.getItem(key) ?? "") as T;
  } catch {
    return fallback;
  }
}

function writeJson<T>(key: string, value: T) {
  localStorage.setItem(key, JSON.stringify(value));
}

function readNotifiedIds() {
  return new Set(readJson<string[]>(notifiedStorageKey, []));
}

function writeNotifiedIds(ids: Set<string>) {
  writeJson(notifiedStorageKey, Array.from(ids).slice(-800));
}

function readSnoozes() {
  return readJson<Record<string, string>>(snoozeStorageKey, {});
}

function writeSnoozes(snoozes: Record<string, string>) {
  writeJson(snoozeStorageKey, snoozes);
}

function readHistory() {
  return readJson<ReminderHistoryItem[]>(historyStorageKey, []);
}

function writeHistory(items: ReminderHistoryItem[]) {
  writeJson(historyStorageKey, items.slice(0, 80));
}

function notificationBody(task: Task) {
  const bits = [categoryLabel(task.category), task.dueAt ? `กำหนดส่ง ${formatThaiDate(task.dueAt)}` : "", priorityLabel(task.priority)].filter(Boolean);
  return bits.join(" - ") || "แจ้งเตือนงาน";
}

function showBrowserNotification(title: string, body: string, tag: string, taskId?: string) {
  const notification = new Notification(title, {
    body,
    tag,
    icon: "/icon.svg",
    data: { taskId },
    requireInteraction: true,
    actions: [
      { action: "done", title: "เสร็จแล้ว" },
      { action: "snooze", title: "เลื่อน 10 นาที" },
    ],
  } as NotificationOptions);

  notification.onclick = () => {
    window.focus();
    if (taskId) {
      window.dispatchEvent(new CustomEvent("lucky-list-open-task", { detail: { taskId } }));
    }
    notification.close();
  };
}

function reminderKey(task: Task, effectiveAt: string) {
  return `${task.id}:${effectiveAt}`;
}

function digestDateKey(date = new Date()) {
  return date.toISOString().slice(0, 10);
}

function nextDigestDelay(time: string) {
  const [hoursRaw, minutesRaw] = time.split(":").map(Number);
  const target = new Date();
  target.setHours(Number.isFinite(hoursRaw) ? hoursRaw : 9, Number.isFinite(minutesRaw) ? minutesRaw : 0, 0, 0);
  const now = Date.now();
  if (target.getTime() <= now) return 0;
  return target.getTime() - now;
}

function dueDigestTasks(tasks: Task[]) {
  const active = tasks.filter((task) => !task.deletedAt && !task.archivedAt && !isDoneTask(task));
  const today = new Date().toISOString().slice(0, 10);
  const overdue = active.filter((task) => task.dueAt && task.dueAt.slice(0, 10) < today).sort(taskSort);
  const todayTasks = active.filter((task) => task.dueAt?.slice(0, 10) === today || task.startDate === today || task.reminderAt?.slice(0, 10) === today).sort(taskSort);
  const topPriority = active.filter((task) => task.priority === "Urgent" || task.priority === "High").sort(taskSort).slice(0, 3);
  return { overdue, todayTasks, topPriority };
}

export function useReminderNotifications(tasks: Task[], enabled: boolean, options: ReminderOptions) {
  const [permission, setPermission] = useState<NotificationSupport>(() =>
    typeof window !== "undefined" && "Notification" in window ? Notification.permission : "unsupported",
  );
  const [lastNotificationAt, setLastNotificationAt] = useState<string | null>(null);
  const [history, setHistory] = useState<ReminderHistoryItem[]>(() => (typeof window === "undefined" ? [] : readHistory()));
  const [snoozes, setSnoozes] = useState<Record<string, string>>(() => (typeof window === "undefined" ? {} : readSnoozes()));

  const requestPermission = useCallback(async () => {
    if (!("Notification" in window)) {
      setPermission("unsupported");
      return "unsupported" as const;
    }
    const result = await Notification.requestPermission();
    setPermission(result);
    return result;
  }, []);

  const addHistory = useCallback((item: Omit<ReminderHistoryItem, "id" | "createdAt">) => {
    const nextItem: ReminderHistoryItem = {
      ...item,
      id: crypto.randomUUID(),
      createdAt: new Date().toISOString(),
    };
    setHistory((items) => {
      const next = [nextItem, ...items].slice(0, 80);
      writeHistory(next);
      return next;
    });
    setLastNotificationAt(nextItem.createdAt);
    return nextItem;
  }, []);

  const snoozeTask = useCallback((taskId: string, minutes: number) => {
    const until = new Date(Date.now() + minutes * 60 * 1000).toISOString();
    setSnoozes((items) => {
      const next = { ...items, [taskId]: until };
      writeSnoozes(next);
      return next;
    });
  }, []);

  const clearHistory = useCallback(() => {
    setHistory([]);
    writeHistory([]);
  }, []);

  const pendingReminders = useMemo(
    () =>
      tasks.filter((task) => {
        if ((!task.reminderAt && !snoozes[task.id]) || task.deletedAt || task.archivedAt || isDoneTask(task)) return false;
        return true;
      }),
    [snoozes, tasks],
  );

  useEffect(() => {
    if (!enabled || permission !== "granted") return;
    const notified = readNotifiedIds();
    const timers: number[] = [];

    tasks.forEach((task) => {
      const effectiveAt = snoozes[task.id] ?? task.reminderAt;
      if (!effectiveAt || task.deletedAt || task.archivedAt || isDoneTask(task)) return;
      const key = reminderKey(task, effectiveAt);
      if (notified.has(key)) return;
      const delay = new Date(effectiveAt).getTime() - Date.now();
      if (delay < -24 * 60 * 60 * 1000) return;

      const notify = () => {
        if (notified.has(key)) return;
        notified.add(key);
        writeNotifiedIds(notified);
        const body = notificationBody(task);
        addHistory({ taskId: task.id, title: task.title, body, kind: "reminder" });
        showBrowserNotification(task.title, body, key, task.id);
      };

      if (delay <= 0) {
        notify();
        return;
      }
      timers.push(window.setTimeout(notify, Math.min(delay, 2_147_000_000)));
    });

    return () => {
      timers.forEach((timer) => window.clearTimeout(timer));
    };
  }, [addHistory, enabled, permission, snoozes, tasks]);

  useEffect(() => {
    if (!enabled || !options.dailyDigestEnabled || permission !== "granted") return;
    const timers: number[] = [];

    const notifyDigest = () => {
      const today = digestDateKey();
      const sentDates = new Set(readJson<string[]>(digestStorageKey, []));
      if (sentDates.has(today)) return;

      const { overdue, todayTasks, topPriority } = dueDigestTasks(tasks);
      const total = overdue.length + todayTasks.length + topPriority.length;
      if (!total) return;

      sentDates.add(today);
      writeJson(digestStorageKey, Array.from(sentDates).slice(-60));
      const body = `วันนี้ ${todayTasks.length} งาน / เลยกำหนด ${overdue.length} งาน / สำคัญ ${topPriority.length} งาน`;
      addHistory({ title: "สรุปงานประจำวัน", body, kind: "digest" });
      showBrowserNotification("สรุปงานประจำวัน", body, `digest:${today}`);
    };

    const delay = nextDigestDelay(options.dailyDigestTime);
    timers.push(window.setTimeout(notifyDigest, Math.min(delay, 2_147_000_000)));

    return () => {
      timers.forEach((timer) => window.clearTimeout(timer));
    };
  }, [addHistory, enabled, options.dailyDigestEnabled, options.dailyDigestTime, permission, tasks]);

  return {
    permission,
    pendingReminders,
    history,
    lastNotificationAt,
    requestPermission,
    snoozeTask,
    clearHistory,
  };
}
