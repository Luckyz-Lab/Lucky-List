import { z } from "zod";

export const taskPrioritySchema = z.enum(["Low", "Normal", "High", "Urgent"]);
export const boardStateSchema = z.enum(["todo", "wip", "done"]);
export const repeatFrequencySchema = z.enum(["none", "daily", "weekly", "monthly"]);
export const defaultReminderModeSchema = z.enum(["none", "due-time", "30-min-before", "day-start"]);

export const repeatRuleSchema = z.object({
  frequency: repeatFrequencySchema,
  weekdays: z.array(z.number().int().min(0).max(6)).optional(),
});

export const subtaskSchema = z.object({
  id: z.string().min(1),
  taskId: z.string().min(1),
  title: z.string().min(1),
  progress: z.number().int().min(0).max(100),
  position: z.number().int().min(0),
  completedAt: z.string().nullable().optional(),
  deletedAt: z.string().nullable().optional(),
  updatedAt: z.string().min(1),
});

export const taskSchema = z.object({
  id: z.string().min(1),
  userId: z.string().nullable().optional(),
  title: z.string().min(1),
  notes: z.string().optional(),
  category: z.string().optional(),
  priority: taskPrioritySchema,
  progress: z.number().int().min(0).max(100),
  boardState: boardStateSchema,
  startDate: z.string().nullable().optional(),
  dueAt: z.string().nullable().optional(),
  reminderAt: z.string().nullable().optional(),
  repeatRule: repeatRuleSchema,
  archivedAt: z.string().nullable().optional(),
  deletedAt: z.string().nullable().optional(),
  completedAt: z.string().nullable().optional(),
  createdAt: z.string().min(1),
  updatedAt: z.string().min(1),
  subtasks: z.array(subtaskSchema),
});

export const userSettingsSchema = z.object({
  id: z.string().min(1),
  userId: z.string().nullable().optional(),
  theme: z.enum(["dark", "light", "system"]),
  deadlineThresholdDays: z.number().int().min(1).max(31),
  categories: z.array(z.string().min(1)),
  notificationsEnabled: z.boolean(),
  defaultReminderMode: defaultReminderModeSchema.default("day-start"),
  dailyDigestEnabled: z.boolean().default(true),
  dailyDigestTime: z.string().regex(/^\d{2}:\d{2}$/).default("09:00"),
  autoBackupMinutes: z.number().int().min(0).max(1440),
  lastSyncedAt: z.string().nullable().optional(),
  updatedAt: z.string().min(1),
});

export const importPayloadSchema = z.object({
  identifier: z.string().optional(),
  generated_at: z.string().optional(),
  payload: z
    .object({
      tasks: z.array(z.unknown()).optional(),
      systemCategories: z.array(z.string()).optional(),
      deadlineDaysThreshold: z.number().optional(),
      isDarkTheme: z.boolean().optional(),
    })
    .optional(),
  tasks: z.array(z.unknown()).optional(),
  settings: z.record(z.string(), z.unknown()).optional(),
});
