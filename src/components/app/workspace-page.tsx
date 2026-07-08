"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  Archive,
  Bell,
  Bookmark,
  CalendarDays,
  CalendarPlus,
  Check,
  CheckCircle2,
  ChevronRight,
  CirclePlus,
  Clock,
  Copy,
  Download,
  FileJson,
  Gauge,
  Inbox,
  Keyboard,
  LayoutDashboard,
  ListChecks,
  MoveRight,
  MoreHorizontal,
  RefreshCcw,
  RotateCcw,
  Search,
  Settings,
  ShieldCheck,
  SlidersHorizontal,
  Target,
  Trash2,
  Upload,
  Zap,
} from "lucide-react";
import { type ComponentType, useEffect, useMemo, useRef, useState } from "react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
} from "recharts";
import { Button } from "@/components/ui/button";
import { Panel } from "@/components/ui/panel";
import { CommandPalette } from "@/components/app/command-palette";
import { QuickAddBar } from "@/components/app/quick-add-bar";
import { WorkspaceShell, type WorkspaceNavItem } from "@/components/app/workspace-shell";
import { useReminderNotifications } from "@/lib/client/use-reminder-notifications";
import { useLuckyList } from "@/lib/client/use-lucky-list";
import { lockPrivateSession } from "@/lib/auth/pin";
import { matchesTaskQuery } from "@/lib/search-syntax";
import { hasSupabaseEnv } from "@/lib/supabase/client";
import type { AppView, BoardState, Task, TaskPriority } from "@/lib/types";
import {
  boardLabel,
  categoryLabel,
  cn,
  daysUntil,
  formatThaiDate,
  isDoneTask,
  isDueSoon,
  isOverdue,
  isTodayTask,
  notificationPermissionLabel,
  priorityLabel,
  relativeDueLabel,
  repeatLabel,
  taskSort,
  nowIso,
  uid,
} from "@/lib/utils";
import { TaskModal } from "./task-modal";

const navItems: WorkspaceNavItem[] = [
  { view: "dashboard", href: "/app", label: "แดชบอร์ด", icon: LayoutDashboard },
  { view: "focus", href: "/app/focus", label: "โฟกัส", icon: Target },
  { view: "board", href: "/app/board", label: "บอร์ด", icon: Gauge },
  { view: "tasks", href: "/app/tasks", label: "งานทั้งหมด", icon: ListChecks },
  { view: "calendar", href: "/app/calendar", label: "ปฏิทิน", icon: CalendarDays },
  { view: "archive", href: "/app/archive", label: "ประวัติ", icon: Archive },
  { view: "settings", href: "/app/settings", label: "ตั้งค่า", icon: Settings },
];
const primaryMobileNav = navItems.filter((item) => ["dashboard", "focus", "board", "tasks"].includes(item.view));
const moreMobileNav = navItems.filter((item) => ["calendar", "archive", "settings"].includes(item.view));

const boardStates: BoardState[] = ["todo", "wip", "done"];
const priorities: TaskPriority[] = ["Low", "Normal", "High", "Urgent"];
const boardDueFilters = ["All", "Overdue", "Today", "Soon", "No date"] as const;
type BoardDueFilter = (typeof boardDueFilters)[number];
type BoardDensity = "compact" | "comfort";
type ReviewStageKey = "inbox" | "overdue" | "noDate" | "someday" | "done";

const boardDueFilterLabels: Record<BoardDueFilter, string> = {
  All: "ทั้งหมด",
  Overdue: "เลยกำหนด",
  Today: "วันนี้",
  Soon: "ใกล้ถึงกำหนด",
  "No date": "ยังไม่กำหนดวัน",
};

const densityLabels: Record<BoardDensity, string> = {
  compact: "แน่น",
  comfort: "อ่านง่าย",
};

const productivityTemplates = [
  {
    name: "รีวิวประจำสัปดาห์",
    description: "ทบทวนงานค้าง จัดลำดับ และเลือกงานสำคัญของสัปดาห์",
    title: "รีวิวประจำสัปดาห์",
    category: "Review",
    priority: "Normal" as TaskPriority,
    subtasks: ["เคลียร์กล่องรับงาน", "ดูงานที่เลยกำหนด", "เลือกงานสำคัญของสัปดาห์", "ย้ายงานที่ยังไม่ทำไปพักไว้ก่อน"],
  },
  {
    name: "บล็อกเวลาทำงานลึก",
    description: "เตรียมงานสำคัญหนึ่งชิ้นแบบไม่ถูกรบกวน",
    title: "บล็อกเวลาทำงานลึก",
    category: "Focus",
    priority: "High" as TaskPriority,
    subtasks: ["กำหนดผลลัพธ์", "ล็อกเวลาในปฏิทิน", "ตัดสิ่งรบกวน", "ส่งร่างแรก"],
  },
  {
    name: "เก็บงานจุกจิก",
    description: "เก็บงานจุกจิก เอกสาร และรายการที่เลื่อนมานาน",
    title: "เก็บงานจุกจิก",
    category: "Personal",
    priority: "Normal" as TaskPriority,
    subtasks: ["จัดเอกสาร", "ตอบข้อความที่ค้าง", "เก็บงานที่เสร็จแล้ว"],
  },
];

function priorityClass(priority: TaskPriority) {
  return {
    Low: "border-[var(--border)] bg-[var(--surface-strong)] text-[var(--muted)]",
    Normal: "border-[var(--border)] bg-[var(--surface)] text-[var(--foreground)]",
    High: "border-[var(--warning)] bg-[color-mix(in_oklab,var(--warning)_8%,transparent)] text-[var(--warning)]",
    Urgent: "border-[var(--danger)] bg-[color-mix(in_oklab,var(--danger)_8%,transparent)] text-[var(--danger)]",
  }[priority];
}

function boardClass(state: BoardState) {
  return {
    todo: "border-[var(--border)] bg-[var(--surface-strong)] text-[var(--muted)]",
    wip: "border-[var(--foreground)] bg-[var(--foreground)] text-[var(--background)]",
    done: "border-[var(--success)] bg-[color-mix(in_oklab,var(--success)_8%,transparent)] text-[var(--success)]",
  }[state];
}

function boardActionClass(state: BoardState) {
  return {
    todo: "border-red-300 bg-red-50 text-red-700 hover:border-red-500 hover:bg-red-100 dark:border-red-900/70 dark:bg-red-950/35 dark:text-red-300",
    wip: "border-blue-300 bg-blue-50 text-blue-700 hover:border-blue-500 hover:bg-blue-100 dark:border-blue-900/70 dark:bg-blue-950/35 dark:text-blue-300",
    done: "border-emerald-300 bg-emerald-50 text-emerald-700 hover:border-emerald-500 hover:bg-emerald-100 dark:border-emerald-900/70 dark:bg-emerald-950/35 dark:text-emerald-300",
  }[state];
}

