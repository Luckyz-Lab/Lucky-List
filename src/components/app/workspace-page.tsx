"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  Archive,
  Bell,
  CalendarDays,
  CheckCircle2,
  ChevronRight,
  CirclePlus,
  Clock,
  Cloud,
  CloudOff,
  Command,
  Copy,
  Download,
  FileJson,
  Gauge,
  Keyboard,
  LayoutDashboard,
  ListChecks,
  LogOut,
  Moon,
  MoreHorizontal,
  RefreshCcw,
  RotateCcw,
  Search,
  Settings,
  ShieldCheck,
  SlidersHorizontal,
  Sun,
  Target,
  Trash2,
  Upload,
  Zap,
} from "lucide-react";
import { useMemo, useRef, useState } from "react";
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
import { useReminderNotifications } from "@/lib/client/use-reminder-notifications";
import { useLuckyList } from "@/lib/client/use-lucky-list";
import { createClient, hasSupabaseEnv } from "@/lib/supabase/client";
import type { AppView, BoardState, SyncState, Task, TaskPriority } from "@/lib/types";
import {
  boardLabel,
  cn,
  daysUntil,
  formatThaiDate,
  isDoneTask,
  isDueSoon,
  isOverdue,
  isTodayTask,
  priorityLabel,
  repeatLabel,
  taskSort,
} from "@/lib/utils";
import { TaskModal } from "./task-modal";

const navItems: { view: AppView; href: string; label: string; icon: typeof LayoutDashboard }[] = [
  { view: "dashboard", href: "/app", label: "แดชบอร์ด", icon: LayoutDashboard },
  { view: "focus", href: "/app/focus", label: "Focus", icon: Target },
  { view: "board", href: "/app/board", label: "บอร์ด", icon: Gauge },
  { view: "tasks", href: "/app/tasks", label: "งานทั้งหมด", icon: ListChecks },
  { view: "calendar", href: "/app/calendar", label: "ปฏิทิน", icon: CalendarDays },
  { view: "archive", href: "/app/archive", label: "ประวัติ", icon: Archive },
  { view: "settings", href: "/app/settings", label: "ตั้งค่า", icon: Settings },
];

const boardStates: BoardState[] = ["todo", "wip", "done"];
const priorities: TaskPriority[] = ["Low", "Normal", "High", "Urgent"];

function SyncStatusIcon({ state, size }: { state: SyncState; size: number }) {
  const className = state === "syncing" ? "animate-spin" : "";
  if (state === "offline") return <CloudOff size={size} className={className} />;
  if (state === "syncing") return <RefreshCcw size={size} className={className} />;
  if (state === "error") return <Bell size={size} className={className} />;
  return <Cloud size={size} className={className} />;
}

function priorityClass(priority: TaskPriority) {
  return {
    Low: "border-slate-300 bg-slate-500/10 text-slate-500",
    Normal: "border-sky-300 bg-sky-500/10 text-sky-500",
    High: "border-amber-300 bg-amber-500/10 text-amber-500",
    Urgent: "border-rose-300 bg-rose-500/10 text-rose-500",
  }[priority];
}

function boardClass(state: BoardState) {
  return {
    todo: "border-slate-300 bg-slate-500/10 text-slate-500",
    wip: "border-indigo-300 bg-indigo-500/10 text-indigo-500",
    done: "border-emerald-300 bg-emerald-500/10 text-emerald-500",
  }[state];
}

