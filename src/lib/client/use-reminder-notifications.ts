"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { Task } from "../types";
import { categoryLabel, formatThaiDate, isDoneTask, priorityLabel } from "../utils";

type NotificationSupport = NotificationPermission | "unsupported";

const notifiedStorageKey = "lucky_list_notified_reminders";

function readNotifiedIds() {
  try {
    return new Set<string>(JSON.parse(localStorage.getItem(notifiedStorageKey) ?? "[]") as string[]);
  } catch {
    return new Set<string>();
  }
}

function writeNotifiedIds(ids: Set<string>) {
  localStorage.setItem(notifiedStorageKey, JSON.stringify(Array.from(ids).slice(-500)));
}

function notificationBody(task: Task) {
  const bits = [categoryLabel(task.category), task.dueAt ? `กำหนดส่ง ${formatThaiDate(task.dueAt)}` : "", priorityLabel(task.priority)].filter(Boolean);
  return bits.join(" - ") || "แจ้งเตือนงาน";
}

function showReminderNotification(task: Task) {
  const payload = {
    type: "LUCKY_LIST_SHOW_REMINDER",
    title: task.title,
    body: notificationBody(task),
    tag: task.id,
  };
  if (navigator.serviceWorker?.controller) {
    navigator.serviceWorker.controller.postMessage(payload);
    return;
  }
  new Notification(task.title, {
    body: payload.body,
    tag: task.id,
    icon: "/icon.svg",
  });
}

export function useReminderNotifications(tasks: Task[], enabled: boolean) {
  const [permission, setPermission] = useState<NotificationSupport>(() =>
    typeof window !== "undefined" && "Notification" in window ? Notification.permission : "unsupported",
  );
  const [lastNotificationAt, setLastNotificationAt] = useState<string | null>(null);

  const requestPermission = useCallback(async () => {
    if (!("Notification" in window)) {
      setPermission("unsupported");
      return "unsupported" as const;
    }
    const result = await Notification.requestPermission();
    setPermission(result);
    return result;
  }, []);

  const pendingReminders = useMemo(
    () =>
      tasks.filter((task) => {
        if (!task.reminderAt || task.deletedAt || task.archivedAt || isDoneTask(task)) return false;
        return true;
      }),
    [tasks],
  );

  useEffect(() => {
    if (!enabled || permission !== "granted") return;
    const notified = readNotifiedIds();
    const timers: number[] = [];

    tasks.forEach((task) => {
      if (!task.reminderAt || task.deletedAt || task.archivedAt || isDoneTask(task) || notified.has(task.id)) return;
      const delay = new Date(task.reminderAt).getTime() - Date.now();
      if (delay < -24 * 60 * 60 * 1000) return;

      const notify = () => {
        if (notified.has(task.id)) return;
        notified.add(task.id);
        writeNotifiedIds(notified);
        setLastNotificationAt(new Date().toISOString());
        showReminderNotification(task);
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
  }, [enabled, permission, tasks]);

  return {
    permission,
    pendingReminders,
    lastNotificationAt,
    requestPermission,
  };
}