export function WorkspacePage({ initialView }: { initialView: AppView }) {
  const pathname = usePathname();
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [commandOpen, setCommandOpen] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);
  const [importNotice, setImportNotice] = useState("");
  const [undoAction, setUndoAction] = useState<{ label: string; run: () => Promise<void> } | null>(null);
  const [query, setQuery] = useState("");
  const [priorityFilter, setPriorityFilter] = useState<"All" | TaskPriority>("All");
  const [categoryFilter, setCategoryFilter] = useState("All");
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [boardDueFilter, setBoardDueFilter] = useState<BoardDueFilter>("All");
  const [boardDensity, setBoardDensity] = useState<BoardDensity>("compact");
  const [inspectorOpen, setInspectorOpen] = useState(true);
  const [reviewNow] = useState(() => Date.now());
  const [reviewStage, setReviewStage] = useState<ReviewStageKey>("inbox");
  const {
    tasks,
    settings: userSettings,
    loading,
    cloudState,
    cloudMessage,
    cloudConnected,
    isAuthed,
    saveTask,
    moveTask,
    quickAdd,
    deleteTask,
    archiveTask,
    cloneTask,
    updateSubtask,
    saveSettings,
    refreshCloud,
    exportJson,
    backupNow,
    exportLatestLocalBackup,
    exportCsv,
    importFile,
    addDemoTasks,
    lastBackupAt,
  } = useLuckyList();

  const activeView = navItems.find((item) => item.href === pathname)?.view ?? initialView;
  const activeTasks = useMemo(() => tasks.filter((task) => !task.archivedAt && !task.deletedAt), [tasks]);
  const archivedTasks = useMemo(() => tasks.filter((task) => task.archivedAt && !task.deletedAt), [tasks]);
  const doneTasks = useMemo(() => activeTasks.filter(isDoneTask), [activeTasks]);
  const openTasks = useMemo(() => activeTasks.filter((task) => !isDoneTask(task)), [activeTasks]);
  const inboxTasks = useMemo(() => openTasks.filter((task) => !task.category || task.category === "Inbox"), [openTasks]);
  const somedayTasks = useMemo(() => openTasks.filter((task) => task.category === "Someday").sort(taskSort), [openTasks]);
  const noDateTasks = useMemo(
    () => openTasks.filter((task) => !task.dueAt && !task.startDate && !task.reminderAt && task.category !== "Someday").sort(taskSort),
    [openTasks],
  );
  const soonTasks = useMemo(
    () => openTasks.filter((task) => isDueSoon(task, userSettings.deadlineThresholdDays)).sort(taskSort),
    [openTasks, userSettings.deadlineThresholdDays],
  );
  const overdueTasks = useMemo(() => openTasks.filter(isOverdue), [openTasks]);
  const todayTasks = useMemo(() => openTasks.filter(isTodayTask).sort(taskSort), [openTasks]);
  const focusTasks = useMemo(() => {
    const seen = new Set<string>();
    return [...overdueTasks, ...todayTasks, ...soonTasks, ...openTasks.filter((task) => task.priority === "Urgent")]
      .filter((task) => {
        if (seen.has(task.id)) return false;
        seen.add(task.id);
        return true;
      })
      .sort(taskSort);
  }, [openTasks, overdueTasks, soonTasks, todayTasks]);
  const categories = useMemo(
    () => Array.from(new Set([...userSettings.categories, ...tasks.map((task) => task.category).filter(Boolean)])) as string[],
    [tasks, userSettings.categories],
  );
  const reminders = useReminderNotifications(activeTasks, userSettings.notificationsEnabled);

  const filteredTasks = useMemo(() => {
    return activeTasks
      .filter((task) => !query.trim() || matchesTaskQuery(task, query, userSettings.deadlineThresholdDays))
      .filter((task) => priorityFilter === "All" || task.priority === priorityFilter)
      .filter((task) => categoryFilter === "All" || task.category === categoryFilter)
      .sort(taskSort);
  }, [activeTasks, categoryFilter, priorityFilter, query, userSettings.deadlineThresholdDays]);

  const filteredBoardTasks = useMemo(() => {
    return activeTasks
      .filter((task) => !query.trim() || matchesTaskQuery(task, query, userSettings.deadlineThresholdDays))
      .filter((task) => priorityFilter === "All" || task.priority === priorityFilter)
      .filter((task) => categoryFilter === "All" || task.category === categoryFilter)
      .filter((task) => {
        if (boardDueFilter === "Overdue") return isOverdue(task);
        if (boardDueFilter === "Today") return isTodayTask(task);
        if (boardDueFilter === "Soon") return isDueSoon(task, userSettings.deadlineThresholdDays);
        if (boardDueFilter === "No date") return !task.dueAt;
        return true;
      })
      .sort(taskSort);
  }, [activeTasks, boardDueFilter, categoryFilter, priorityFilter, query, userSettings.deadlineThresholdDays]);

  const recentTasks = useMemo(
    () => [...activeTasks].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)).slice(0, 8),
    [activeTasks],
  );
  const staleWipTasks = useMemo(() => {
    const cutoff = reviewNow - 5 * 86400000;
    return openTasks.filter((task) => task.boardState === "wip" && new Date(task.updatedAt).getTime() < cutoff).sort(taskSort);
  }, [openTasks, reviewNow]);
  const reviewTasks = useMemo(() => {
    const seen = new Set<string>();
    return [...overdueTasks, ...staleWipTasks, ...noDateTasks, ...somedayTasks].filter((task) => {
      if (seen.has(task.id)) return false;
      seen.add(task.id);
      return true;
    });
  }, [noDateTasks, overdueTasks, somedayTasks, staleWipTasks]);
  const savedViews = useMemo(
    () => [
      { label: "กล่องรับงาน", detail: "จดไว้ก่อน", count: inboxTasks.length, query: "#Inbox", icon: Inbox },
      { label: "วันนี้", detail: "งานของวันนี้", count: todayTasks.length, query: "due:today", icon: CalendarPlus },
      { label: "เลยกำหนด", detail: "ต้องจัดการก่อน", count: overdueTasks.length, query: "due:overdue", icon: Bell },
      { label: "ยังไม่กำหนดวัน", detail: "ยังไม่ได้ตัดสินใจ", count: noDateTasks.length, query: "due:none", icon: Clock },
      { label: "พักไว้ก่อน", detail: "ทบทวนทีหลัง", count: somedayTasks.length, query: "#Someday", icon: Bookmark },
      { label: "งานสำคัญ", detail: "สูง / ด่วนมาก", count: openTasks.filter((task) => task.priority === "High" || task.priority === "Urgent").length, query: "priority:high", icon: Zap },
    ],
    [inboxTasks.length, noDateTasks.length, openTasks, overdueTasks.length, somedayTasks.length, todayTasks.length],
  );

  const chartData = useMemo(() => {
    const days = ["จ", "อ", "พ", "พฤ", "ศ", "ส", "อา"];
    return days.map((day, index) => ({
      day,
      done: Math.max(0, doneTasks.length - (6 - index)) + index,
      active: Math.max(1, openTasks.length + (index % 3)),
    }));
  }, [doneTasks.length, openTasks.length]);

  const completion = activeTasks.length ? Math.round((doneTasks.length / activeTasks.length) * 100) : 0;
  const plannedTodayTasks = useMemo(() => todayTasks.slice(0, 3), [todayTasks]);
  const nextActions = useMemo(() => {
    const seen = new Set<string>();
    return [...overdueTasks, ...todayTasks, ...openTasks.filter((task) => task.priority === "Urgent" || task.priority === "High"), ...soonTasks]
      .filter((task) => {
        if (seen.has(task.id)) return false;
        seen.add(task.id);
        return true;
      })
      .slice(0, 6);
  }, [openTasks, overdueTasks, soonTasks, todayTasks]);
  const reviewStages = useMemo(
    () => [
      { key: "inbox" as const, label: "รับเข้า", detail: "จัดงานที่เพิ่งจด", tasks: inboxTasks, action: "เลือกว่าจะทำวันนี้หรือเก็บเข้าหมวด" },
      { key: "overdue" as const, label: "เลยกำหนด", detail: "กู้แผนงานที่หลุด", tasks: overdueTasks, action: "ย้ายมาวันนี้หรือเลื่อนกำหนด" },
      { key: "noDate" as const, label: "ไม่มีวัน", detail: "ตัดสินใจเวลาให้ชัด", tasks: noDateTasks, action: "กำหนดวัน หรือพักไว้ก่อน" },
      { key: "someday" as const, label: "พักไว้", detail: "ทบทวนไอเดียที่พักไว้", tasks: somedayTasks, action: "เก็บไว้ วางแผน หรือย้ายเข้าประวัติ" },
      { key: "done" as const, label: "เสร็จแล้ว", detail: "เก็บงานที่ปิดแล้ว", tasks: doneTasks.filter((task) => !task.archivedAt).slice(0, 12), action: "เก็บเข้าประวัติ" },
    ],
    [doneTasks, inboxTasks, noDateTasks, overdueTasks, somedayTasks],
  );
  const currentReviewStage = reviewStages.find((stage) => stage.key === reviewStage) ?? reviewStages[0];
  const currentReviewTask = currentReviewStage.tasks[0] ?? null;
  function openCreate() {
    setEditingTask(null);
    setModalOpen(true);
  }

  function openEdit(task: Task) {
    setEditingTask(task);
    setModalOpen(true);
  }

  function actionErrorMessage(error: unknown, fallback = "ทำรายการไม่สำเร็จ") {
    if (error instanceof Error) return error.message;
    if (error && typeof error === "object") {
      const record = error as { message?: unknown; details?: unknown; code?: unknown };
      const message = typeof record.message === "string" ? record.message : "";
      const details = typeof record.details === "string" ? record.details : "";
      const code = typeof record.code === "string" ? record.code : "";
      return [message, details, code && `code: ${code}`].filter(Boolean).join(" - ") || fallback;
    }
    return fallback;
  }

  async function handleQuickAdd(text: string) {
    try {
      const task = await quickAdd(text);
      if (task) setImportNotice(`เพิ่มงานแล้ว: ${task.title}`);
      return task;
    } catch (error) {
      setImportNotice(actionErrorMessage(error, "เพิ่มงานไม่สำเร็จ"));
      return null;
    }
  }

  async function handleDeleteTask(task: Task) {
    try {
      await deleteTask(task);
      setUndoAction({
        label: `ลบแล้ว: ${task.title}`,
        run: async () => {
          await saveTask({ ...task, deletedAt: null });
        },
      });
    } catch (error) {
      setImportNotice(actionErrorMessage(error, "ลบงานไม่สำเร็จ"));
    }
  }

  async function handleArchiveTask(task: Task, archived: boolean) {
    try {
      await archiveTask(task, archived);
      if (archived) {
        setUndoAction({
          label: `ย้ายเข้าประวัติแล้ว: ${task.title}`,
          run: async () => {
            await archiveTask(task, false);
          },
        });
      }
    } catch (error) {
      setImportNotice(actionErrorMessage(error, archived ? "เก็บงานไม่สำเร็จ" : "กู้คืนงานไม่สำเร็จ"));
    }
  }

  async function handleImportFile(file: File) {
    try {
      const result = await importFile(file);
      const warning = result.warnings.length ? ` (${result.warnings.join(" ")})` : "";
      setImportNotice(`นำเข้างาน ${result.tasks.length} งานจาก ${result.source}${warning}`);
    } catch (error) {
      setImportNotice(error instanceof Error ? error.message : "นำเข้าไม่สำเร็จ");
    }
  }

  async function handleAddDemoTasks() {
    try {
      const demoTasks = await addDemoTasks(50);
      setImportNotice(`เพิ่มงานตัวอย่าง ${demoTasks.length} งานแล้ว`);
    } catch (error) {
      setImportNotice(actionErrorMessage(error, "เพิ่มงานตัวอย่างไม่สำเร็จ"));
    }
  }

  async function handlePlanMyDay() {
    try {
      const candidates = nextActions.filter((task) => !isTodayTask(task)).slice(0, 5);
      if (!candidates.length) {
        setImportNotice("วันนี้มีแผนงานพร้อมแล้ว");
        return;
      }
      for (const task of candidates) {
        await saveTask({ ...task, startDate: new Date().toISOString().slice(0, 10), boardState: task.boardState === "done" ? "todo" : task.boardState });
      }
      setImportNotice(`วางแผนวันนี้เพิ่ม ${candidates.length} งานแล้ว`);
    } catch (error) {
      setImportNotice(actionErrorMessage(error, "วางแผนวันนี้ไม่สำเร็จ"));
    }
  }

  async function handleToggleDone(task: Task) {
    try {
      await moveTask(task, isDoneTask(task) ? "todo" : "done");
      setImportNotice(isDoneTask(task) ? `เปิดงานอีกครั้ง: ${task.title}` : `ทำเสร็จแล้ว: ${task.title}`);
    } catch (error) {
      setImportNotice(actionErrorMessage(error, "เปลี่ยนสถานะงานไม่สำเร็จ"));
    }
  }

  async function handleMoveTask(task: Task, boardState: BoardState) {
    try {
      await moveTask(task, boardState);
      setImportNotice(`ย้ายไป${boardLabel(boardState)}: ${task.title}`);
    } catch (error) {
      setImportNotice(actionErrorMessage(error, "ย้ายงานไม่สำเร็จ"));
    }
  }

  async function handleCloneTask(task: Task) {
    try {
      await cloneTask(task);
      setImportNotice(`ทำสำเนาแล้ว: ${task.title}`);
    } catch (error) {
      setImportNotice(actionErrorMessage(error, "ทำสำเนางานไม่สำเร็จ"));
    }
  }

  async function handleUpdateSubtask(task: Task, subtaskId: string, progress: number) {
    try {
      await updateSubtask(task, subtaskId, progress);
    } catch (error) {
      setImportNotice(actionErrorMessage(error, "อัปเดตงานย่อยไม่สำเร็จ"));
    }
  }

  async function handleRefreshCloud() {
    try {
      await refreshCloud();
      setImportNotice("อัปเดตข้อมูลแล้ว");
    } catch (error) {
      setImportNotice(actionErrorMessage(error, "อัปเดตข้อมูลไม่สำเร็จ"));
    }
  }

  async function handleToggleTheme() {
    try {
      await saveSettings({ theme: userSettings.theme === "dark" ? "light" : "dark" });
    } catch (error) {
      setImportNotice(actionErrorMessage(error, "เปลี่ยนธีมไม่สำเร็จ"));
    }
  }

  async function handleSaveSettingsPatch(patch: Parameters<typeof saveSettings>[0]) {
    try {
      await saveSettings(patch);
    } catch (error) {
      setImportNotice(actionErrorMessage(error, "บันทึกการตั้งค่าไม่สำเร็จ"));
    }
  }

  async function handleBackupNow() {
    try {
      await backupNow(true);
      setImportNotice("สำรองไฟล์แล้ว");
    } catch (error) {
      setImportNotice(actionErrorMessage(error, "สำรองไฟล์ไม่สำเร็จ"));
    }
  }

  async function handleExportLatestBackup() {
    try {
      await exportLatestLocalBackup();
      setImportNotice("ดาวน์โหลดไฟล์สำรองล่าสุดแล้ว");
    } catch (error) {
      setImportNotice(actionErrorMessage(error, "ดาวน์โหลดไฟล์สำรองไม่สำเร็จ"));
    }
  }

  async function handlePlanToday(task: Task) {
    try {
      await saveTask({ ...task, startDate: new Date().toISOString().slice(0, 10), boardState: task.boardState === "done" ? "todo" : task.boardState });
      setImportNotice(`เพิ่มเข้าแผนวันนี้: ${task.title}`);
    } catch (error) {
      setImportNotice(actionErrorMessage(error, "เพิ่มเข้าแผนวันนี้ไม่สำเร็จ"));
    }
  }

  async function handleSendToInbox(task: Task) {
    try {
      await saveTask({ ...task, category: "Inbox", boardState: task.boardState === "done" ? "todo" : task.boardState });
      setImportNotice(`ย้ายเข้ากล่องรับงาน: ${task.title}`);
    } catch (error) {
      setImportNotice(actionErrorMessage(error, "ย้ายเข้ากล่องรับงานไม่สำเร็จ"));
    }
  }

  async function handleSendSomeday(task: Task) {
    try {
      await saveTask({ ...task, category: "Someday", startDate: null, dueAt: null, reminderAt: null, boardState: task.boardState === "done" ? "todo" : task.boardState });
      setImportNotice(`ย้ายไปพักไว้ก่อน: ${task.title}`);
    } catch (error) {
      setImportNotice(actionErrorMessage(error, "ย้ายไปพักไว้ก่อนไม่สำเร็จ"));
    }
  }

  async function handleArchiveDone() {
    try {
      const doneToArchive = doneTasks.filter((task) => !task.archivedAt).slice(0, 12);
      for (const task of doneToArchive) {
        await archiveTask(task, true);
      }
      setImportNotice(doneToArchive.length ? `ย้ายงานที่เสร็จแล้ว ${doneToArchive.length} งานเข้าประวัติ` : "ยังไม่มีงานที่เสร็จแล้วให้เก็บ");
    } catch (error) {
      setImportNotice(actionErrorMessage(error, "เก็บงานที่เสร็จแล้วไม่สำเร็จ"));
    }
  }

  async function handleCreateTemplate(template: (typeof productivityTemplates)[number]) {
    try {
      const createdAt = nowIso();
      await saveTask({
        title: template.title,
        notes: template.description,
        category: template.category,
        priority: template.priority,
        boardState: "todo",
        progress: 0,
        startDate: new Date().toISOString().slice(0, 10),
        repeatRule: { frequency: "none" },
        subtasks: template.subtasks.map((title, index) => ({
          id: uid("subtask"),
          taskId: "",
          title,
          progress: 0,
          position: index,
          completedAt: null,
          deletedAt: null,
          updatedAt: createdAt,
        })),
      });
      setImportNotice(`เพิ่มชุดงานแล้ว: ${template.name}`);
    } catch (error) {
      setImportNotice(actionErrorMessage(error, "เพิ่มชุดงานไม่สำเร็จ"));
    }
  }

  function openSavedView(view: { query: string; label: string }) {
    setPriorityFilter("All");
    setCategoryFilter("All");
    setBoardDueFilter("All");
    setQuery(view.query);
    if (view.query === "due:today") {
      setQuery("");
      setBoardDueFilter("Today");
    }
    if (view.query === "due:overdue") {
      setQuery("");
      setBoardDueFilter("Overdue");
    }
    if (view.query === "due:none") {
      setQuery("");
      setBoardDueFilter("No date");
    }
    router.push("/app/board");
  }

  function savedViewActive(view: { query: string; label: string }) {
    if (view.query === "due:today") return boardDueFilter === "Today";
    if (view.query === "due:overdue") return boardDueFilter === "Overdue";
    if (view.query === "due:none") return boardDueFilter === "No date";
    return query === view.query;
  }

  function resetBoardFilters() {
    setQuery("");
    setPriorityFilter("All");
    setCategoryFilter("All");
    setBoardDueFilter("All");
  }

  function navigateTo(href: string) {
    router.push(href);
  }

  async function signOut() {
    lockPrivateSession();
    router.push("/login");
  }

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      const target = event.target as HTMLElement | null;
      const isTyping = target?.tagName === "INPUT" || target?.tagName === "TEXTAREA" || target?.tagName === "SELECT" || target?.isContentEditable;
      if (isTyping) return;
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setCommandOpen(true);
        return;
      }
      if (event.key.toLowerCase() === "n") {
        event.preventDefault();
        openCreate();
        return;
      }
      if (event.key.toLowerCase() === "b") {
        event.preventDefault();
        router.push("/app/board");
        return;
      }
      if (event.key.toLowerCase() === "f") {
        event.preventDefault();
        router.push("/app/focus");
        return;
      }
      if (event.key.toLowerCase() === "r") {
        event.preventDefault();
        setReviewStage("inbox");
        router.push("/app");
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [router]);

  useEffect(() => {
    if (!importNotice) return;
    const timeout = window.setTimeout(() => setImportNotice(""), 4000);
    return () => window.clearTimeout(timeout);
  }, [importNotice]);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[var(--background)]">
        <Panel className="p-6 text-center">
          <RefreshCcw className="mx-auto mb-3 animate-spin text-[var(--foreground)]" />
          <p className="text-sm font-semibold">กำลังเปิด Lucky List...</p>
        </Panel>
      </div>
    );
  }

  if (!isAuthed) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[var(--background)] p-4">
        <Panel className="max-w-md p-7 text-center">
          <ShieldCheck className="mx-auto mb-4 text-[var(--foreground)]" size={44} />
          <h1 className="text-2xl font-black">Lucky List ถูกล็อกไว้</h1>
          <p className="mt-2 text-sm text-[var(--muted)]">
            ใส่ PIN ของเครื่องนี้เพื่อกลับเข้าใช้งาน Lucky List
          </p>
          <Link href="/login" className="mt-5 inline-flex">
            <Button>ไปหน้า PIN</Button>
          </Link>
        </Panel>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[var(--background)] text-[var(--foreground)]">
      <WorkspaceShell
        activeView={activeView}
        cloudMessage={cloudMessage}
        cloudState={cloudState}
        navItems={navItems}
        onCreate={openCreate}
        onOpenCommand={() => setCommandOpen(true)}
        onRefreshCloud={() => void handleRefreshCloud()}
        onSignOut={signOut}
        onToggleSidebar={() => setSidebarCollapsed((value) => !value)}
        onToggleTheme={() => void handleToggleTheme()}
        onOpenSavedView={openSavedView}
        savedViews={savedViews}
        sidebarCollapsed={sidebarCollapsed}
        userSettings={userSettings}
      >
        {activeView === "dashboard" && renderDashboard()}
        {activeView === "focus" && renderFocus()}
        {activeView === "board" && renderBoard()}
        {activeView === "tasks" && renderTasks()}
        {activeView === "calendar" && renderCalendar()}
        {activeView === "archive" && renderArchive()}
        {activeView === "settings" && renderSettings()}
      </WorkspaceShell>
      {importNotice && (
        <div role="status" aria-live="polite" className="fixed right-3 top-20 z-50 max-w-sm rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-xs font-bold shadow-xl lg:top-auto lg:bottom-5">
          {importNotice}
        </div>
      )}
      {undoAction && (
        <div role="status" aria-live="polite" className="fixed inset-x-3 bottom-20 z-50 mx-auto flex max-w-lg items-center justify-between gap-3 rounded-lg border border-[var(--border)] bg-[var(--surface)] p-3 shadow-xl lg:bottom-5">
          <span className="min-w-0 truncate text-sm font-bold">{undoAction.label}</span>
          <Button
            variant="secondary"
            onClick={async () => {
              const action = undoAction;
              setUndoAction(null);
              try {
                await action.run();
              } catch (error) {
                setImportNotice(actionErrorMessage(error, "ย้อนกลับไม่สำเร็จ"));
              }
            }}
          >
            <RotateCcw size={16} />
            ย้อนกลับ
          </Button>
        </div>
      )}

      {moreOpen && (
        <div className="fixed inset-x-3 bottom-20 z-50 grid gap-2 rounded-lg border border-[var(--border)] bg-[var(--surface)] p-2 lg:hidden">
          {moreMobileNav.map((item) => {
            const Icon = item.icon;
            return (
              <Link
                key={item.view}
                href={item.href}
                onClick={() => setMoreOpen(false)}
                className="flex min-h-11 items-center gap-3 rounded-lg px-3 text-sm font-bold text-[var(--muted)] hover:bg-[var(--surface-strong)] hover:text-[var(--foreground)]"
              >
                <Icon size={18} />
                {item.label}
              </Link>
            );
          })}
        </div>
      )}

      <nav className="fixed inset-x-0 bottom-0 z-40 grid grid-cols-5 border-t border-[var(--border)] bg-[var(--surface)]/95 p-2 backdrop-blur lg:hidden">
        {primaryMobileNav.map((item) => {
          const Icon = item.icon;
          const active = item.view === activeView;
          return (
            <Link key={item.view} href={item.href} onClick={() => setMoreOpen(false)} className={cn("flex min-h-12 flex-col items-center gap-1 rounded-lg py-2 text-[10px] font-bold", active ? "bg-[var(--foreground)] text-[var(--background)]" : "text-[var(--muted)]")}>
              <Icon size={17} />
              {item.label}
            </Link>
          );
        })}
        <button
          onClick={() => setMoreOpen((value) => !value)}
          className={cn(
            "flex min-h-12 flex-col items-center gap-1 rounded-lg py-2 text-[10px] font-bold",
            moreOpen || moreMobileNav.some((item) => item.view === activeView) ? "bg-[var(--foreground)] text-[var(--background)]" : "text-[var(--muted)]",
          )}
        >
          <MoreHorizontal size={17} />
          เพิ่มเติม
        </button>
      </nav>

      <CommandPalette
        open={commandOpen}
        tasks={activeTasks}
        onOpenChange={setCommandOpen}
        onQuickAdd={handleQuickAdd}
        onOpenTask={openEdit}
        onCreateTask={openCreate}
        onNavigate={navigateTo}
        onUpdateCloud={handleRefreshCloud}
        onExportJson={exportJson}
      />

      <TaskModal
        open={modalOpen}
        task={editingTask}
        categories={categories}
        onClose={() => setModalOpen(false)}
        onSave={async (task) => {
          await saveTask(task);
        }}
      />
    </div>
  );

  function renderFocus() {
    const recurringTasks = activeTasks.filter((task) => task.repeatRule.frequency !== "none" && !isDoneTask(task)).sort(taskSort);
    return (
      <>
        <QuickAddBar onQuickAdd={handleQuickAdd} />

        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <StatCard title="เลยกำหนด" value={overdueTasks.length} tone="rose" detail="ควรจัดการก่อน" />
          <StatCard title="วันนี้" value={todayTasks.length} tone="indigo" detail="กำหนดส่ง เริ่ม หรือเตือนวันนี้" />
          <StatCard title="ใกล้กำหนด" value={soonTasks.length} tone="amber" detail={`ภายใน ${userSettings.deadlineThresholdDays} วัน`} />
          <StatCard title="เตือนความจำ" value={reminders.pendingReminders.length} tone="emerald" detail={userSettings.notificationsEnabled ? "เปิดแจ้งเตือนแล้ว" : "ยังปิดแจ้งเตือน"} />
        </section>

        <section className="grid gap-4 xl:grid-cols-[1.35fr_0.8fr]">
          <Panel className="p-3">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="flex items-center gap-2 text-lg font-black">
                  <Target size={19} className="text-[var(--foreground)]" />
                  คิวโฟกัส
                </h2>
                <p className="text-sm text-[var(--muted)]">รวมงานเลยกำหนด งานวันนี้ งานใกล้กำหนด และงานด่วนไว้ในที่เดียว</p>
              </div>
              <Button variant="secondary" onClick={() => setCommandOpen(true)}>
                <Keyboard size={16} />
                คำสั่ง
              </Button>
            </div>
            <div className="grid gap-2 sm:grid-cols-2 2xl:grid-cols-3">
              {focusTasks.map((task) => (
                <TaskCard key={task.id} task={task} onEdit={openEdit} onMove={handleMoveTask} onToggleDone={handleToggleDone} onPlanToday={handlePlanToday} onInbox={handleSendToInbox} onSomeday={handleSendSomeday} onDelete={handleDeleteTask} onClone={handleCloneTask} onArchive={handleArchiveTask} onSubtask={handleUpdateSubtask} />
              ))}
              {!focusTasks.length && <EmptyState title="ยังไม่มีงานที่ต้องโฟกัส" detail="งานด่วนเคลียร์แล้ว เพิ่มงานใหม่หรือกลับไปดูบอร์ดได้" />}
            </div>
          </Panel>

          <div className="grid gap-4">
            <Panel className="p-4">
              <div className="mb-3 flex items-center justify-between">
                <h2 className="flex items-center gap-2 text-lg font-black">
                  <Clock size={19} className="text-[var(--warning)]" />
                  วันนี้
                </h2>
                <span className="text-sm font-black text-[var(--muted)]">{todayTasks.length}</span>
              </div>
              <div className="grid gap-2">
                {todayTasks.slice(0, 5).map((task) => (
                  <TaskMini key={task.id} task={task} onClick={() => openEdit(task)} />
                ))}
                {!todayTasks.length && <EmptyState title="วันนี้ยังไม่มีงาน" detail="ถ้ามีงานสำคัญ ให้เพิ่มเข้าแผนวันนี้" />}
              </div>
            </Panel>

            <Panel className="p-4">
              <div className="mb-3 flex items-center justify-between">
                <h2 className="flex items-center gap-2 text-lg font-black">
                  <Zap size={19} className="text-[var(--success)]" />
                  งานทำซ้ำ
                </h2>
                <span className="text-sm font-black text-[var(--muted)]">{recurringTasks.length}</span>
              </div>
              <div className="grid gap-2">
                {recurringTasks.slice(0, 5).map((task) => (
                  <TaskMini key={task.id} task={task} onClick={() => openEdit(task)} />
                ))}
                {!recurringTasks.length && <EmptyState title="ยังไม่มีงานทำซ้ำ" detail="ตั้งค่าทำซ้ำในงาน แล้วระบบจะสร้างรอบถัดไปหลังทำเสร็จ" />}
              </div>
            </Panel>
          </div>
        </section>
      </>
    );
  }

  function renderDashboard() {
    return (
      <>
        <QuickAddBar onQuickAdd={handleQuickAdd} />
        <section className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_360px]">
          <Panel className="overflow-hidden p-0">
            <div className="border-b border-[var(--border)] p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-xs font-black text-[var(--muted)]">ศูนย์งานวันนี้</p>
                  <h2 className="mt-1 text-2xl font-black md:text-3xl">วันนี้ทำอะไรให้จบก่อน</h2>
                  <p className="mt-1 max-w-2xl text-sm text-[var(--muted)]">เลือกงานหลักให้น้อย ชัด และทำต่อได้ทันที ไม่ต้องเลื่อนหาจากบอร์ดยาวๆ</p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button onClick={() => void handlePlanMyDay()}>
                    <CalendarPlus size={16} />
                    วางแผนวันนี้
                  </Button>
                  <Button variant="secondary" onClick={() => setReviewStage("inbox")}>
                    <MoveRight size={16} />
                    รีวิวงาน
                  </Button>
                </div>
              </div>
            </div>
            <div className="grid gap-3 p-3 lg:grid-cols-[1fr_1fr]">
              <div className="rounded-lg border border-[var(--border)] p-3">
                <div className="mb-3 flex items-center justify-between">
                  <h3 className="text-sm font-black">งานหลักวันนี้</h3>
                  <span className="rounded-md border border-[var(--border)] px-2 py-1 text-xs font-black">{todayTasks.length}</span>
                </div>
                <div className="grid gap-2">
                  {plannedTodayTasks.map((task) => (
                    <CommandTask key={task.id} task={task} onOpen={() => openEdit(task)} onDone={() => void handleToggleDone(task)} />
                  ))}
                  {!plannedTodayTasks.length && <EmptyState title="ยังไม่มีงานหลักวันนี้" detail="กดวางแผนวันนี้ หรือย้ายงานเข้ามาเองได้" />}
                </div>
              </div>
              <div className="rounded-lg border border-[var(--border)] p-3">
                <div className="mb-3 flex items-center justify-between">
                  <h3 className="text-sm font-black">งานที่ควรทำต่อ</h3>
                  <span className="rounded-md border border-[var(--border)] px-2 py-1 text-xs font-black">{nextActions.length}</span>
                </div>
                <div className="grid gap-2">
                  {nextActions.slice(0, 4).map((task) => (
                    <CommandTask key={task.id} task={task} onOpen={() => openEdit(task)} onDone={() => void handleToggleDone(task)} onPlan={() => void handlePlanToday(task)} />
                  ))}
                  {!nextActions.length && <EmptyState title="ไม่มีงานเร่งตอนนี้" detail="กล่องรับงานและกำหนดส่งยังเรียบร้อย" />}
                </div>
              </div>
            </div>
          </Panel>

          <Panel className="p-3">
            <div className="mb-3 flex items-center justify-between">
              <div>
                <h2 className="text-lg font-black">โหมดรีวิว</h2>
                <p className="text-sm text-[var(--muted)]">เก็บรายการรกๆ ทีละขั้น</p>
              </div>
              <span className="rounded-lg border border-[var(--border)] px-2 py-1 text-xs font-black">{currentReviewStage.tasks.length}</span>
            </div>
            <div className="grid grid-cols-5 gap-1">
              {reviewStages.map((stage) => (
                <button
                  key={stage.key}
                  type="button"
                  onClick={() => setReviewStage(stage.key)}
                  className={cn("focus-ring rounded-md border px-1.5 py-2 text-[10px] font-black transition", reviewStage === stage.key ? "border-[var(--foreground)] bg-[var(--foreground)] text-[var(--background)]" : "border-[var(--border)] text-[var(--muted)] hover:text-[var(--foreground)]")}
                  title={stage.detail}
                >
                  {stage.label}
                </button>
              ))}
            </div>
            <div className="mt-3 rounded-lg border border-[var(--border)] p-3">
              <p className="text-xs font-black text-[var(--muted)]">{currentReviewStage.action}</p>
              {currentReviewTask ? (
                <div className="mt-2">
                  <button type="button" onClick={() => openEdit(currentReviewTask)} className="block w-full text-left">
                    <p className="font-black">{currentReviewTask.title}</p>
                    <p className="mt-1 text-xs text-[var(--muted)]">{categoryLabel(currentReviewTask.category)} · {priorityLabel(currentReviewTask.priority)}</p>
                  </button>
                  <div className="mt-3 grid grid-cols-2 gap-1">
                    <button type="button" onClick={() => void handlePlanToday(currentReviewTask)} className="focus-ring rounded-md border border-[var(--border)] px-2 py-2 text-xs font-black hover:bg-[var(--surface-strong)]">วันนี้</button>
                    <button type="button" onClick={() => void handleSendSomeday(currentReviewTask)} className="focus-ring rounded-md border border-[var(--border)] px-2 py-2 text-xs font-black hover:bg-[var(--surface-strong)]">พักไว้</button>
                    <button type="button" onClick={() => void handleToggleDone(currentReviewTask)} className="focus-ring rounded-md border border-[var(--success)] px-2 py-2 text-xs font-black text-[var(--success)] hover:bg-[color-mix(in_oklab,var(--success)_8%,transparent)]">เสร็จ</button>
                    <button type="button" onClick={() => void handleArchiveTask(currentReviewTask, true)} className="focus-ring rounded-md border border-[var(--border)] px-2 py-2 text-xs font-black hover:bg-[var(--surface-strong)]">เก็บ</button>
                  </div>
                </div>
              ) : (
                <EmptyState title="ขั้นตอนนี้เคลียร์แล้ว" detail="ไปขั้นถัดไปได้เลย" />
              )}
            </div>
            <Button variant="secondary" className="mt-3 w-full" onClick={() => void handleArchiveDone()}>
              <Archive size={15} />
              เก็บงานที่เสร็จแล้ว
            </Button>
          </Panel>
        </section>
        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <StatCard title="งานทั้งหมด" value={activeTasks.length} tone="indigo" detail={`${doneTasks.length} งานเสร็จแล้ว`} />
          <StatCard title="กำลังทำ" value={openTasks.length} tone="amber" detail="รอทำ + อยู่ระหว่างทำ" />
          <StatCard title="ใกล้กำหนด" value={soonTasks.length} tone="rose" detail={`ภายใน ${userSettings.deadlineThresholdDays} วัน`} />
          <StatCard title="ความสำเร็จ" value={`${completion}%`} tone="emerald" detail="อิงจากงานที่เปิดอยู่" />
        </section>

        <section className="grid gap-4 xl:grid-cols-[1fr_360px]">
          <Panel className="p-3">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="text-lg font-black">มุมมองลัด</h2>
                <p className="text-sm text-[var(--muted)]">กล่องรับงาน วันนี้ งานพักไว้ และตัวกรองที่ใช้บ่อย จัดให้เบาสำหรับใช้คนเดียว</p>
              </div>
              <Button variant="secondary" onClick={() => setCommandOpen(true)}>
                <Keyboard size={16} />
                คำสั่ง
              </Button>
            </div>
            <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
              {savedViews.map((view) => (
                <SmartViewButton key={view.label} view={view} active={savedViewActive(view)} onClick={() => openSavedView(view)} />
              ))}
            </div>
          </Panel>

          <Panel className="p-3">
            <div className="mb-3 flex items-center justify-between">
              <div>
                <h2 className="text-lg font-black">ชุดงานสำเร็จรูป</h2>
                <p className="text-sm text-[var(--muted)]">เพิ่ม checklist ที่ใช้บ่อยในคลิกเดียว</p>
              </div>
              <CirclePlus size={18} className="text-[var(--muted)]" />
            </div>
            <div className="grid gap-2">
              {productivityTemplates.map((template) => (
                <button key={template.name} onClick={() => void handleCreateTemplate(template)} className="rounded-lg border border-[var(--border)] p-2.5 text-left transition hover:border-[var(--foreground)] hover:bg-[var(--surface-strong)]">
                  <span className="block text-sm font-black">{template.name}</span>
                  <span className="mt-0.5 block text-xs text-[var(--muted)]">{template.description}</span>
                </button>
              ))}
            </div>
          </Panel>
        </section>

        <section className="grid items-start gap-4 xl:grid-cols-[1fr_340px_340px]">
          <Panel className="p-4">
            <div className="mb-4 flex items-center justify-between">
              <div>
                <h2 className="text-lg font-black">ภาพรวมสัปดาห์นี้</h2>
                <p className="text-sm text-[var(--muted)]">งานที่เสร็จและงานที่ยังเปิดอยู่ในเครื่อง</p>
              </div>
              <span className="rounded-lg border border-[var(--success)] bg-[color-mix(in_oklab,var(--success)_8%,transparent)] px-3 py-1 text-xs font-black text-[var(--success)]">
                ออนไลน์เป็นหลัก
              </span>
            </div>
            <div className="h-56">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartData}>
                  <defs>
                    <linearGradient id="doneGrad" x1="0" x2="0" y1="0" y2="1">
                      <stop offset="5%" stopColor="#10b981" stopOpacity={0.45} />
                      <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="activeGrad" x1="0" x2="0" y1="0" y2="1">
                      <stop offset="5%" stopColor="#6366f1" stopOpacity={0.45} />
                      <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.2)" />
                  <XAxis dataKey="day" stroke="var(--muted)" fontSize={12} />
                  <Tooltip contentStyle={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 8 }} />
                  <Area type="monotone" dataKey="active" stroke="#6366f1" fill="url(#activeGrad)" strokeWidth={2} />
                  <Area type="monotone" dataKey="done" stroke="#10b981" fill="url(#doneGrad)" strokeWidth={2} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </Panel>

          <Panel className="p-4">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-lg font-black">รีวิวประจำสัปดาห์</h2>
              <span className="rounded-lg border border-[var(--border)] px-2 py-1 text-xs font-black">{reviewTasks.length}</span>
            </div>
            <div className="grid max-h-[356px] gap-2 overflow-y-auto pr-1">
              {reviewTasks.slice(0, 8).map((task) => (
                <ReviewTask key={task.id} task={task} onOpen={() => openEdit(task)} onPlan={() => void handlePlanToday(task)} onSomeday={() => void handleSendSomeday(task)} />
              ))}
              {!reviewTasks.length && <EmptyState title="รีวิวเคลียร์แล้ว" detail="ไม่มีงานเลยกำหนด งานค้างนาน งานไร้วัน หรือรายการพักไว้ที่ต้องจัดการ" />}
            </div>
          </Panel>

          <Panel className="p-4">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-lg font-black">งานใกล้กำหนด</h2>
              <Bell className="text-[var(--danger)]" size={19} />
            </div>
            <div className="grid max-h-[356px] gap-2 overflow-y-auto pr-1">
              {soonTasks.map((task) => (
                <TaskMini key={task.id} task={task} onClick={() => openEdit(task)} />
              ))}
              {!soonTasks.length && <EmptyState title="ยังไม่มีงานใกล้กำหนด" detail="งานที่มีวันกำหนดส่งจะมาแสดงที่นี่" />}
            </div>
          </Panel>
        </section>

        {renderBoard()}
      </>
    );
  }

  function renderBoard() {
    const hasBoardFilters = Boolean(query.trim()) || priorityFilter !== "All" || categoryFilter !== "All" || boardDueFilter !== "All";
    const boardStats = {
      todo: filteredBoardTasks.filter((task) => task.boardState === "todo").length,
      wip: filteredBoardTasks.filter((task) => task.boardState === "wip").length,
      done: filteredBoardTasks.filter((task) => task.boardState === "done").length,
    };
    return (
      <>
        <Panel className="grid grid-cols-2 gap-2 p-3 md:grid-cols-3 lg:grid-cols-6">
          <BoardMetric label="งานทั้งหมด" value={activeTasks.length} detail={`แสดง ${filteredBoardTasks.length}`} />
          <BoardMetric label="รอทำ" value={boardStats.todo} detail="รอคิว" />
          <BoardMetric label="กำลังทำ" value={boardStats.wip} detail="อยู่ระหว่างทำ" tone="strong" />
          <BoardMetric label="เสร็จแล้ว" value={boardStats.done} detail={`${completion}% สำเร็จ`} tone="success" />
          <BoardMetric label="เลยกำหนด" value={overdueTasks.length} detail="ควรรีวิว" tone="danger" />
          <BoardMetric label="วันนี้" value={todayTasks.length} detail="ส่ง / เริ่ม / เตือน" tone="warning" />
        </Panel>

        <Panel className="grid gap-2 p-2 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-6">
          {savedViews.map((view) => (
            <SmartViewButton key={view.label} view={view} active={savedViewActive(view)} compact onClick={() => openSavedView(view)} />
          ))}
        </Panel>

        <Panel className="grid gap-3 p-3 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-[minmax(220px,1fr)_150px_160px_140px_auto_auto]">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--muted)]" size={16} />
            <input
              className="focus-ring min-h-10 w-full rounded-lg border border-[var(--border)] bg-transparent py-2 pl-9 pr-3 text-sm"
              placeholder="ค้นหาบอร์ด, #หมวดหมู่, priority:urgent..."
              value={query}
              onChange={(event) => setQuery(event.target.value)}
            />
          </div>
          <select className="focus-ring min-h-10 rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 text-sm font-semibold" value={priorityFilter} onChange={(event) => setPriorityFilter(event.target.value as "All" | TaskPriority)}>
            <option value="All">ทุกความสำคัญ</option>
            {priorities.map((priority) => (
              <option key={priority} value={priority}>{priorityLabel(priority)}</option>
            ))}
          </select>
          <select className="focus-ring min-h-10 rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 text-sm font-semibold" value={categoryFilter} onChange={(event) => setCategoryFilter(event.target.value)}>
            <option value="All">ทุกหมวดหมู่</option>
            {categories.map((category) => (
              <option key={category} value={category}>{categoryLabel(category)}</option>
            ))}
          </select>
          <select className="focus-ring min-h-10 rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 text-sm font-semibold" value={boardDueFilter} onChange={(event) => setBoardDueFilter(event.target.value as BoardDueFilter)}>
            {boardDueFilters.map((filter) => (
              <option key={filter} value={filter}>{boardDueFilterLabels[filter]}</option>
            ))}
          </select>
          <div className="flex min-h-10 rounded-lg border border-[var(--border)] bg-[var(--surface-strong)] p-1">
            {(["compact", "comfort"] as const).map((density) => (
              <button
                key={density}
                type="button"
                onClick={() => setBoardDensity(density)}
                className={cn(
                  "focus-ring rounded-md px-2.5 text-xs font-black transition",
                  boardDensity === density ? "bg-[var(--foreground)] text-[var(--background)]" : "text-[var(--muted)] hover:text-[var(--foreground)]",
                )}
              >
                {densityLabels[density]}
              </button>
            ))}
          </div>
          <div className="flex gap-2">
            <Button variant="secondary" className="px-3" onClick={resetBoardFilters} title="ล้างตัวกรองบอร์ด">
              <RefreshCcw size={15} />
            </Button>
            <Button variant="secondary" className="hidden px-3 xl:inline-flex" onClick={() => setInspectorOpen((value) => !value)} title="เปิด/ปิดภาพรวม">
              <SlidersHorizontal size={15} />
              ภาพรวม
            </Button>
            <Button variant="secondary" className="px-3" onClick={handleAddDemoTasks} title="เพิ่มงานตัวอย่าง 50 งาน">
              <Zap size={15} />
              ตัวอย่าง 50
            </Button>
          </div>
        </Panel>

        <section className={cn("grid gap-3", inspectorOpen ? "xl:grid-cols-[minmax(0,1fr)_320px]" : "xl:grid-cols-1")}>
          <div className="grid gap-3 xl:h-[calc(100vh-300px)] xl:min-h-[460px] xl:grid-cols-3">
        {boardStates.map((state) => {
          const items = filteredBoardTasks.filter((task) => task.boardState === state);
          return (
            <Panel key={state} className="flex min-h-[260px] flex-col p-3 xl:min-h-0">
              <div className="mb-3 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className={cn("rounded-lg border px-2 py-1 text-xs font-black", boardClass(state))}>{boardLabel(state)}</span>
                  <span className="text-xs font-bold text-[var(--muted)]">{items.length} งาน</span>
                </div>
                <MoreHorizontal size={17} className="text-[var(--muted)]" />
              </div>
              <div className="grid grid-cols-1 gap-2 xl:min-h-0 xl:flex-1 xl:overflow-y-auto xl:pr-1">
                {items.map((task) => (
                  <TaskCard key={task.id} task={task} density={boardDensity} onEdit={openEdit} onMove={handleMoveTask} onToggleDone={handleToggleDone} onPlanToday={handlePlanToday} onInbox={handleSendToInbox} onSomeday={handleSendSomeday} onDelete={handleDeleteTask} onClone={handleCloneTask} onArchive={handleArchiveTask} onSubtask={handleUpdateSubtask} />
                ))}
                {!items.length && <BoardEmptyState state={state} filtered={hasBoardFilters} onCreate={openCreate} />}
              </div>
            </Panel>
          );
            })}
          </div>

          <aside className={cn("hidden content-start gap-3 xl:max-h-[calc(100vh-300px)] xl:overflow-y-auto xl:pr-1", inspectorOpen && "xl:grid")}>
            <Panel className="p-3">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-black text-[var(--muted)]">ภาพรวม</h2>
                <span className="rounded-lg border border-[var(--border)] px-2 py-1 text-xs font-black">{filteredBoardTasks.length}</span>
              </div>
              <div className="mt-3 grid gap-2">
                <SettingLine label="ความสำเร็จ" value={`${completion}%`} />
                <SettingLine label="งานที่ยังเปิด" value={`${openTasks.length}`} />
                <SettingLine label="งานสำคัญ" value={`${activeTasks.filter((task) => task.priority === "High" || task.priority === "Urgent").length}`} />
              </div>
            </Panel>

            <Panel className="p-3">
              <div className="mb-3 flex items-center justify-between">
                <h2 className="text-sm font-black">วันนี้</h2>
                <span className="text-xs font-black text-[var(--muted)]">{todayTasks.length}</span>
              </div>
              <div className="grid gap-2">
                {todayTasks.slice(0, 4).map((task) => (
                  <TaskMini key={task.id} task={task} onClick={() => openEdit(task)} />
                ))}
                {!todayTasks.length && <EmptyState title="วันนี้ยังไม่มีงาน" detail="ไม่มีงานกำหนดส่ง เริ่ม หรือเตือนวันนี้" />}
              </div>
            </Panel>

            <Panel className="p-3">
              <div className="mb-3 flex items-center justify-between">
                <h2 className="text-sm font-black">ใกล้กำหนด</h2>
                <span className="text-xs font-black text-[var(--muted)]">{soonTasks.length}</span>
              </div>
              <div className="grid gap-2">
                {soonTasks.slice(0, 4).map((task) => (
                  <TaskMini key={task.id} task={task} onClick={() => openEdit(task)} />
                ))}
                {!soonTasks.length && <EmptyState title="ไม่มีงานใกล้กำหนด" detail="กำหนดส่งยังเรียบร้อย" />}
              </div>
            </Panel>

            <Panel className="p-3">
              <div className="mb-3 flex items-center justify-between">
                <h2 className="text-sm font-black">อัปเดตล่าสุด</h2>
                <span className="text-xs font-black text-[var(--muted)]">{recentTasks.length}</span>
              </div>
              <div className="grid gap-1">
                {recentTasks.slice(0, 6).map((task) => (
                  <button key={task.id} onClick={() => openEdit(task)} className="grid grid-cols-[1fr_auto] gap-2 rounded-lg px-2 py-1.5 text-left text-xs transition hover:bg-[var(--surface-strong)]">
                    <span className="truncate font-bold">{task.title}</span>
                    <span className={cn("rounded-md border px-1.5 py-0.5 font-black", boardClass(task.boardState))}>{boardLabel(task.boardState)}</span>
                    <span className="truncate text-[var(--muted)]">{formatThaiDate(task.updatedAt)}</span>
                  </button>
                ))}
              </div>
            </Panel>
          </aside>
        </section>
      </>
    );
  }

  function renderTasks() {
    return (
      <>
        <Panel className="grid gap-3 p-3 md:grid-cols-[1fr_180px_180px]">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--muted)]" size={17} />
            <input className="focus-ring w-full rounded-lg border border-[var(--border)] bg-transparent py-2 pl-10 pr-3 text-sm" placeholder="ค้นหา, #หมวดหมู่, priority:urgent, status:wip, due:today..." value={query} onChange={(event) => setQuery(event.target.value)} />
          </div>
          <select className="focus-ring rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm font-semibold" value={priorityFilter} onChange={(event) => setPriorityFilter(event.target.value as "All" | TaskPriority)}>
            <option value="All">ทุกความสำคัญ</option>
            {priorities.map((priority) => (
              <option key={priority} value={priority}>{priorityLabel(priority)}</option>
            ))}
          </select>
          <select className="focus-ring rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm font-semibold" value={categoryFilter} onChange={(event) => setCategoryFilter(event.target.value)}>
            <option value="All">ทุกหมวดหมู่</option>
            {categories.map((category) => (
              <option key={category} value={category}>{categoryLabel(category)}</option>
            ))}
          </select>
        </Panel>
        <Panel className="overflow-hidden">
          <div className="hidden grid-cols-[1.4fr_120px_120px_120px_120px] border-b border-[var(--border)] px-3 py-2.5 text-xs font-black text-[var(--muted)] md:grid">
            <span>งาน</span>
            <span>ความสำคัญ</span>
            <span>สถานะ</span>
            <span>กำหนดส่ง</span>
            <span className="text-right">จัดการ</span>
          </div>
          <div className="divide-y divide-[var(--border)]">
            {filteredTasks.map((task) => (
              <TaskRow key={task.id} task={task} onEdit={openEdit} onMove={handleMoveTask} onToggleDone={handleToggleDone} onDelete={handleDeleteTask} onClone={handleCloneTask} onArchive={handleArchiveTask} />
            ))}
            {!filteredTasks.length && <EmptyState title="ไม่พบงาน" detail="ลองล้างตัวกรองหรือสร้างงานใหม่" />}
          </div>
        </Panel>
      </>
    );
  }

  function renderCalendar() {
    const dated = activeTasks.filter((task) => task.dueAt).sort(taskSort);
    return (
      <section className="grid gap-4 xl:grid-cols-[1fr_340px]">
        <Panel className="p-4">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-lg font-black">Timeline งาน</h2>
            <SlidersHorizontal className="text-[var(--muted)]" size={18} />
          </div>
          <div className="grid gap-2">
            {dated.map((task) => (
              <button key={task.id} onClick={() => openEdit(task)} className="grid gap-2 rounded-lg border border-[var(--border)] p-3 text-left transition hover:bg-[var(--surface-strong)] md:grid-cols-[130px_1fr_90px]">
                <span className="text-sm font-black text-[var(--foreground)]">{formatThaiDate(task.dueAt)}</span>
                <span>
                  <span className="block font-bold">{task.title}</span>
                  <span className="text-xs text-[var(--muted)]">{repeatLabel(task.repeatRule)}</span>
                </span>
                <span className={cn("rounded-lg border px-2 py-1 text-center text-xs font-black", priorityClass(task.priority))}>{priorityLabel(task.priority)}</span>
              </button>
            ))}
          </div>
        </Panel>
        <Panel className="p-4">
          <h2 className="mb-4 text-lg font-black">เลยกำหนด</h2>
          <div className="grid gap-2">
            {overdueTasks.map((task) => (
              <TaskMini key={task.id} task={task} onClick={() => openEdit(task)} />
            ))}
            {!overdueTasks.length && <EmptyState title="ไม่มีงานเลยกำหนด" detail="สถานะดีมากในตอนนี้" />}
          </div>
        </Panel>
      </section>
    );
  }

  function renderArchive() {
    return (
      <Panel className="overflow-hidden">
        <div className="flex items-center justify-between border-b border-[var(--border)] p-3">
          <div>
            <h2 className="text-lg font-black">ประวัติงาน</h2>
            <p className="text-sm text-[var(--muted)]">งานที่เก็บเข้าประวัติแล้วสามารถกู้กลับมาได้</p>
          </div>
          <span className="text-sm font-black text-[var(--muted)]">{archivedTasks.length} รายการ</span>
        </div>
        <div className="divide-y divide-[var(--border)]">
          {archivedTasks.map((task) => (
            <div key={task.id} className="flex flex-col gap-3 p-3 md:flex-row md:items-center md:justify-between">
              <div>
                <h3 className="font-black">{task.title}</h3>
                <p className="text-sm text-[var(--muted)]">เก็บเมื่อ: {formatThaiDate(task.archivedAt)}</p>
              </div>
              <div className="flex gap-2">
                <Button variant="secondary" onClick={() => void handleArchiveTask(task, false)}>
                  <RotateCcw size={16} />
                  กู้คืน
                </Button>
                <Button variant="danger" onClick={() => handleDeleteTask(task)}>
                  <Trash2 size={16} />
                </Button>
              </div>
            </div>
          ))}
          {!archivedTasks.length && <EmptyState title="ยังไม่มีประวัติงาน" detail="เก็บงานที่จบแล้วไว้ดูย้อนหลังได้ที่นี่" />}
        </div>
      </Panel>
    );
  }

  function renderSettings() {
    return (
      <section className="grid gap-4 xl:grid-cols-2">
        <Panel className="p-4">
          <h2 className="text-lg font-black">ระบบและข้อมูล</h2>
          <div className="mt-3 grid gap-2">
            <SettingLine label="โหมดเข้าใช้งาน" value="PIN ส่วนตัว" />
            <SettingLine label="ที่เก็บข้อมูล" value={cloudConnected ? "เชื่อมต่อ Supabase แล้ว" : hasSupabaseEnv() ? "Supabase ยังไม่พร้อม" : "ทดลองในเครื่อง"} />
            <SettingLine label="สถานะข้อมูล" value={cloudMessage} />
            <SettingLine label="ข้อมูลเก่า" value="ใช้เพื่อย้ายข้อมูลและสำรองเท่านั้น" />
            <SettingLine label="สำรองล่าสุด" value={lastBackupAt ? formatThaiDate(lastBackupAt) : "ยังไม่มี"} />
            <SettingLine label="แจ้งเตือน" value={notificationPermissionLabel(reminders.permission)} />
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            <Button onClick={() => void handleRefreshCloud()}>
              <RefreshCcw size={16} />
              อัปเดตข้อมูล
            </Button>
            <Button variant="secondary" onClick={() => void handleBackupNow()}>
              <Download size={16} />
              สำรองตอนนี้
            </Button>
            <Button variant="secondary" onClick={() => void handleExportLatestBackup()}>
              <FileJson size={16} />
              ไฟล์สำรองล่าสุด
            </Button>
            <Button variant="secondary" onClick={exportCsv}>
              <Download size={16} />
              ส่งออก CSV
            </Button>
            <Button variant="secondary" onClick={() => fileRef.current?.click()}>
              <Upload size={16} />
              นำเข้า JSON/HTML
            </Button>
            <input
              ref={fileRef}
              type="file"
              className="hidden"
              accept=".json,.html,application/json,text/html"
              onChange={(event) => {
                const file = event.target.files?.[0];
                if (file) void handleImportFile(file);
                event.currentTarget.value = "";
              }}
            />
          </div>
          {importNotice && <p className="mt-4 rounded-lg bg-[var(--surface-strong)] px-3 py-2 text-xs font-semibold text-[var(--muted)]">{importNotice}</p>}
        </Panel>
        <Panel className="p-4">
          <h2 className="text-lg font-black">การตั้งค่า</h2>
          <div className="mt-3 grid gap-3">
            <label className="grid gap-1 text-sm font-bold">
              แจ้งเตือนงานใกล้กำหนดภายในกี่วัน
              <input type="number" min={1} max={31} value={userSettings.deadlineThresholdDays} onChange={(event) => void handleSaveSettingsPatch({ deadlineThresholdDays: Number(event.target.value) || 3 })} className="focus-ring rounded-lg border border-[var(--border)] bg-transparent px-3 py-2" />
            </label>
            <label className="flex items-center justify-between gap-4 rounded-lg border border-[var(--border)] p-3 text-sm font-bold">
              <span>
                <span className="block">แจ้งเตือนงาน</span>
                <span className="text-xs font-semibold text-[var(--muted)]">สิทธิ์เบราว์เซอร์: {notificationPermissionLabel(reminders.permission)}</span>
              </span>
              <input
                type="checkbox"
                checked={userSettings.notificationsEnabled}
                onChange={async (event) => {
                  const enabled = event.target.checked;
                  if (enabled && reminders.permission !== "granted") {
                    const result = await reminders.requestPermission();
                    if (result !== "granted") {
                      setImportNotice("เบราว์เซอร์ยังไม่อนุญาตให้แจ้งเตือน");
                      await handleSaveSettingsPatch({ notificationsEnabled: false });
                      return;
                    }
                  }
                  await handleSaveSettingsPatch({ notificationsEnabled: enabled });
                }}
                className="h-5 w-5 accent-black dark:accent-white"
              />
            </label>
            <label className="grid gap-1 text-sm font-bold">
              สำรองอัตโนมัติทุกกี่นาที
              <input type="number" min={0} max={1440} value={userSettings.autoBackupMinutes} onChange={(event) => void handleSaveSettingsPatch({ autoBackupMinutes: Number(event.target.value) || 0 })} className="focus-ring rounded-lg border border-[var(--border)] bg-transparent px-3 py-2" />
              <span className="text-xs font-semibold text-[var(--muted)]">ใส่ 0 เพื่อปิดการสำรองไฟล์ในเครื่อง</span>
            </label>
            <label className="grid gap-1 text-sm font-bold">
              ธีม
              <select value={userSettings.theme} onChange={(event) => void handleSaveSettingsPatch({ theme: event.target.value as typeof userSettings.theme })} className="focus-ring rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2">
                <option value="dark">มืด</option>
                <option value="light">สว่าง</option>
                <option value="system">ตามระบบ</option>
              </select>
            </label>
            <label className="grid gap-1 text-sm font-bold">
              หมวดหมู่
              <input value={userSettings.categories.map(categoryLabel).join(", ")} onChange={(event) => void handleSaveSettingsPatch({ categories: event.target.value.split(",").map((item) => item.trim()).filter(Boolean) })} className="focus-ring rounded-lg border border-[var(--border)] bg-transparent px-3 py-2" />
            </label>
          </div>
        </Panel>
      </section>
    );
  }
}