export function WorkspacePage({ initialView }: { initialView: AppView }) {
  const pathname = usePathname();
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [commandOpen, setCommandOpen] = useState(false);
  const [importNotice, setImportNotice] = useState("");
  const [query, setQuery] = useState("");
  const [priorityFilter, setPriorityFilter] = useState<"All" | TaskPriority>("All");
  const [categoryFilter, setCategoryFilter] = useState("All");
  const {
    tasks,
    settings: userSettings,
    loading,
    syncState,
    syncMessage,
    isAuthed,
    saveTask,
    moveTask,
    quickAdd,
    deleteTask,
    archiveTask,
    cloneTask,
    updateSubtask,
    saveSettings,
    runSync,
    exportJson,
    backupNow,
    exportLatestLocalBackup,
    exportCsv,
    importFile,
    lastBackupAt,
  } = useLuckyList();

  const activeView = navItems.find((item) => item.href === pathname)?.view ?? initialView;
  const activeTasks = useMemo(() => tasks.filter((task) => !task.archivedAt && !task.deletedAt), [tasks]);
  const archivedTasks = useMemo(() => tasks.filter((task) => task.archivedAt && !task.deletedAt), [tasks]);
  const doneTasks = useMemo(() => activeTasks.filter(isDoneTask), [activeTasks]);
  const openTasks = useMemo(() => activeTasks.filter((task) => !isDoneTask(task)), [activeTasks]);
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
    const text = query.toLowerCase();
    return activeTasks
      .filter((task) => !text || `${task.title} ${task.notes} ${task.category}`.toLowerCase().includes(text))
      .filter((task) => priorityFilter === "All" || task.priority === priorityFilter)
      .filter((task) => categoryFilter === "All" || task.category === categoryFilter)
      .sort(taskSort);
  }, [activeTasks, categoryFilter, priorityFilter, query]);

  const chartData = useMemo(() => {
    const days = ["จ", "อ", "พ", "พฤ", "ศ", "ส", "อา"];
    return days.map((day, index) => ({
      day,
      done: Math.max(0, doneTasks.length - (6 - index)) + index,
      active: Math.max(1, openTasks.length + (index % 3)),
    }));
  }, [doneTasks.length, openTasks.length]);

  const completion = activeTasks.length ? Math.round((doneTasks.length / activeTasks.length) * 100) : 0;
  function openCreate() {
    setEditingTask(null);
    setModalOpen(true);
  }

  function openEdit(task: Task) {
    setEditingTask(task);
    setModalOpen(true);
  }

  async function handleQuickAdd(text: string) {
    const task = await quickAdd(text);
    if (task) setImportNotice(`Added: ${task.title}`);
    return task;
  }

  async function handleImportFile(file: File) {
    try {
      const result = await importFile(file);
      const warning = result.warnings.length ? ` (${result.warnings.join(" ")})` : "";
      setImportNotice(`Imported ${result.tasks.length} tasks from ${result.source}.${warning}`);
    } catch (error) {
      setImportNotice(error instanceof Error ? error.message : "Import failed");
    }
  }

  function navigateTo(href: string) {
    router.push(href);
  }

  async function signOut() {
    localStorage.removeItem("lucky_private_session");
    const client = createClient();
    if (client) await client.auth.signOut();
    router.push("/login");
  }

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[var(--background)]">
        <Panel className="p-6 text-center">
          <RefreshCcw className="mx-auto mb-3 animate-spin text-indigo-500" />
          <p className="text-sm font-semibold">กำลังเปิด Lucky List...</p>
        </Panel>
      </div>
    );
  }

  if (!isAuthed) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[var(--background)] p-4">
        <Panel className="max-w-md p-7 text-center">
          <ShieldCheck className="mx-auto mb-4 text-indigo-500" size={44} />
          <h1 className="text-2xl font-black">Lucky List ถูกล็อกไว้</h1>
          <p className="mt-2 text-sm text-[var(--muted)]">
            เข้าสู่ระบบ Supabase หรือเปิดโหมดส่วนตัวในเครื่องเพื่อใช้งานต่อ
          </p>
          <Link href="/login" className="mt-5 inline-flex">
            <Button>ไปหน้า Login</Button>
          </Link>
        </Panel>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[var(--background)] text-[var(--foreground)]">
      <div className="grid min-h-screen lg:grid-cols-[260px_1fr]">
        <aside className="sticky top-0 hidden h-screen border-r border-[var(--border)] bg-[var(--surface)]/80 p-4 backdrop-blur lg:block">
          <div className="mb-8 flex items-center gap-3 px-2">
            <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-indigo-600 text-lg font-black text-white shadow-lg shadow-indigo-600/20">
              LL
            </div>
            <div>
              <p className="text-lg font-black leading-tight">Lucky List</p>
              <p className="text-xs font-semibold text-[var(--muted)]">Hybrid Workspace</p>
            </div>
          </div>
          <nav className="grid gap-1">
            {navItems.map((item) => {
              const Icon = item.icon;
              const active = item.view === activeView;
              return (
                <Link
                  key={item.view}
                  href={item.href}
                  className={cn(
                    "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-bold transition",
                    active
                      ? "bg-indigo-600 text-white shadow-sm shadow-indigo-900/20"
                      : "text-[var(--muted)] hover:bg-[var(--surface-strong)] hover:text-[var(--foreground)]",
                  )}
                >
                  <Icon size={18} />
                  {item.label}
                </Link>
              );
            })}
          </nav>
          <Panel className="mt-8 p-4">
            <div className="flex items-center gap-2 text-sm font-black">
              <SyncStatusIcon state={syncState} size={17} />
              Sync Status
            </div>
            <p className="mt-2 text-xs leading-5 text-[var(--muted)]">{syncMessage}</p>
            <Button variant="secondary" className="mt-3 w-full" onClick={runSync}>
              <RefreshCcw size={15} />
              Sync now
            </Button>
          </Panel>
        </aside>

        <main className="min-w-0 pb-24 lg:pb-0">
          <header className="sticky top-0 z-30 border-b border-[var(--border)] bg-[var(--background)]/88 px-4 py-3 backdrop-blur md:px-6">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.2em] text-indigo-500">Lucky List</p>
                <h1 className="text-xl font-black md:text-2xl">{navItems.find((item) => item.view === activeView)?.label}</h1>
              </div>
              <div className="flex items-center gap-2">
                <div className="hidden items-center gap-2 rounded-lg border border-[var(--border)] px-3 py-2 text-xs font-semibold text-[var(--muted)] md:flex">
                  <SyncStatusIcon state={syncState} size={15} />
                  {syncMessage}
                </div>
                <Button variant="secondary" onClick={() => setCommandOpen(true)} className="px-3" title="Command palette">
                  <Command size={17} />
                  <span className="hidden md:inline">Ctrl K</span>
                </Button>
                <Button variant="secondary" onClick={() => saveSettings({ theme: userSettings.theme === "dark" ? "light" : "dark" })} className="px-3">
                  {userSettings.theme === "dark" ? <Sun size={17} /> : <Moon size={17} />}
                </Button>
                <Button onClick={openCreate}>
                  <CirclePlus size={17} />
                  <span className="hidden sm:inline">สร้างงาน</span>
                </Button>
                <Button variant="ghost" onClick={signOut} className="px-3">
                  <LogOut size={17} />
                </Button>
              </div>
            </div>
          </header>

          <div className="mx-auto grid max-w-7xl gap-5 p-4 md:p-6">
            {activeView === "dashboard" && renderDashboard()}
            {activeView === "focus" && renderFocus()}
            {activeView === "board" && renderBoard()}
            {activeView === "tasks" && renderTasks()}
            {activeView === "calendar" && renderCalendar()}
            {activeView === "archive" && renderArchive()}
            {activeView === "settings" && renderSettings()}
          </div>
        </main>
      </div>

      <nav className="fixed inset-x-0 bottom-0 z-40 grid grid-cols-7 border-t border-[var(--border)] bg-[var(--surface)]/95 p-2 backdrop-blur lg:hidden">
        {navItems.map((item) => {
          const Icon = item.icon;
          const active = item.view === activeView;
          return (
            <Link key={item.view} href={item.href} className={cn("flex flex-col items-center gap-1 rounded-lg py-2 text-[10px] font-bold", active ? "bg-indigo-600 text-white" : "text-[var(--muted)]")}>
              <Icon size={17} />
              {item.label}
            </Link>
          );
        })}
      </nav>

      <CommandPalette
        open={commandOpen}
        tasks={activeTasks}
        onOpenChange={setCommandOpen}
        onQuickAdd={handleQuickAdd}
        onOpenTask={openEdit}
        onCreateTask={openCreate}
        onNavigate={navigateTo}
        onRunSync={runSync}
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
          <StatCard title="Overdue" value={overdueTasks.length} tone="rose" detail="Needs attention first" />
          <StatCard title="Today" value={todayTasks.length} tone="indigo" detail="Due, starts, or reminds today" />
          <StatCard title="Due soon" value={soonTasks.length} tone="amber" detail={`Within ${userSettings.deadlineThresholdDays} days`} />
          <StatCard title="Reminders" value={reminders.pendingReminders.length} tone="emerald" detail={userSettings.notificationsEnabled ? "Notifications enabled" : "Notifications off"} />
        </section>

        <section className="grid gap-5 xl:grid-cols-[1.35fr_0.8fr]">
          <Panel className="p-4">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="flex items-center gap-2 text-lg font-black">
                  <Target size={19} className="text-indigo-500" />
                  Focus Queue
                </h2>
                <p className="text-sm text-[var(--muted)]">Overdue, today, due soon, and urgent tasks are grouped here.</p>
              </div>
              <Button variant="secondary" onClick={() => setCommandOpen(true)}>
                <Keyboard size={16} />
                Ctrl K
              </Button>
            </div>
            <div className="grid gap-3 xl:grid-cols-2">
              {focusTasks.map((task) => (
                <TaskCard key={task.id} task={task} onEdit={openEdit} onMove={moveTask} onDelete={deleteTask} onClone={cloneTask} onArchive={archiveTask} onSubtask={updateSubtask} />
              ))}
              {!focusTasks.length && <EmptyState title="No focus tasks" detail="Everything urgent is clear. Add a new task or check the board." />}
            </div>
          </Panel>

          <div className="grid gap-5">
            <Panel className="p-5">
              <div className="mb-4 flex items-center justify-between">
                <h2 className="flex items-center gap-2 text-lg font-black">
                  <Clock size={19} className="text-amber-500" />
                  Today
                </h2>
                <span className="text-sm font-black text-[var(--muted)]">{todayTasks.length}</span>
              </div>
              <div className="grid gap-3">
                {todayTasks.slice(0, 5).map((task) => (
                  <TaskMini key={task.id} task={task} onClick={() => openEdit(task)} />
                ))}
                {!todayTasks.length && <EmptyState title="No task today" detail="Your today list is empty." />}
              </div>
            </Panel>

            <Panel className="p-5">
              <div className="mb-4 flex items-center justify-between">
                <h2 className="flex items-center gap-2 text-lg font-black">
                  <Zap size={19} className="text-emerald-500" />
                  Recurring
                </h2>
                <span className="text-sm font-black text-[var(--muted)]">{recurringTasks.length}</span>
              </div>
              <div className="grid gap-3">
                {recurringTasks.slice(0, 5).map((task) => (
                  <TaskMini key={task.id} task={task} onClick={() => openEdit(task)} />
                ))}
                {!recurringTasks.length && <EmptyState title="No recurring task" detail="Set repeat in a task to generate the next round after completion." />}
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
        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <StatCard title="งานทั้งหมด" value={activeTasks.length} tone="indigo" detail={`${doneTasks.length} งานเสร็จแล้ว`} />
          <StatCard title="กำลังทำ" value={openTasks.length} tone="amber" detail="Todo + WIP" />
          <StatCard title="ใกล้กำหนด" value={soonTasks.length} tone="rose" detail={`ภายใน ${userSettings.deadlineThresholdDays} วัน`} />
          <StatCard title="ความสำเร็จ" value={`${completion}%`} tone="emerald" detail="อิงจากงาน active" />
        </section>

        <section className="grid gap-5 xl:grid-cols-[1.4fr_0.9fr]">
          <Panel className="p-5">
            <div className="mb-5 flex items-center justify-between">
              <div>
                <h2 className="text-lg font-black">ภาพรวมสัปดาห์นี้</h2>
                <p className="text-sm text-[var(--muted)]">งานที่เสร็จและงาน active ในเครื่อง</p>
              </div>
              <span className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-1 text-xs font-black text-emerald-500">
                Offline-ready
              </span>
            </div>
            <div className="h-72">
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

          <Panel className="p-5">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-black">Deadline Radar</h2>
              <Bell className="text-rose-500" size={19} />
            </div>
            <div className="grid gap-3">
              {soonTasks.slice(0, 6).map((task) => (
                <TaskMini key={task.id} task={task} onClick={() => openEdit(task)} />
              ))}
              {!soonTasks.length && <EmptyState title="ยังไม่มีงานใกล้กำหนด" detail="งานที่มี deadline จะมาแสดงที่นี่" />}
            </div>
          </Panel>
        </section>

        {renderBoard(true)}
      </>
    );
  }

  function renderBoard(compact = false) {
    return (
      <section className="grid gap-4 xl:grid-cols-3">
        {boardStates.map((state) => {
          const items = activeTasks.filter((task) => task.boardState === state && !task.archivedAt).sort(taskSort);
          return (
            <Panel key={state} className="min-h-[260px] p-4">
              <div className="mb-4 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className={cn("rounded-lg border px-2 py-1 text-xs font-black", boardClass(state))}>{boardLabel(state)}</span>
                  <span className="text-xs font-bold text-[var(--muted)]">{items.length} งาน</span>
                </div>
                <MoreHorizontal size={17} className="text-[var(--muted)]" />
              </div>
              <div className="grid gap-3">
                {(compact ? items.slice(0, 3) : items).map((task) => (
                  <TaskCard key={task.id} task={task} onEdit={openEdit} onMove={moveTask} onDelete={deleteTask} onClone={cloneTask} onArchive={archiveTask} onSubtask={updateSubtask} />
                ))}
                {!items.length && <EmptyState title="ว่างอยู่" detail="ย้ายงานมาที่คอลัมน์นี้ได้" />}
              </div>
            </Panel>
          );
        })}
      </section>
    );
  }

  function renderTasks() {
    return (
      <>
        <Panel className="grid gap-3 p-4 md:grid-cols-[1fr_180px_180px]">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--muted)]" size={17} />
            <input className="focus-ring w-full rounded-lg border border-[var(--border)] bg-transparent py-2 pl-10 pr-3 text-sm" placeholder="ค้นหาชื่องาน หมวดหมู่ หรือรายละเอียด..." value={query} onChange={(event) => setQuery(event.target.value)} />
          </div>
          <select className="focus-ring rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm font-semibold" value={priorityFilter} onChange={(event) => setPriorityFilter(event.target.value as "All" | TaskPriority)}>
            <option value="All">ทุกความสำคัญ</option>
            {priorities.map((priority) => (
              <option key={priority}>{priority}</option>
            ))}
          </select>
          <select className="focus-ring rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm font-semibold" value={categoryFilter} onChange={(event) => setCategoryFilter(event.target.value)}>
            <option value="All">ทุกหมวดหมู่</option>
            {categories.map((category) => (
              <option key={category}>{category}</option>
            ))}
          </select>
        </Panel>
        <Panel className="overflow-hidden">
          <div className="hidden grid-cols-[1.4fr_120px_120px_120px_120px] border-b border-[var(--border)] px-4 py-3 text-xs font-black uppercase tracking-wide text-[var(--muted)] md:grid">
            <span>งาน</span>
            <span>Priority</span>
            <span>Status</span>
            <span>Due</span>
            <span className="text-right">Actions</span>
          </div>
          <div className="divide-y divide-[var(--border)]">
            {filteredTasks.map((task) => (
              <TaskRow key={task.id} task={task} onEdit={openEdit} onMove={moveTask} onDelete={deleteTask} onClone={cloneTask} onArchive={archiveTask} />
            ))}
            {!filteredTasks.length && <EmptyState title="ไม่พบงาน" detail="ลองล้าง filter หรือสร้างงานใหม่" />}
          </div>
        </Panel>
      </>
    );
  }

  function renderCalendar() {
    const dated = activeTasks.filter((task) => task.dueAt).sort(taskSort);
    return (
      <section className="grid gap-5 xl:grid-cols-[1fr_360px]">
        <Panel className="p-5">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-lg font-black">Timeline งาน</h2>
            <SlidersHorizontal className="text-[var(--muted)]" size={18} />
          </div>
          <div className="grid gap-3">
            {dated.map((task) => (
              <button key={task.id} onClick={() => openEdit(task)} className="grid gap-2 rounded-lg border border-[var(--border)] p-4 text-left transition hover:bg-[var(--surface-strong)] md:grid-cols-[130px_1fr_90px]">
                <span className="text-sm font-black text-indigo-500">{formatThaiDate(task.dueAt)}</span>
                <span>
                  <span className="block font-bold">{task.title}</span>
                  <span className="text-xs text-[var(--muted)]">{repeatLabel(task.repeatRule)}</span>
                </span>
                <span className={cn("rounded-lg border px-2 py-1 text-center text-xs font-black", priorityClass(task.priority))}>{priorityLabel(task.priority)}</span>
              </button>
            ))}
          </div>
        </Panel>
        <Panel className="p-5">
          <h2 className="mb-4 text-lg font-black">เลยกำหนด</h2>
          <div className="grid gap-3">
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
        <div className="flex items-center justify-between border-b border-[var(--border)] p-4">
          <div>
            <h2 className="text-lg font-black">ประวัติงาน</h2>
            <p className="text-sm text-[var(--muted)]">งานที่ archive แล้วสามารถ restore กลับมาได้</p>
          </div>
          <span className="text-sm font-black text-[var(--muted)]">{archivedTasks.length} รายการ</span>
        </div>
        <div className="divide-y divide-[var(--border)]">
          {archivedTasks.map((task) => (
            <div key={task.id} className="flex flex-col gap-3 p-4 md:flex-row md:items-center md:justify-between">
              <div>
                <h3 className="font-black">{task.title}</h3>
                <p className="text-sm text-[var(--muted)]">Archive: {formatThaiDate(task.archivedAt)}</p>
              </div>
              <div className="flex gap-2">
                <Button variant="secondary" onClick={() => archiveTask(task, false)}>
                  <RotateCcw size={16} />
                  Restore
                </Button>
                <Button variant="danger" onClick={() => deleteTask(task)}>
                  <Trash2 size={16} />
                </Button>
              </div>
            </div>
          ))}
          {!archivedTasks.length && <EmptyState title="ยังไม่มีประวัติงาน" detail="กด archive งานที่จบแล้วเพื่อเก็บประวัติ" />}
        </div>
      </Panel>
    );
  }

  function renderSettings() {
    return (
      <section className="grid gap-5 xl:grid-cols-2">
        <Panel className="p-5">
          <h2 className="text-lg font-black">ระบบและ Sync</h2>
          <div className="mt-4 grid gap-3">
            <SettingLine label="Supabase" value={hasSupabaseEnv() ? "Configured" : "Local mode"} />
            <SettingLine label="สถานะ Sync" value={syncMessage} />
            <SettingLine label="Offline DB" value="IndexedDB / Dexie" />
            <SettingLine label="Last backup" value={lastBackupAt ? formatThaiDate(lastBackupAt) : "Not yet"} />
            <SettingLine label="Notifications" value={reminders.permission} />
          </div>
          <div className="mt-5 flex flex-wrap gap-2">
            <Button onClick={runSync}>
              <RefreshCcw size={16} />
              Sync now
            </Button>
            <Button variant="secondary" onClick={() => void backupNow(true)}>
              <Download size={16} />
              Backup now
            </Button>
            <Button variant="secondary" onClick={() => void exportLatestLocalBackup()}>
              <FileJson size={16} />
              Latest backup
            </Button>
            <Button variant="secondary" onClick={exportCsv}>
              <Download size={16} />
              Export CSV
            </Button>
            <Button variant="secondary" onClick={() => fileRef.current?.click()}>
              <Upload size={16} />
              Import JSON/HTML
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
        <Panel className="p-5">
          <h2 className="text-lg font-black">Preferences</h2>
          <div className="mt-4 grid gap-4">
            <label className="grid gap-1 text-sm font-bold">
              แจ้งเตือน deadline ภายในกี่วัน
              <input type="number" min={1} max={31} value={userSettings.deadlineThresholdDays} onChange={(event) => saveSettings({ deadlineThresholdDays: Number(event.target.value) || 3 })} className="focus-ring rounded-lg border border-[var(--border)] bg-transparent px-3 py-2" />
            </label>
            <label className="flex items-center justify-between gap-4 rounded-lg border border-[var(--border)] p-3 text-sm font-bold">
              <span>
                <span className="block">Reminder notifications</span>
                <span className="text-xs font-semibold text-[var(--muted)]">Browser permission: {reminders.permission}</span>
              </span>
              <input
                type="checkbox"
                checked={userSettings.notificationsEnabled}
                onChange={async (event) => {
                  const enabled = event.target.checked;
                  if (enabled && reminders.permission !== "granted") {
                    const result = await reminders.requestPermission();
                    if (result !== "granted") {
                      setImportNotice("Browser notification permission was not granted.");
                      await saveSettings({ notificationsEnabled: false });
                      return;
                    }
                  }
                  await saveSettings({ notificationsEnabled: enabled });
                }}
                className="h-5 w-5 accent-indigo-600"
              />
            </label>
            <label className="grid gap-1 text-sm font-bold">
              Auto backup interval (minutes)
              <input type="number" min={0} max={1440} value={userSettings.autoBackupMinutes} onChange={(event) => saveSettings({ autoBackupMinutes: Number(event.target.value) || 0 })} className="focus-ring rounded-lg border border-[var(--border)] bg-transparent px-3 py-2" />
              <span className="text-xs font-semibold text-[var(--muted)]">Set 0 to disable local smart backup snapshots.</span>
            </label>
            <label className="grid gap-1 text-sm font-bold">
              Theme
              <select value={userSettings.theme} onChange={(event) => saveSettings({ theme: event.target.value as typeof userSettings.theme })} className="focus-ring rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2">
                <option value="dark">Dark</option>
                <option value="light">Light</option>
                <option value="system">System</option>
              </select>
            </label>
            <label className="grid gap-1 text-sm font-bold">
              Categories
              <input value={userSettings.categories.join(", ")} onChange={(event) => saveSettings({ categories: event.target.value.split(",").map((item) => item.trim()).filter(Boolean) })} className="focus-ring rounded-lg border border-[var(--border)] bg-transparent px-3 py-2" />
            </label>
          </div>
        </Panel>
      </section>
    );
  }
}

