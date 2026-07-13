import type { BoardState, ImportPayload, RepeatRule, Subtask, Task, TaskPriority, UserSettings } from "./types";
import { nowIso, uid } from "./utils";

type UnknownRecord = Record<string, unknown>;

export type NormalizedImport = {
  tasks: Task[];
  settings: Partial<UserSettings>;
  source: string;
  warnings: string[];
};

const priorities: TaskPriority[] = ["Low", "Normal", "High", "Urgent"];
const boards: BoardState[] = ["todo", "wip", "done"];

function isRecord(value: unknown): value is UnknownRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function stringValue(value: unknown, fallback = "") {
  return typeof value === "string" ? value : value === null || value === undefined ? fallback : String(value);
}

function nullableString(value: unknown) {
  const text = stringValue(value).trim();
  return text ? text : null;
}

function numberValue(value: unknown, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function clampProgress(value: unknown) {
  return Math.min(100, Math.max(0, Math.round(numberValue(value, 0))));
}

function normalizePriority(value: unknown): TaskPriority {
  const text = stringValue(value, "Normal");
  return priorities.includes(text as TaskPriority) ? (text as TaskPriority) : "Normal";
}

function normalizeBoard(value: unknown, progress: number): BoardState {
  const text = stringValue(value);
  if (boards.includes(text as BoardState)) return text as BoardState;
  if (progress >= 100) return "done";
  if (progress > 0) return "wip";
  return "todo";
}

function normalizeRepeat(value: unknown): RepeatRule {
  if (isRecord(value) && typeof value.frequency === "string") {
    const frequency = value.frequency;
    if (frequency === "daily" || frequency === "weekly" || frequency === "monthly" || frequency === "none") {
      return {
        frequency,
        weekdays: Array.isArray(value.weekdays) ? value.weekdays.map((day) => numberValue(day)).filter((day) => day >= 0 && day <= 6) : undefined,
      };
    }
  }
  return { frequency: "none" };
}

function dateString(value: unknown) {
  const text = nullableString(value);
  if (!text || text === "-") return null;
  return text;
}

function normalizeSubtasks(raw: unknown, taskId: string) {
  if (!Array.isArray(raw)) return [];
  return raw.map((item, index) => {
    const source = isRecord(item) ? item : {};
    const progress = clampProgress(source.progress ?? (source.completed ? 100 : 0));
    return {
      id: stringValue(source.id, uid("subtask")),
      taskId,
      title: stringValue(source.title ?? source.text ?? source.name, "งานย่อย"),
      progress,
      position: numberValue(source.position, index),
      completedAt: dateString(source.completedAt ?? source.completed_at ?? (progress >= 100 ? nowIso() : null)),
      deletedAt: dateString(source.deletedAt ?? source.deleted_at),
      updatedAt: stringValue(source.updatedAt ?? source.updated_at, nowIso()),
    } satisfies Subtask;
  });
}

export function normalizeImportedTask(raw: unknown, index = 0) {
  const item = isRecord(raw) ? raw : {};
  const id = stringValue(item.id, uid("task"));
  const progress = clampProgress(item.progress ?? item.status);
  const boardState = normalizeBoard(item.boardState ?? item.board_state, progress);
  const completedAt = dateString(item.completedAt ?? item.completed_at ?? item.completeDate ?? (progress >= 100 ? nowIso() : null));
  const subtasks = normalizeSubtasks(item.subtasks, id);

  return {
    id,
    userId: nullableString(item.userId ?? item.user_id),
    title: stringValue(item.title ?? item.name ?? item.text, `งานนำเข้า ${index + 1}`),
    notes: stringValue(item.notes),
    category: stringValue(item.category),
    priority: normalizePriority(item.priority),
    estimateMinutes: Math.min(480, Math.max(5, numberValue(item.estimateMinutes ?? item.estimate_minutes ?? item.durationMinutes, 30))),
    progress,
    boardState,
    startDate: dateString(item.startDate ?? item.start_date ?? item.addDate),
    dueAt: dateString(item.dueAt ?? item.due_at ?? item.deadline),
    reminderAt: dateString(item.reminderAt ?? item.reminder_at),
    repeatRule: normalizeRepeat(item.repeatRule ?? item.repeat_rule),
    archivedAt: dateString(item.archivedAt ?? item.archived_at),
    deletedAt: dateString(item.deletedAt ?? item.deleted_at),
    completedAt,
    createdAt: stringValue(item.createdAt ?? item.created_at ?? item.addDate, nowIso()),
    updatedAt: nowIso(),
    subtasks,
  } satisfies Task;
}

function parsePayload(data: unknown, source: string): NormalizedImport | null {
  const warnings: string[] = [];
  const settings: Partial<UserSettings> = {};

  if (Array.isArray(data)) {
    return { tasks: data.map(normalizeImportedTask), settings, source, warnings };
  }

  if (!isRecord(data)) return null;
  const payload = isRecord(data.payload) ? (data.payload as ImportPayload["payload"] & UnknownRecord) : null;
  const rawTasks = Array.isArray(data.tasks) ? data.tasks : Array.isArray(payload?.tasks) ? payload.tasks : [];

  const rawSettings = isRecord(data.settings) ? data.settings : {};
  const categories = Array.isArray(payload?.systemCategories)
    ? payload?.systemCategories
    : Array.isArray(rawSettings.categories)
      ? rawSettings.categories
      : [];

  if (categories.length) settings.categories = categories.map((item) => stringValue(item)).filter(Boolean);
  if (payload?.deadlineDaysThreshold !== undefined || rawSettings.deadlineThresholdDays !== undefined) {
    settings.deadlineThresholdDays = numberValue(payload?.deadlineDaysThreshold ?? rawSettings.deadlineThresholdDays, 3);
  }
  if (payload?.isDarkTheme !== undefined) settings.theme = payload.isDarkTheme ? "dark" : "light";
  if (typeof rawSettings.theme === "string" && ["dark", "light", "system"].includes(rawSettings.theme)) {
    settings.theme = rawSettings.theme as UserSettings["theme"];
  }
  if (rawSettings.notificationsEnabled !== undefined) settings.notificationsEnabled = Boolean(rawSettings.notificationsEnabled);
  if (typeof rawSettings.defaultReminderMode === "string" && ["none", "due-time", "30-min-before", "day-start"].includes(rawSettings.defaultReminderMode)) {
    settings.defaultReminderMode = rawSettings.defaultReminderMode as UserSettings["defaultReminderMode"];
  }
  if (rawSettings.dailyDigestEnabled !== undefined) settings.dailyDigestEnabled = Boolean(rawSettings.dailyDigestEnabled);
  if (typeof rawSettings.dailyDigestTime === "string" && /^\d{2}:\d{2}$/.test(rawSettings.dailyDigestTime)) {
    settings.dailyDigestTime = rawSettings.dailyDigestTime;
  }
  if (rawSettings.dailyCapacityMinutes !== undefined) {
    settings.dailyCapacityMinutes = Math.min(960, Math.max(60, numberValue(rawSettings.dailyCapacityMinutes, 360)));
  }
  if (rawSettings.autoBackupMinutes !== undefined) settings.autoBackupMinutes = numberValue(rawSettings.autoBackupMinutes, 60);

  if (!rawTasks.length) warnings.push("ไม่พบข้อมูลงานในไฟล์นี้");

  return {
    tasks: rawTasks.map(normalizeImportedTask),
    settings,
    source,
    warnings,
  };
}

function tryParseJson(text: string) {
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return null;
  }
}