function StatCard({ title, value, detail, tone }: { title: string; value: number | string; detail: string; tone: "indigo" | "amber" | "rose" | "emerald" }) {
  const tones = {
    indigo: "text-[var(--foreground)] border-[var(--border)] bg-[var(--surface-strong)]",
    amber: "text-[var(--warning)] border-[var(--warning)] bg-[color-mix(in_oklab,var(--warning)_8%,transparent)]",
    rose: "text-[var(--danger)] border-[var(--danger)] bg-[color-mix(in_oklab,var(--danger)_8%,transparent)]",
    emerald: "text-[var(--success)] border-[var(--success)] bg-[color-mix(in_oklab,var(--success)_8%,transparent)]",
  };
  return (
    <Panel className="p-3">
      <div className="flex items-center justify-between">
        <span className={cn("rounded-lg border px-2 py-1 text-[11px] font-black", tones[tone])}>{title}</span>
        <CheckCircle2 size={18} className="text-[var(--muted)]" />
      </div>
      <p className="mt-3 text-3xl font-black">{value}</p>
      <p className="mt-1 text-sm text-[var(--muted)]">{detail}</p>
    </Panel>
  );
}

function EmptyState({ title, detail }: { title: string; detail: string }) {
  return (
    <div className="rounded-lg border border-dashed border-[var(--border)] p-4 text-center">
      <p className="font-black">{title}</p>
      <p className="mt-1 text-sm text-[var(--muted)]">{detail}</p>
    </div>
  );
}