function StatCard({ title, value, detail, tone }: { title: string; value: number | string; detail: string; tone: "indigo" | "amber" | "rose" | "emerald" }) {
  const tones = {
    indigo: "text-indigo-500 border-indigo-500/30 bg-indigo-500/10",
    amber: "text-amber-500 border-amber-500/30 bg-amber-500/10",
    rose: "text-rose-500 border-rose-500/30 bg-rose-500/10",
    emerald: "text-emerald-500 border-emerald-500/30 bg-emerald-500/10",
  };
  return (
    <Panel className="p-4">
      <div className="flex items-center justify-between">
        <span className={cn("rounded-lg border px-2 py-1 text-[10px] font-black uppercase tracking-wider", tones[tone])}>{title}</span>
        <CheckCircle2 size={18} className="text-[var(--muted)]" />
      </div>
      <p className="mt-5 text-4xl font-black">{value}</p>
      <p className="mt-1 text-sm text-[var(--muted)]">{detail}</p>
    </Panel>
  );
}

function EmptyState({ title, detail }: { title: string; detail: string }) {
  return (
    <div className="rounded-lg border border-dashed border-[var(--border)] p-6 text-center">
      <p className="font-black">{title}</p>
      <p className="mt-1 text-sm text-[var(--muted)]">{detail}</p>
    </div>
  );
}

