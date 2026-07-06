"use client";

import {
  Archive,
  CalendarDays,
  CirclePlus,
  Download,
  Gauge,
  LayoutDashboard,
  ListChecks,
  RefreshCcw,
  Search,
  Settings,
  Target,
  X,
} from "lucide-react";
import type { ReactNode } from "react";
import { useEffect, useMemo, useState } from "react";
import type { Task } from "@/lib/types";
import { cn, formatThaiDate, priorityLabel } from "@/lib/utils";

type CommandItem = {
  id: string;
  label: string;
  detail: string;
  icon: ReactNode;
  run: () => Promise<void> | void;
  keywords: string;
};

export function CommandPalette({
  open,
  tasks,
  onOpenChange,
  onQuickAdd,
  onOpenTask,
  onCreateTask,
  onNavigate,
  onRunSync,
  onExportJson,
}: {
  open: boolean;
  tasks: Task[];
  onOpenChange: (open: boolean) => void;
  onQuickAdd: (text: string) => Promise<unknown>;
  onOpenTask: (task: Task) => void;
  onCreateTask: () => void;
  onNavigate: (href: string) => void;
  onRunSync: () => Promise<void>;
  onExportJson: () => void;
}) {
  const [query, setQuery] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);
  const [running, setRunning] = useState(false);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        onOpenChange(true);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onOpenChange]);

  const normalizedQuery = query.trim().toLowerCase();
  const items = useMemo(() => {
    const baseActions: CommandItem[] = [
      {
        id: "new-task",
        label: "New task",
        detail: "Open full task form",
        icon: <CirclePlus size={16} />,
        run: onCreateTask,
        keywords: "new create add task",
      },
      {
        id: "focus",
        label: "Open Focus",
        detail: "Today, overdue, due soon",
        icon: <Target size={16} />,
        run: () => onNavigate("/app/focus"),
        keywords: "focus today overdue",
      },
      {
        id: "dashboard",
        label: "Open Dashboard",
        detail: "Overview and radar",
        icon: <LayoutDashboard size={16} />,
        run: () => onNavigate("/app"),
        keywords: "dashboard home",
      },
      {
        id: "board",
        label: "Open Board",
        detail: "Todo, WIP, Done",
        icon: <Gauge size={16} />,
        run: () => onNavigate("/app/board"),
        keywords: "board kanban todo wip done",
      },
      {
        id: "tasks",
        label: "Open Tasks",
        detail: "Search and filters",
        icon: <ListChecks size={16} />,
        run: () => onNavigate("/app/tasks"),
        keywords: "tasks list search filter",
      },
      {
        id: "calendar",
        label: "Open Calendar",
        detail: "Deadline timeline",
        icon: <CalendarDays size={16} />,
        run: () => onNavigate("/app/calendar"),
        keywords: "calendar due deadline",
      },
      {
        id: "archive",
        label: "Open Archive",
        detail: "Restore old tasks",
        icon: <Archive size={16} />,
        run: () => onNavigate("/app/archive"),
        keywords: "archive restore history",
      },
      {
        id: "settings",
        label: "Open Settings",
        detail: "Backup, import, notifications",
        icon: <Settings size={16} />,
        run: () => onNavigate("/app/settings"),
        keywords: "settings backup import notification",
      },
      {
        id: "sync",
        label: "Sync now",
        detail: "Push and pull Supabase changes",
        icon: <RefreshCcw size={16} />,
        run: onRunSync,
        keywords: "sync cloud",
      },
      {
        id: "backup",
        label: "Backup JSON",
        detail: "Download a fresh backup file",
        icon: <Download size={16} />,
        run: onExportJson,
        keywords: "backup export json",
      },
    ];

    const taskItems: CommandItem[] = tasks.slice(0, 80).map((task) => ({
      id: `task-${task.id}`,
      label: task.title,
      detail: `${task.category || "No category"} - ${priorityLabel(task.priority)} - ${formatThaiDate(task.dueAt)}`,
      icon: <Search size={16} />,
      run: () => onOpenTask(task),
      keywords: `${task.title} ${task.notes ?? ""} ${task.category ?? ""} ${task.priority}`,
    }));

    const allItems = baseActions.concat(taskItems);
    if (!normalizedQuery) return allItems.slice(0, 12);

    const quickCreate: CommandItem = {
      id: "quick-create",
      label: `Create "${query.trim()}"`,
      detail: "Parse quick add text and save locally",
      icon: <CirclePlus size={16} />,
      run: async () => {
        await onQuickAdd(query);
      },
      keywords: normalizedQuery,
    };

    const matches = allItems.filter((item) => `${item.label} ${item.detail} ${item.keywords}`.toLowerCase().includes(normalizedQuery));
    return [quickCreate, ...matches].slice(0, 12);
  }, [normalizedQuery, onCreateTask, onExportJson, onNavigate, onOpenTask, onQuickAdd, onRunSync, query, tasks]);

  const safeIndex = items.length ? Math.min(activeIndex, items.length - 1) : 0;

  async function execute(item: CommandItem) {
    if (running) return;
    setRunning(true);
    try {
      await item.run();
      setQuery("");
      setActiveIndex(0);
      onOpenChange(false);
    } finally {
      setRunning(false);
    }
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[60] bg-black/65 p-3 backdrop-blur" role="dialog" aria-modal="true">
      <div className="mx-auto mt-16 max-w-2xl overflow-hidden rounded-lg border border-[var(--border)] bg-[var(--surface)]">
        <div className="flex items-center gap-3 border-b border-[var(--border)] px-4 py-3">
          <Search size={18} className="text-[var(--muted)]" />
          <input
            autoFocus
            className="focus-ring flex-1 bg-transparent text-sm font-semibold"
            value={query}
            onChange={(event) => {
              setQuery(event.target.value);
              setActiveIndex(0);
            }}
            onKeyDown={(event) => {
              if (event.key === "Escape") onOpenChange(false);
              if (event.key === "ArrowDown") {
                event.preventDefault();
                setActiveIndex((index) => Math.min(index + 1, Math.max(0, items.length - 1)));
              }
              if (event.key === "ArrowUp") {
                event.preventDefault();
                setActiveIndex((index) => Math.max(index - 1, 0));
              }
              if (event.key === "Enter" && items[safeIndex]) {
                event.preventDefault();
                void execute(items[safeIndex]);
              }
            }}
            placeholder="Search tasks or type a quick task..."
          />
          <button onClick={() => onOpenChange(false)} className="focus-ring rounded-lg p-2 text-[var(--muted)] hover:bg-[var(--surface-strong)]">
            <X size={17} />
          </button>
        </div>
        <div className="max-h-[440px] overflow-y-auto p-2">
          {items.map((item, index) => (
            <button
              key={item.id}
              type="button"
              onClick={() => void execute(item)}
              className={cn(
                "flex w-full items-center gap-3 rounded-lg px-3 py-3 text-left transition",
                index === safeIndex ? "bg-[var(--foreground)] text-[var(--background)]" : "hover:bg-[var(--surface-strong)]",
              )}
            >
              <span className={cn("flex h-8 w-8 items-center justify-center rounded-lg", index === safeIndex ? "bg-[color-mix(in_oklab,var(--background)_18%,transparent)]" : "bg-[var(--surface-strong)] text-[var(--foreground)]")}>
                {item.icon}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-black">{item.label}</span>
                <span className={cn("block truncate text-xs font-semibold", index === safeIndex ? "text-white/75" : "text-[var(--muted)]")}>{item.detail}</span>
              </span>
            </button>
          ))}
          {!items.length && <div className="p-8 text-center text-sm font-semibold text-[var(--muted)]">No command found</div>}
        </div>
      </div>
    </div>
  );
}