function BoardMetric({ label, value, detail, tone = "neutral" }: { label: string; value: number | string; detail: string; tone?: "neutral" | "strong" | "success" | "warning" | "danger" }) {
  const tones = {
    neutral: "border-[var(--border)] text-[var(--muted)]",
    strong: "border-[var(--foreground)] text-[var(--foreground)]",
    success: "border-[var(--success)] text-[var(--success)]",
    warning: "border-[var(--warning)] text-[var(--warning)]",
    danger: "border-[var(--danger)] text-[var(--danger)]",
  };
  return (
    <div className="rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2">
      <div className="flex items-center justify-between gap-2">
        <span className="text-[11px] font-black text-[var(--muted)]">{label}</span>
        <span className={cn("max-w-[92px] truncate rounded-md border px-1.5 py-0.5 text-[10px] font-black", tones[tone])}>{detail}</span>
      </div>
      <p className="mt-2 text-2xl font-black leading-none">{value}</p>
    </div>
  );
}

function BoardEmptyState({ state, filtered, onCreate }: { state: BoardState; filtered: boolean; onCreate: () => void }) {
  return (
    <div className="rounded-lg border border-dashed border-[var(--border)] p-3 text-center">
      <p className="text-sm font-black">{filtered ? "ไม่พบงาน" : `${boardLabel(state)}ว่างอยู่`}</p>
      <p className="mt-1 text-xs text-[var(--muted)]">{filtered ? "ลองล้างตัวกรองเพื่อดูงานเพิ่ม" : "สร้างงานใหม่ หรือย้ายงานเข้าช่องนี้"}</p>
      <Button variant="secondary" className="mt-3 min-h-9 px-3 py-1 text-xs" onClick={onCreate}>
        <CirclePlus size={14} />
        เพิ่มงาน
      </Button>
    </div>
  );
}

