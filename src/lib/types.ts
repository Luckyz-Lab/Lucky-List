export type TaskPriority = "Low" | "Normal" | "High" | "Urgent";
export type BoardState = "todo" | "wip" | "done";
export type RepeatFrequency = "none" | "daily" | "weekly" | "monthly";
export type SyncState = "idle" | "offline" | "syncing" | "synced" | "error";
export type AppView = "dashboard" | "board" | "tasks" | "calendar" | "archive" | "settings";

export interface RepeatRule {
  frequency: RepeatFrequency;
  weekdays?: number[];
}

export interface Subtask {
  id: string;
  taskId: string;
  title: string;
  progress: number;
  position: number;
  completedAt?: string | null;
  deletedAt?: string | null;
  updatedAt: string;
}

export interface Task {
  id: string;
  userId?: string | null;
  title: string;
  notes?: string;
  category?: string;
  priority: TaskPriority;
  progress: number;
  boardState: BoardState;
  startDate?: string | null;
  dueAt?: string | null;
  reminderAt?: string | null;
  repeatRule: RepeatRule;
  archivedAt?: string | null;
  deletedAt?: string | null;
  completedAt?: string | null;
  createdAt: string;
  updatedAt: string;
  subtasks: Subtask[];
}

export interface UserSettings {
  id: string;
  userId?: string | null;
  theme: "dark" | "light" | "system";
  deadlineThresholdDays: number;
  categories: string[];
  notificationsEnabled: boolean;
  autoBackupMinutes: number;
  lastSyncedAt?: string | null;
  updatedAt: string;
}

export interface MutationQueueItem {
  id: string;
  entity: "task" | "settings";
  operation: "upsert" | "delete";
  payload: Task | UserSettings;
  createdAt: string;
  attempts: number;
  lastError?: string;
}

export interface ImportPayload {
  identifier?: string;
  generated_at?: string;
  payload?: {
    tasks?: unknown[];
    systemCategories?: string[];
    deadlineDaysThreshold?: number;
    isDarkTheme?: boolean;
  };
  tasks?: Task[];
  settings?: Partial<UserSettings>;
}