function TaskMini({ task, onClick }: { task: Task; onClick: () => void }) {
  const days = daysUntil(task.dueAt);
  return (
    <button onClick={onClick} className="rounded-lg border border-[var(--border)] p-3 text-left transition hover:bg-[var(--surface-strong)]">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="font-bold">{task.title}</p>
          <p className="text-xs text-[var(--muted)]">{task.category || "ทั่วไป"}</p>
        </div>
        <span className={cn("rounded-md border px-2 py-0.5 text-[10px] font-black", priorityClass(task.priority))}>{priorityLabel(task.priority)}</span>
      </div>
      <div className="mt-3 flex items-center justify-between text-xs font-bold">
        <span className={days !== null && days < 0 ? "text-rose-500" : "text-amber-500"}>
          {days === null ? "ไม่กำหนด" : days < 0 ? `เลย ${Math.abs(days)} วัน` : days === 0 ? "วันนี้" : `เหลือ ${days} วัน`}
        </span>
        <span>{task.progress}%</span>
      </div>
    </button>
  );
}

function TaskCard({
  task,
  onEdit,
  onMove,
  onDelete,
  onClone,
  onArchive,
  onSubtask,
}: {
  task: Task;
  onEdit: (task: Task) => void;
  onMove: (task: Task, state: BoardState) => void;
  onDelete: (task: Task) => void;
  onClone: (task: Task) => void;
  onArchive: (task: Task, archived: boolean) => void;
  onSubtask: (task: Task, subtaskId: string, progress: number) => void;
}) {
  return (
    <div className="rounded-lg border border-[var(--border)] bg-[var(--surface)] p-3">
      <button onClick={() => onEdit(task)} className="block w-full text-left">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h3 className="font-black leading-snug">{task.title}</h3>
            <p className="mt-1 line-clamp-2 text-xs text-[var(--muted)]">{task.notes || "ไม่มีรายละเอียด"}</p>
          </div>
          <span className={cn("rounded-md border px-2 py-0.5 text-[10px] font-black", priorityClass(task.priority))}>{priorityLabel(task.priority)}</span>
        </div>
      </button>
      <div className="mt-3">
        <div className="mb-1 flex justify-between text-xs font-bold text-[var(--muted)]">
          <span>{task.category || "ทั่วไป"}</span>
          <span>{task.progress}%</span>
        </div>
        <div className="h-2 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-800">
          <div className="h-full rounded-full bg-gradient-to-r from-indigo-500 to-emerald-400" style={{ width: `${task.progress}%` }} />
        </div>
      </div>
      {task.subtasks.length > 0 && (
        <div className="mt-3 grid gap-2">
          {task.subtasks.slice(0, 3).map((subtask) => (
            <label key={subtask.id} className="grid gap-1 text-xs font-semibold text-[var(--muted)]">
              <span className="flex justify-between">
                <span>{subtask.title}</span>
                <span>{subtask.progress}%</span>
              </span>
              <input type="range" min={0} max={100} step={5} value={subtask.progress} onChange={(event) => onSubtask(task, subtask.id, Number(event.target.value))} />
            </label>
          ))}
        </div>
      )}
      <div className="mt-3 flex flex-wrap gap-2">
        {boardStates
          .filter((state) => state !== task.boardState)
          .map((state) => (
            <button key={state} onClick={() => onMove(task, state)} className="rounded-md bg-[var(--surface-strong)] px-2 py-1 text-[10px] font-black text-[var(--muted)] hover:text-[var(--foreground)]">
              <ChevronRight className="inline" size={12} /> {boardLabel(state)}
            </button>
          ))}
        <button onClick={() => onClone(task)} className="rounded-md bg-[var(--surface-strong)] px-2 py-1 text-[var(--muted)]">
          <Copy size={13} />
        </button>
        <button onClick={() => onArchive(task, true)} className="rounded-md bg-[var(--surface-strong)] px-2 py-1 text-[var(--muted)]">
          <Archive size={13} />
        </button>
        <button onClick={() => onDelete(task)} className="rounded-md bg-rose-500/10 px-2 py-1 text-rose-500">
          <Trash2 size={13} />
        </button>
      </div>
    </div>
  );
}