function SmartViewButton({
  view,
  active,
  compact = false,
  onClick,
}: {
  view: { label: string; detail: string; count: number; icon: ComponentType<{ size?: number; className?: string }> };
  active: boolean;
  compact?: boolean;
  onClick: () => void;
}) {
  const Icon = view.icon;
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "focus-ring grid grid-cols-[auto_1fr_auto] items-center gap-2 rounded-lg border p-2 text-left transition",
        active ? "border-[var(--foreground)] bg-[var(--foreground)] text-[var(--background)]" : "border-[var(--border)] bg-[var(--surface)] hover:border-[var(--foreground)] hover:bg-[var(--surface-strong)]",
      )}
    >
      <span className={cn("flex items-center justify-center rounded-md", compact ? "h-7 w-7" : "h-8 w-8", active ? "bg-white/15" : "bg-[var(--surface-strong)]")}>
        <Icon size={compact ? 14 : 16} />
      </span>
      <span className="min-w-0">
        <span className={cn("block truncate font-black", compact ? "text-xs" : "text-sm")}>{view.label}</span>
        <span className={cn("block truncate text-[11px]", active ? "text-white/70 dark:text-black/70" : "text-[var(--muted)]")}>{view.detail}</span>
      </span>
      <span className={cn("rounded-md border px-1.5 py-0.5 text-xs font-black", active ? "border-white/20 dark:border-black/20" : "border-[var(--border)]")}>{view.count}</span>
    </button>
  );
}

