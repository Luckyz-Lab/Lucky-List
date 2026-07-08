import { addDays, format, isValid, parse } from "date-fns";
import type { BoardState, RepeatFrequency, Task, TaskPriority } from "./types";

type QuickAddMeta = {
  category?: string;
  dateToken?: string;
  timeToken?: string;
  priorityToken?: string;
  repeatToken?: string;
  boardToken?: string;
};

export type QuickAddResult = {
  task: Partial<Task> & Pick<Task, "title">;
  meta: QuickAddMeta;
};

const priorityAliases: Record<string, TaskPriority> = {
  low: "Low",
  l: "Low",
  normal: "Normal",
  medium: "Normal",
  med: "Normal",
  n: "Normal",
  high: "High",
  h: "High",
  urgent: "Urgent",
  u: "Urgent",
  important: "Urgent",
  "ต่ำ": "Low",
  "ต่า": "Low",
  "ปกติ": "Normal",
  "กลาง": "Normal",
  "สูง": "High",
  "ด่วน": "Urgent",
  "ด่วนมาก": "Urgent",
};

const repeatAliases: Record<string, RepeatFrequency> = {
  daily: "daily",
  every_day: "daily",
  weekly: "weekly",
  every_week: "weekly",
  monthly: "monthly",
  every_month: "monthly",
  none: "none",
  "ทุกวัน": "daily",
  "รายวัน": "daily",
  "ทุกสัปดาห์": "weekly",
  "รายสัปดาห์": "weekly",
  "ทุกเดือน": "monthly",
  "รายเดือน": "monthly",
};

const boardAliases: Record<string, BoardState> = {
  todo: "todo",
  to_do: "todo",
  wip: "wip",
  doing: "wip",
  progress: "wip",
  done: "done",
  complete: "done",
  "ทำอยู่": "wip",
  "เสร็จ": "done",
};

const weekdayAliases: Record<string, number> = {
  sunday: 0,
  sun: 0,
  monday: 1,
  mon: 1,
  tuesday: 2,
  tue: 2,
  wednesday: 3,
  wed: 3,
  thursday: 4,
  thu: 4,
  friday: 5,
  fri: 5,
  saturday: 6,
  sat: 6,
};

function todayAtStart() {
  const date = new Date();
  date.setHours(0, 0, 0, 0);
  return date;
}

function dateFromToken(token: string): Date | null {
  const normalized = token.toLowerCase();
  const today = todayAtStart();

  if (["today", "วันนี้", "tod"].includes(normalized)) return today;
  if (["tomorrow", "tmr", "พรุ่งนี้"].includes(normalized)) return addDays(today, 1);
  if (["dayafter", "มะรืน"].includes(normalized)) return addDays(today, 2);

  const relative = normalized.match(/^\+?(\d+)(d|day|days|วัน)$/);
  if (relative) return addDays(today, Number(relative[1]));

  if (normalized === "nextweek" || normalized === "next_week") return addDays(today, 7);

  if (typeof weekdayAliases[normalized] === "number") {
    const target = weekdayAliases[normalized];
    const diff = (target - today.getDay() + 7) % 7 || 7;
    return addDays(today, diff);
  }

  const yyyyMmDd = parse(normalized, "yyyy-MM-dd", today);
  if (isValid(yyyyMmDd)) return yyyyMmDd;

  const dayMonthYear = parse(normalized, "d/M/yyyy", today);
  if (isValid(dayMonthYear)) return dayMonthYear;

  const dayMonthShortYear = parse(normalized, "d/M/yy", today);
  if (isValid(dayMonthShortYear)) return dayMonthShortYear;

  return null;
}

function applyTime(baseDate: Date, timeToken?: string) {
  const withTime = new Date(baseDate);
  if (!timeToken) return withTime;
  const match = timeToken.match(/^([01]?\d|2[0-3])[:.]([0-5]\d)$/);
  if (!match) return withTime;
  withTime.setHours(Number(match[1]), Number(match[2]), 0, 0);
  return withTime;
}

function cleanHashCategory(category: string) {
  return category.replace(/^#/, "").replace(/_/g, " ").trim();
}

export function parseQuickAdd(input: string): QuickAddResult | null {
  const original = input.trim();
  if (!original) return null;

  const meta: QuickAddMeta = {};
  const removals = new Set<number>();
  const tokens = original.split(/\s+/);
  let category = "";
  let priority: TaskPriority = "Normal";
  let boardState: BoardState = "todo";
  let repeat: RepeatFrequency = "none";
  let dueDate: Date | null = null;
  let timeToken = "";

  tokens.forEach((token, index) => {
    const normalized = token.toLowerCase();
    const bangPriority = token === "!!!" ? "Urgent" : token === "!!" ? "High" : token === "!" ? "High" : null;

    if (token.startsWith("#") && token.length > 1) {
      category = cleanHashCategory(token);
      meta.category = category;
      removals.add(index);
      return;
    }

    if (bangPriority) {
      priority = bangPriority;
      meta.priorityToken = token;
      removals.add(index);
      return;
    }

    if (priorityAliases[normalized]) {
      priority = priorityAliases[normalized];
      meta.priorityToken = token;
      removals.add(index);
      return;
    }

    if (repeatAliases[normalized]) {
      repeat = repeatAliases[normalized];
      meta.repeatToken = token;
      removals.add(index);
      return;
    }

    if (boardAliases[normalized]) {
      boardState = boardAliases[normalized];
      meta.boardToken = token;
      removals.add(index);
      return;
    }

    const parsedDate = dateFromToken(token);
    if (parsedDate) {
      dueDate = parsedDate;
      meta.dateToken = token;
      removals.add(index);
      return;
    }

    if (/^([01]?\d|2[0-3])[:.]([0-5]\d)$/.test(token)) {
      timeToken = token.replace(".", ":");
      meta.timeToken = timeToken;
      removals.add(index);
    }
  });

  const title = tokens.filter((_, index) => !removals.has(index)).join(" ").trim() || original;
  const reminderBase = dueDate ?? (timeToken ? todayAtStart() : null);
  const reminderAt = reminderBase ? applyTime(reminderBase, timeToken).toISOString() : null;

  return {
    task: {
      title,
      category,
      priority,
      boardState,
      dueAt: dueDate ? format(dueDate, "yyyy-MM-dd") : null,
      reminderAt,
      repeatRule: { frequency: repeat },
    },
    meta,
  };
}