function extractBalancedArray(text: string, marker: string) {
  const markerIndex = text.indexOf(marker);
  if (markerIndex < 0) return null;
  const start = text.indexOf("[", markerIndex);
  if (start < 0) return null;

  let depth = 0;
  let quote: "'" | "\"" | "`" | null = null;
  let escaping = false;

  for (let index = start; index < text.length; index += 1) {
    const char = text[index];
    if (escaping) {
      escaping = false;
      continue;
    }
    if (char === "\\") {
      escaping = true;
      continue;
    }
    if (quote) {
      if (char === quote) quote = null;
      continue;
    }
    if (char === "'" || char === "\"" || char === "`") {
      quote = char;
      continue;
    }
    if (char === "[") depth += 1;
    if (char === "]") depth -= 1;
    if (depth === 0) return text.slice(start, index + 1);
  }

  return null;
}

function parseLooseJsArray(literal: string) {
  const withoutComments = literal.replace(/\/\/.*$/gm, "");
  const quotedKeys = withoutComments.replace(/([{,]\s*)([A-Za-z_$][\w$]*)\s*:/g, '$1"$2":');
  const jsonish = quotedKeys.replace(/'/g, '"').replace(/,\s*([}\]])/g, "$1");
  return tryParseJson(jsonish);
}

function parseHtml(text: string): NormalizedImport {
  const warnings: string[] = [];
  const scriptJson = Array.from(text.matchAll(/<script[^>]*type=["']application\/json["'][^>]*>([\s\S]*?)<\/script>/gi))
    .map((match) => tryParseJson(match[1].trim()))
    .find(Boolean);

  if (scriptJson) {
    const parsed = parsePayload(scriptJson, "JSON ที่ฝังใน HTML");
    if (parsed) return parsed;
  }

  const localStorageMatch = text.match(/song_task_matrix['"]\s*,\s*['"](\[[\s\S]*?\])['"]\s*\)/);
  if (localStorageMatch) {
    const parsed = parsePayload(tryParseJson(localStorageMatch[1]), "ข้อมูล localStorage จาก HTML เดิม");
    if (parsed) return parsed;
  }

  const seedLiteral = extractBalancedArray(text, "preloadedSeeds");
  if (seedLiteral) {
    const parsedSeeds = parseLooseJsArray(seedLiteral);
    const parsed = parsePayload(parsedSeeds, "ข้อมูลตัวอย่างจาก HTML เดิม");
    if (parsed) {
      parsed.warnings.push("ไฟล์ HTML นี้มีเฉพาะข้อมูลตัวอย่าง ถ้าต้องการข้อมูลจริงให้ import ไฟล์ JSON backup จากแอปเดิม");
      return parsed;
    }
  }

  warnings.push("ไม่พบข้อมูล Lucky List หรือข้อมูลจากไฟล์ HTML เดิมที่รองรับ");
  return { tasks: [], settings: {}, source: "HTML เดิม", warnings };
}

export function parseImportFileText(text: string, filename: string): NormalizedImport {
  const lowerName = filename.toLowerCase();
  if (lowerName.endsWith(".html") || /<html[\s>]/i.test(text)) return parseHtml(text);

  const json = tryParseJson(text);
  const parsed = parsePayload(json, "ไฟล์สำรอง JSON");
  if (parsed) return parsed;

  return parseHtml(text);
}