function ReviewTask({ task, onOpen, onPlan, onSomeday }: { task: Task; onOpen: () => void; onPlan: () => void; onSomeday: () => void }) {
  const reason = isOverdue(task) ? "เลยกำหนด" : task.boardState === "wip" ? "ค้างนาน" : !task.dueAt && !task.startDate ? "ยังไม่กำหนดวัน" : task.category === "Someday" ? "พักไว้" : "รีวิว";
  return (
    <div className="rounded-lg border border-[var(--border)] p-2.5">
      <button type="button" onClick={onOpen} className="block w-full text-left">
        <div className="flex items-start justify-between gap-2">
          <span className="min-w-0 truncate text-sm font-black">{task.title}</span>
          <span className="shrink-0 rounded-md border border-[var(--border)] px-1.5 py-0.5 text-[10px] font-black text-[var(--muted)]">{reason}</span>
        </div>
        <p className="mt-1 truncate text-xs text-[var(--muted)]">{categoryLabel(task.category)} · {priorityLabel(task.priority)}</p>
      </button>
      <div className="mt-2 flex gap-1">
        <button type="button" onClick={onPlan} className="focus-ring flex h-7 flex-1 items-center justify-center gap-1 rounded-md border border-[var(--border)] text-xs font-black transition hover:bg-[var(--surface-strong)]">
          <CalendarPlus size={13} />
          วันนี้
        </button>
        <button type="button" onClick={onSomeday} className="focus-ring flex h-7 flex-1 items-center justify-center gap-1 rounded-md border border-[var(--border)] text-xs font-black transition hover:bg-[var(--surface-strong)]">
          <Bookmark size={13} />
          พักไว้
        </button>
      </div>
    </div>
  );
}

