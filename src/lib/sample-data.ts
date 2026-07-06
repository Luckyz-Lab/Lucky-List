import type { Task, UserSettings } from "./types";
import { nowIso, uid } from "./utils";

const created = "2026-07-04T08:00:00.000Z";

export const defaultSettings: UserSettings = {
  id: "settings_default",
  theme: "light",
  deadlineThresholdDays: 3,
  categories: ["Project", "IT", "Marketing", "Personal", "Other"],
  notificationsEnabled: false,
  autoBackupMinutes: 60,
  lastSyncedAt: null,
  updatedAt: created,
};

export function createSeedTasks(): Task[] {
  const taskA = uid("task");
  const taskB = uid("task");
  const taskC = uid("task");
  const now = nowIso();
  return [
    {
      id: taskA,
      title: "เตรียมข้อมูลระบบบริหารจัดการ",
      notes: "ออกแบบโครงสร้างข้อมูลและหน้าจอหลักสำหรับ Lucky List",
      category: "Project",
      priority: "Urgent",
      progress: 40,
      boardState: "wip",
      startDate: "2026-07-04",
      dueAt: "2026-07-07",
      reminderAt: null,
      repeatRule: { frequency: "none" },
      archivedAt: null,
      deletedAt: null,
      completedAt: null,
      createdAt: now,
      updatedAt: now,
      subtasks: [
        {
          id: uid("subtask"),
          taskId: taskA,
          title: "ล็อก schema และ sync flow",
          progress: 65,
          position: 0,
          completedAt: null,
          deletedAt: null,
          updatedAt: now,
        },
        {
          id: uid("subtask"),
          taskId: taskA,
          title: "ทำ dashboard และ board",
          progress: 20,
          position: 1,
          completedAt: null,
          deletedAt: null,
          updatedAt: now,
        },
      ],
    },
    {
      id: taskB,
      title: "เช็คงานประจำวัน",
      notes: "งานส่วนตัวที่ทำซ้ำทุกวัน",
      category: "Personal",
      priority: "Normal",
      progress: 0,
      boardState: "todo",
      startDate: "2026-07-04",
      dueAt: "2026-07-04",
      reminderAt: "2026-07-04T09:00:00.000Z",
      repeatRule: { frequency: "daily" },
      archivedAt: null,
      deletedAt: null,
      completedAt: null,
      createdAt: now,
      updatedAt: now,
      subtasks: [],
    },
    {
      id: taskC,
      title: "สำรองข้อมูล JSON",
      notes: "ทดสอบ export/import และเก็บไฟล์ backup ไว้ในเครื่อง",
      category: "IT",
      priority: "High",
      progress: 100,
      boardState: "done",
      startDate: "2026-07-03",
      dueAt: "2026-07-04",
      reminderAt: null,
      repeatRule: { frequency: "weekly", weekdays: [6] },
      archivedAt: null,
      deletedAt: null,
      completedAt: now,
      createdAt: created,
      updatedAt: now,
      subtasks: [],
    },
  ];
}
