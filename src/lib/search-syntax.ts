import { isSameDay, parseISO, startOfDay } from "date-fns";
import type { BoardState, RepeatFrequency, Task, TaskPriority } from "./types";
import { daysUntil, isDoneTask, isOverdue } from "./utils";

const priorityAliases: Record<string, TaskPriority> = {
  low: "Low",
  normal: "Normal",
  medium: "Normal",
  high: "High",
  urgent: "Urgent",
  ด่วน: "Urgent",
};

const statusAliases: Record<string, BoardState> = {
  todo: "todo",
  wip: "wip",
  doing: "wip",
  progress: "wip",
  done: "done",
};

const repeatAliases: Record<string, RepeatFrequency> = {
  none: "none",
  no: "none",
  daily: "daily",
  day: "daily",
  weekly: "weekly",
  week: "weekly",
  monthly: "monthly",
  month: "monthly",
};

interface ParsedTaskQuery {
  text: string[];
  categories: string[];
  priority?: TaskPriority;
  status?: BoardState;
  due?: string;
  reminder?: string;
  repeat?: RepeatFrequency;
  done?: boolean;
}

function compareDate(value: string | null | undefined, filter: string, thresholdDays: number) {
  const normalized = filter.toLowerCase();
  if (normalized === "none") return !value;
  if (!value) return false;

  const date = parseISO(value);
  const today = new Date();
  if (normalized === "today") return isSameDay(date, today);
  if (normalized === "overdue") return date < startOfDay(today);
  if (normalized === "soon") {
    const diff = daysUntil(value);
    return diff !== null && diff >= 0 && diff <= thresholdDays;
  }

  try {
    return isSameDay(date, parseISO(filter));
  } catch {
    return false;
  }
}

export function parseTaskQuery(query: string): ParsedTaskQuery {
  const parsed: ParsedTaskQuery = { text: [], categories: [] };
  const tokens = query.match(/"[^"]+"|\S+/g) ?? [];

  for (const rawToken of tokens) {
    const token = rawToken.replace(/^"|"$/g, "").trim();
    if (!token) continue;

    if (token.startsWith("#") && token.length > 1) {
      parsed.categories.push(token.slice(1).toLowerCase());
      continue;
    }

    const [rawKey, ...rawValueParts] = token.split(":");
    const value = rawValueParts.join(":").trim();
    const key = rawKey.toLowerCase();
    if (value) {
      const normalizedValue = value.toLowerCase();
      if (key === "p" || key === "priority") {
        parsed.priority = priorityAliases[normalizedValue];
        continue;
      }
      if (key === "s" || key === "status") {
        parsed.status = statusAliases[normalizedValue];
        continue;
      }
      if (key === "due") {
        parsed.due = value;
        continue;
      }
      if (key === "remind" || key === "reminder") {
        parsed.reminder = value;
        continue;
      }
      if (key === "repeat") {
        parsed.repeat = repeatAliases[normalizedValue];
        continue;
      }
      if (key === "done") {
        parsed.done = ["1", "true", "yes"].includes(normalizedValue);
        continue;
      }
    }

    const priority = priorityAliases[token.toLowerCase()];
    if (priority) {
      parsed.priority = priority;
      continue;
    }
    parsed.text.push(token.toLowerCase());
  }

  return parsed;
}

export function matchesTaskQuery(task: Task, query: string, thresholdDays: number) {
  const parsed = parseTaskQuery(query);
  const haystack = `${task.title} ${task.notes ?? ""} ${task.category ?? ""}`.toLowerCase();

  if (parsed.text.some((term) => !haystack.includes(term))) return false;
  if (parsed.categories.length && !parsed.categories.includes((task.category ?? "").toLowerCase())) return false;
  if (parsed.priority && task.priority !== parsed.priority) return false;
  if (parsed.status && task.boardState !== parsed.status) return false;
  if (parsed.repeat && task.repeatRule.frequency !== parsed.repeat) return false;
  if (typeof parsed.done === "boolean" && isDoneTask(task) !== parsed.done) return false;
  if (parsed.due === "overdue" && !isOverdue(task)) return false;
  if (parsed.due && parsed.due !== "overdue" && !compareDate(task.dueAt, parsed.due, thresholdDays)) return false;
  if (parsed.reminder && !compareDate(task.reminderAt, parsed.reminder, thresholdDays)) return false;

  return true;
}