function CommandTask({ task, onOpen, onDone, onPlan }: { task: Task; onOpen: () => void; onDone: () => void; onPlan?: () => void }) {
  const days = daysUntil(task.dueAt);
  return (
    <div className="grid grid-cols-[auto_1fr_auto] items-center gap-2 rounded-lg border border-[var(--border)] p-2 transition hover:bg-[var(--surface-strong)]">
      <TaskCheckButton checked={isDoneTask(task)} onClick={onDone} />
      <button type="button" onClick={onOpen} className="min-w-0 text-left">
        <p className="truncate text-sm font-black">{task.title}</p>
        <p className="mt-0.5 truncate text-xs text-[var(--muted)]">
          {categoryLabel(task.category)} · {relativeDueLabel(days)}
        </p>
      </button>
      {onPlan ? (
        <button type="button" onClick={onPlan} className="focus-ring flex h-9 min-w-9 items-center justify-center rounded-md border border-[var(--border)] text-[var(--muted)] transition hover:text-[var(--foreground)]" aria-label="วางแผนวันนี้" title="วางแผนวันนี้">
          <CalendarPlus size={14} />
        </button>
      ) : (
        <span className={cn("rounded-md border px-1.5 py-0.5 text-[10px] font-black", priorityClass(task.priority))}>{priorityLabel(task.priority)}</span>
      )}
    </div>
  );
}

function TaskMini({ task, onClick }: { task: Task; onClick: () => void }) {
  const days = daysUntil(task.dueAt);
  return (
    <button onClick={onClick} className="rounded-lg border border-[var(--border)] p-2.5 text-left transition hover:bg-[var(--surface-strong)]">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-bold">{task.title}</p>
          <p className="text-xs text-[var(--muted)]">{categoryLabel(task.category)}</p>
        </div>
        <span className={cn("rounded-md border px-2 py-0.5 text-[10px] font-black", priorityClass(task.priority))}>{priorityLabel(task.priority)}</span>
      </div>
      <div className="mt-2 flex items-center justify-between text-xs font-bold">
        <span className={days !== null && days < 0 ? "text-[var(--danger)]" : "text-[var(--warning)]"}>
          {relativeDueLabel(days, "ไม่กำหนด")}
        </span>
        <span>{task.progress}%</span>
      </div>
    </button>
  );
}

function TaskCheckButton({ checked, onClick }: { checked: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "focus-ring flex h-5 w-5 items-center justify-center rounded-full border transition",
        checked ? "border-[var(--success)] bg-[var(--success)] text-white" : "border-[var(--border)] bg-[var(--surface)] text-transparent hover:border-[var(--foreground)] hover:text-[var(--foreground)]",
      )}
      aria-label={checked ? "ทำเครื่องหมายว่ายังไม่เสร็จ" : "ทำเครื่องหมายว่าเสร็จแล้ว"}
      title={checked ? "ยังไม่เสร็จ" : "เสร็จแล้ว"}
    >
      <Check size={12} strokeWidth={3} />
    </button>
  );
}

