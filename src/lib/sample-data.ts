import type { Task, UserSettings } from "./types";
import { nowIso, uid } from "./utils";

const created = "2026-07-04T08:00:00.000Z";

export const defaultSettings: UserSettings = {
  id: "settings_default",
  theme: "light",
  deadlineThresholdDays: 3,
  categories: ["โปรเจกต์", "ไอที", "การตลาด", "ส่วนตัว", "อื่นๆ"],
  notificationsEnabled: false,
  defaultReminderMode: "day-start",
  dailyDigestEnabled: true,
  dailyDigestTime: "09:00",
  dailyCapacityMinutes: 360,
  autoBackupMinutes: 60,
  lastSyncedAt: null,
  updatedAt: created,
};

const demoTitles = [
  "ตรวจ checklist งานระบบ",
  "เตรียมสรุปสถานะประจำสัปดาห์",
  "อัปเดต backlog โปรเจกต์",
  "ตรวจ flow สำรองข้อมูล",
  "ร่างข้อความติดตามลูกค้า",
  "ล้างรายการซ้ำ",
  "วางแผนคอนเทนต์",
  "ตรวจการตั้งค่าแจ้งเตือน",
  "เขียน release notes",
  "ตรวจเงื่อนไขงานทำซ้ำ",
  "วาง metric แดชบอร์ด",
  "ตรวจ flow อัปเดตข้อมูลออนไลน์",
  "จัดไฟล์อ้างอิง",
  "ตรวจใบเสร็จค่าใช้จ่าย",
  "สร้าง checklist เริ่มงาน",
  "จัดลำดับ ticket ด่วน",
  "ตรวจ layout มือถือ",
  "ส่งออก CSV รายเดือน",
  "ปรับ label บนบอร์ด",
  "ตั้งเวลาทบทวน reminder",
];

const demoNotes = [
  "งานตัวอย่างสำหรับทดสอบความแน่นของบอร์ดและตัวกรอง",
  "สร้างเป็นข้อมูลทดลอง แก้ไขหรือเก็บเข้าประวัติหลังตรวจได้",
  "ใช้ทดสอบกำหนดส่ง ความสำคัญ และความคืบหน้า",
  "งานตัวอย่างสำหรับตรวจหน้าจอ desktop และ mobile",
];

const demoCategories = ["โปรเจกต์", "ไอที", "การตลาด", "ส่วนตัว", "งานระบบ", "การเงิน", "ออกแบบ", "อื่นๆ"];
const demoPriorities: Task["priority"][] = ["Low", "Normal", "High", "Urgent"];
const demoStates: Task["boardState"][] = ["todo", "wip", "done"];
const demoDueOffsets: Array<number | null> = [-5, -2, -1, 0, 1, 2, 3, 5, 7, 10, null];

function dateWithOffset(offset: number) {
  const date = new Date();
  date.setDate(date.getDate() + offset);
  return date.toISOString().slice(0, 10);
}

export function createDemoTasks(count = 50): Task[] {
  const now = nowIso();
  return Array.from({ length: count }, (_, index) => {
    const id = uid("task_demo");
    const boardState = demoStates[index % demoStates.length];
    const dueOffset = demoDueOffsets[index % demoDueOffsets.length];
    const progress = boardState === "done" ? 100 : boardState === "wip" ? 25 + ((index * 7) % 60) : (index * 5) % 20;
    const subtaskCount = index % 4 === 0 ? 3 : index % 3 === 0 ? 2 : index % 5 === 0 ? 1 : 0;
    return {
      id,
      title: `${demoTitles[index % demoTitles.length]} #${index + 1}`,
      notes: demoNotes[index % demoNotes.length],
      category: demoCategories[index % demoCategories.length],
      priority: demoPriorities[index % demoPriorities.length],
      estimateMinutes: [15, 30, 45, 60, 90][index % 5],
      progress,
      boardState,
      startDate: dateWithOffset(-((index % 6) + 1)),
      dueAt: dueOffset === null ? null : dateWithOffset(dueOffset),
      reminderAt: index % 5 === 0 ? `${dateWithOffset(Math.max(0, dueOffset ?? 2))}T09:00:00.000Z` : null,
      repeatRule: index % 13 === 0 ? { frequency: "weekly", weekdays: [1] } : index % 17 === 0 ? { frequency: "monthly" } : { frequency: "none" },
      archivedAt: null,
      deletedAt: null,
      completedAt: boardState === "done" ? now : null,
      createdAt: now,
      updatedAt: now,
      subtasks: Array.from({ length: subtaskCount }, (_, subtaskIndex) => ({
        id: uid("subtask_demo"),
        taskId: id,
        title: `จุดตรวจ ${subtaskIndex + 1}`,
        progress: Math.min(100, Math.max(0, progress + subtaskIndex * 10 - 10)),
        position: subtaskIndex,
        completedAt: progress >= 100 ? now : null,
        deletedAt: null,
        updatedAt: now,
      })),
    };
  });
}

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
      category: "โปรเจกต์",
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
          title: "ล็อก schema และ flow ออนไลน์",
          progress: 65,
          position: 0,
          completedAt: null,
          deletedAt: null,
          updatedAt: now,
        },
        {
          id: uid("subtask"),
          taskId: taskA,
          title: "ทำแดชบอร์ดและบอร์ด",
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
      category: "ส่วนตัว",
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
      notes: "ทดสอบส่งออก/นำเข้า และเก็บไฟล์สำรองไว้ในเครื่อง",
      category: "ไอที",
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