function TaskRow({
  task,
  onEdit,
  onMove,
  onDelete,
  onClone,
  onArchive,
}: {
  task: Task;
  onEdit: (task: Task) => void;
  onMove: (task: Task, state: BoardState) => void;
  onDelete: (task: Task) => void;
  onClone: (task: Task) => void;
  onArchive: (task: Task, archived: boolean) => void;
}) {
  return (
    <div className="grid gap-3 p-4 md:grid-cols-[1.4fr_120px_120px_120px_120px] md:items-center">
      <button onClick={() => onEdit(task)} className="text-left">
        <p className="font-black">{task.title}</p>
        <p className="text-sm text-[var(--muted)]">{task.notes || task.category || "ไม่มีรายละเอียด"}</p>
      </button>
      <span className={cn("w-fit rounded-md border px-2 py-1 text-xs font-black", priorityClass(task.priority))}>{priorityLabel(task.priority)}</span>
      <span className={cn("w-fit rounded-md border px-2 py-1 text-xs font-black", boardClass(task.boardState))}>{boardLabel(task.boardState)}</span>
      <span className="text-sm font-bold text-[var(--muted)]">{formatThaiDate(task.dueAt)}</span>
      <div className="flex justify-end gap-1">
        <Button variant="ghost" className="h-8 px-2" onClick={() => onMove(task, task.boardState === "done" ? "todo" : "done")}>
          <CheckCircle2 size={15} />
        </Button>
        <Button variant="ghost" className="h-8 px-2" onClick={() => onClone(task)}>
          <Copy size={15} />
        </Button>
        <Button variant="ghost" className="h-8 px-2" onClick={() => onArchive(task, true)}>
          <Archive size={15} />
        </Button>
        <Button variant="ghost" className="h-8 px-2 text-rose-500" onClick={() => onDelete(task)}>
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