function TaskCard({
  task,
  density = "compact",
  onEdit,
  onMove,
  onToggleDone,
  onPlanToday,
  onInbox,
  onSomeday,
  onDelete,
  onClone,
  onArchive,
  onSubtask,
}: {
  task: Task;
  density?: BoardDensity;
  onEdit: (task: Task) => void;
  onMove: (task: Task, state: BoardState) => void;
  onToggleDone: (task: Task) => void;
  onPlanToday: (task: Task) => void;
  onInbox: (task: Task) => void;
  onSomeday: (task: Task) => void;
  onDelete: (task: Task) => void;
  onClone: (task: Task) => void;
  onArchive: (task: Task, archived: boolean) => void;
  onSubtask: (task: Task, subtaskId: string, progress: number) => void;
}) {
  const compact = density === "compact";
  const visibleSubtasks = compact ? 2 : 3;
  const [actionsOpen, setActionsOpen] = useState(false);
  const dueDays = daysUntil(task.dueAt);
  const dueLabel = relativeDueLabel(dueDays);
  const completedSubtasks = task.subtasks.filter((subtask) => subtask.progress >= 100 && !subtask.deletedAt).length;
  const subtaskSummary = task.subtasks.length ? `งานย่อย ${completedSubtasks}/${task.subtasks.length}` : "ไม่มีงานย่อย";
  const done = isDoneTask(task);
  return (
    <div className={cn("scan-card group relative rounded-lg border border-[var(--border)] bg-[var(--surface)] transition hover:border-[var(--foreground)] hover:bg-[var(--surface-strong)]", done && "opacity-70", compact ? "p-2.5" : "p-3")}>
      <div className="absolute left-2.5 top-2.5">
        <TaskCheckButton checked={done} onClick={() => onToggleDone(task)} />
      </div>
      <button onClick={() => onEdit(task)} className="focus-ring block w-full rounded-md pl-7 text-left">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <h3 className={cn("truncate font-black leading-tight", done && "line-through decoration-2", compact ? "text-sm" : "text-[15px]")}>{task.title}</h3>
            <p className={cn("mt-0.5 text-[11px] text-[var(--muted)]", compact ? "line-clamp-1" : "line-clamp-2")}>{task.notes || "ไม่มีรายละเอียด"}</p>
          </div>
          <span className={cn("shrink-0 rounded-md border px-1.5 py-0.5 text-[9px] font-black", priorityClass(task.priority))}>{priorityLabel(task.priority)}</span>
        </div>
      </button>
      <div className="mt-2 flex items-center justify-between gap-2 text-[11px] font-bold text-[var(--muted)]">
        <span className={cn("shrink-0", dueDays !== null && dueDays < 0 ? "text-[var(--danger)]" : dueDays === 0 ? "text-[var(--warning)]" : "")}>{dueLabel}</span>
        <span className="truncate">{subtaskSummary}</span>
      </div>
      <div className="mt-2">
        <div className="mb-1 flex justify-between text-[11px] font-bold text-[var(--muted)]">
          <span>{categoryLabel(task.category)}</span>
          <span>{task.progress}%</span>
        </div>
        <div className="h-1.5 overflow-hidden rounded-full bg-[var(--surface-strong)]">
          <div className="h-full rounded-full bg-[var(--foreground)]" style={{ width: `${task.progress}%` }} />
        </div>
      </div>
      {task.subtasks.length > 0 && (
        <div className={cn("mt-2 grid gap-1", compact && "hidden")}>
          {task.subtasks.slice(0, visibleSubtasks).map((subtask) => (
            <button key={subtask.id} type="button" onClick={() => onSubtask(task, subtask.id, subtask.progress >= 100 ? 0 : 100)} className="focus-ring flex items-center gap-2 rounded-md px-1 py-0.5 text-left text-[11px] font-semibold text-[var(--muted)] transition hover:bg-[var(--surface-strong)] hover:text-[var(--foreground)]">
              <span className={cn("flex h-4 w-4 shrink-0 items-center justify-center rounded-full border", subtask.progress >= 100 ? "border-[var(--success)] bg-[var(--success)] text-white" : "border-[var(--border)] text-transparent")}>
                <Check size={10} strokeWidth={3} />
              </span>
              <span className={cn("truncate", subtask.progress >= 100 && "line-through")}>{subtask.title}</span>
            </button>
          ))}
          {task.subtasks.length > visibleSubtasks && <p className="text-[11px] font-bold text-[var(--muted)]">+{task.subtasks.length - visibleSubtasks} งานย่อย</p>}
        </div>
      )}
      <div className="mt-2 flex items-center justify-end">
        <button
          type="button"
          onClick={() => setActionsOpen((value) => !value)}
          className="focus-ring flex h-7 w-7 items-center justify-center rounded-md bg-[var(--surface-strong)] text-[var(--muted)] transition hover:text-[var(--foreground)]"
          aria-label="เมนูจัดการงาน"
          title="เมนูจัดการงาน"
        >
          <MoreHorizontal size={14} />
        </button>
      </div>
      <div className={cn("scan-card-actions mt-2 flex-wrap items-center gap-1 border-t border-[var(--border)] pt-2", actionsOpen ? "flex" : "hidden md:group-hover:flex md:group-focus-within:flex")}>
        {boardStates
          .filter((state) => state !== task.boardState)
          .map((state) => (
            <button
              key={state}
              onClick={() => onMove(task, state)}
              className={cn("inline-flex h-8 min-w-[74px] items-center justify-center gap-1 rounded-md border px-2 text-[11px] font-black transition", boardActionClass(state))}
              title={`ย้ายไป${boardLabel(state)}`}
            >
              <ChevronRight size={11} />
              {boardLabel(state)}
            </button>
          ))}
        <button onClick={() => onPlanToday(task)} className="flex h-8 items-center justify-center gap-1 rounded-md border border-[var(--border)] bg-[var(--surface-strong)] px-2 text-[11px] font-black text-[var(--muted)] transition hover:text-[var(--foreground)]" title="วางแผนวันนี้">
          <CalendarPlus size={12} />
          วันนี้
        </button>
        <button onClick={() => onInbox(task)} className="flex h-8 w-8 items-center justify-center rounded-md bg-[var(--surface-strong)] text-[var(--muted)] transition hover:text-[var(--foreground)]" aria-label="ย้ายเข้ากล่องรับงาน" title="ย้ายเข้ากล่องรับงาน">
          <Inbox size={12} />
        </button>
        <button onClick={() => onSomeday(task)} className="flex h-8 w-8 items-center justify-center rounded-md bg-[var(--surface-strong)] text-[var(--muted)] transition hover:text-[var(--foreground)]" aria-label="พักไว้ก่อน" title="พักไว้ก่อน">
          <Bookmark size={12} />
        </button>
        <button onClick={() => onClone(task)} className="flex h-8 w-8 items-center justify-center rounded-md bg-[var(--surface-strong)] text-[var(--muted)] transition hover:text-[var(--foreground)]" aria-label="ทำสำเนางาน" title="ทำสำเนางาน">
          <Copy size={12} />
        </button>
        <button onClick={() => onArchive(task, true)} className="flex h-8 w-8 items-center justify-center rounded-md bg-[var(--surface-strong)] text-[var(--muted)] transition hover:text-[var(--foreground)]" aria-label="เก็บเข้าประวัติ" title="เก็บเข้าประวัติ">
          <Archive size={12} />
        </button>
        <button onClick={() => onDelete(task)} className="flex h-8 w-8 items-center justify-center rounded-md bg-[color-mix(in_oklab,var(--danger)_8%,transparent)] text-[var(--danger)] transition hover:opacity-80" aria-label="ลบงาน" title="ลบงาน">
          <Trash2 size={12} />
        </button>
      </div>
    </div>
  );
}

function TaskRow({
  task,
  onEdit,
  onMove,
  onToggleDone,
  onDelete,
  onClone,
  onArchive,
}: {
  task: Task;
  onEdit: (task: Task) => void;
  onMove: (task: Task, state: BoardState) => void;
  onToggleDone: (task: Task) => void;
  onDelete: (task: Task) => void;
  onClone: (task: Task) => void;
  onArchive: (task: Task, archived: boolean) => void;
}) {
  const done = isDoneTask(task);
  return (
    <div className={cn("grid gap-3 p-4 md:grid-cols-[1.4fr_120px_120px_120px_120px] md:items-center", done && "opacity-70")}>
      <div className="grid grid-cols-[auto_1fr] items-start gap-3">
      <TaskCheckButton checked={done} onClick={() => onToggleDone(task)} />
      <button onClick={() => onEdit(task)} className="text-left">
        <p className={cn("font-black", done && "line-through decoration-2")}>{task.title}</p>
        <p className="text-sm text-[var(--muted)]">{task.notes || categoryLabel(task.category)}</p>
      </button>
      </div>
      <span className={cn("w-fit rounded-md border px-2 py-1 text-xs font-black", priorityClass(task.priority))}>{priorityLabel(task.priority)}</span>
      <span className={cn("w-fit rounded-md border px-2 py-1 text-xs font-black", boardClass(task.boardState))}>{boardLabel(task.boardState)}</span>
      <span className="text-sm font-bold text-[var(--muted)]">{formatThaiDate(task.dueAt)}</span>
      <div className="flex justify-end gap-1">
        <Button variant="ghost" className="h-8 px-2" onClick={() => onMove(task, task.boardState === "done" ? "todo" : "done")} aria-label={done ? "เปิดงานอีกครั้ง" : "ทำเครื่องหมายว่าเสร็จแล้ว"} title={done ? "เปิดงานอีกครั้ง" : "เสร็จแล้ว"}>
          <CheckCircle2 size={15} />
        </Button>
        <Button variant="ghost" className="h-8 px-2" onClick={() => onClone(task)} aria-label="ทำสำเนางาน" title="ทำสำเนางาน">
          <Copy size={15} />
        </Button>
        <Button variant="ghost" className="h-8 px-2" onClick={() => onArchive(task, true)} aria-label="เก็บเข้าประวัติ" title="เก็บเข้าประวัติ">
          <Archive size={15} />
        </Button>
        <Button variant="ghost" className="h-8 px-2 text-[var(--danger)]" onClick={() => onDelete(task)} aria-label="ลบงาน" title="ลบงาน">
          <Trash2 size={15} />
        </Button>
      </div>
    </div>
  );
}

function SettingLine({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between rounded-lg bg-[var(--surface-strong)] px-3 py-2">
      <span className="text-sm font-bold text-[var(--muted)]">{label}</span>
      <span className="text-sm font-black">{value}</span>
    </div>
  );
}
