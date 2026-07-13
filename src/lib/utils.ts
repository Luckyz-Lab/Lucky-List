import { clsx, type ClassValue } from "clsx";
import { format, isAfter, isBefore, isSameDay, parseISO, startOfDay } from "date-fns";
import { th } from "date-fns/locale";
import { twMerge } from "tailwind-merge";
import type { BoardState, RepeatRule, Task, TaskPriority } from "./types";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function uid(prefix = "id") {
  void prefix;
  return crypto.randomUUID();
}

export function nowIso() {
  return new Date().toISOString();
}

export function formatThaiDate(value?: string | null) {
  if (!value) return "-";
  try {
    return format(parseISO(value), "d MMM yyyy", { locale: th });
  } catch {
    return value;
  }
}

export function daysUntil(value?: string | null) {
  if (!value) return null;
  const today = startOfDay(new Date());
  const target = startOfDay(parseISO(value));
  return Math.round((target.getTime() - today.getTime()) / 86400000);
}

export function isActiveTask(task: Task) {
  return !task.deletedAt && !task.archivedAt && task.boardState !== "done";
}

export function isDoneTask(task: Task) {
  return !task.deletedAt && (task.boardState === "done" || task.progress >= 100);
}

export function priorityWeight(priority: TaskPriority) {
  return { Low: 1, Normal: 2, High: 3, Urgent: 4 }[priority];
}

export function boardLabel(state: BoardState) {
  return { todo: "รอทำ", wip: "กำลังทำ", done: "เสร็จแล้ว" }[state];
}

export function priorityLabel(priority: TaskPriority) {
  return { Low: "ต่ำ", Normal: "ปกติ", High: "สูง", Urgent: "ด่วนมาก" }[priority];
}

export function categoryLabel(category?: string | null) {
  if (!category) return "ทั่วไป";
  const labels: Record<string, string> = {
    Inbox: "กล่องรับงาน",
    Someday: "พักไว้ก่อน",
    Project: "โปรเจกต์",
    IT: "ไอที",
    Marketing: "การตลาด",
    Personal: "ส่วนตัว",
    Operations: "งานระบบ",
    Finance: "การเงิน",
    Design: "ออกแบบ",
    Other: "อื่นๆ",
    Review: "รีวิว",
    Focus: "โฟกัส",
    Work: "งาน",
  };
  return labels[category] ?? category;
}

export function repeatLabel(rule: RepeatRule) {
  if (rule.frequency === "none") return "ไม่ทำซ้ำ";
  if (rule.frequency === "daily") return "ทุกวัน";
  if (rule.frequency === "monthly") return "ทุกเดือน";
  if (rule.weekdays?.length) return `ทุกสัปดาห์ (${rule.weekdays.join(",")})`;
  return "ทุกสัปดาห์";
}

export function relativeDueLabel(days: number | null, noDateLabel = "ยังไม่กำหนดวัน") {
  if (days === null) return noDateLabel;
  if (days < 0) return `เลยกำหนด ${Math.abs(days)} วัน`;
  if (days === 0) return "วันนี้";
  if (days === 1) return "พรุ่งนี้";
  return `เหลือ ${days} วัน`;
}

export function notificationPermissionLabel(permission: string) {
  if (permission === "granted") return "เปิดใช้งาน";
  if (permission === "denied") return "ถูกปิดในเบราว์เซอร์";
  if (permission === "unsupported") return "เบราว์เซอร์ไม่รองรับ";
  return "ยังไม่ได้ขอสิทธิ์";
}

export function taskSort(a: Task, b: Task) {
  const aDue = a.dueAt ? parseISO(a.dueAt).getTime() : Number.MAX_SAFE_INTEGER;
  const bDue = b.dueAt ? parseISO(b.dueAt).getTime() : Number.MAX_SAFE_INTEGER;
  if (aDue !== bDue) return aDue - bDue;
  return priorityWeight(b.priority) - priorityWeight(a.priority);
}

export function isOverdue(task: Task) {
  if (!task.dueAt || isDoneTask(task)) return false;
  return isBefore(parseISO(task.dueAt), startOfDay(new Date()));
}

export function isDueSoon(task: Task, threshold: number) {
  const days = daysUntil(task.dueAt);
  return days !== null && days <= threshold && !isDoneTask(task);
}

export function isTodayTask(task: Task) {
  if (isDoneTask(task)) return false;
  const today = new Date();
  return Boolean(
    (task.dueAt && isSameDay(parseISO(task.dueAt), today)) ||
      (task.startDate && isSameDay(parseISO(task.startDate), today)) ||
      (task.reminderAt && isSameDay(parseISO(task.reminderAt), today)),
  );
}

export function completedToday(task: Task) {
  if (!task.completedAt) return false;
  return isAfter(parseISO(task.completedAt), startOfDay(new Date()));
}

export function downloadText(filename: string, content: string, type: string) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

export function taskToCsvRow(task: Task) {
  const cells = [
    task.id,
    task.title,
    task.category ?? "",
    task.priority,
    task.estimateMinutes ?? 30,
    `${task.progress}%`,
    boardLabel(task.boardState),
    task.startDate ?? "",
    task.dueAt ?? "",
    task.reminderAt ?? "",
    repeatLabel(task.repeatRule),
    task.completedAt ?? "",
    task.notes ?? "",
  ];
  return cells.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(",");
}
