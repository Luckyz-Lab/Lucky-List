"use client";

import Link from "next/link";
import {
  Bell,
  CirclePlus,
  Cloud,
  CloudOff,
  Command,
  LogOut,
  Moon,
  PanelLeftClose,
  PanelLeftOpen,
  RefreshCcw,
  Sun,
  type LucideIcon,
} from "lucide-react";
import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Panel } from "@/components/ui/panel";
import type { AppView, CloudState, UserSettings } from "@/lib/types";
import { cn } from "@/lib/utils";

export type WorkspaceNavItem = {
  view: AppView;
  href: string;
  label: string;
  icon: LucideIcon;
};

export type WorkspaceSavedView = {
  label: string;
  detail: string;
  count: number;
  query: string;
  icon: LucideIcon;
};

function CloudStatusIcon({ state, size }: { state: CloudState; size: number }) {
  const className = state === "checking" || state === "saving" ? "animate-spin" : "";
  if (state === "offline") return <CloudOff size={size} className={className} />;
  if (state === "checking" || state === "saving") return <RefreshCcw size={size} className={className} />;
  if (state === "error") return <Bell size={size} className={className} />;
  return <Cloud size={size} className={className} />;
}

export function WorkspaceShell({
  activeView,
  children,
  cloudMessage,
  cloudState,
  navItems,
  onCreate,
  notificationCount,
  onOpenCommand,
  onOpenNotifications,
  onOpenSavedView,
  onRefreshCloud,
  onSignOut,
  onToggleSidebar,
  onToggleTheme,
  savedViews = [],
  sidebarCollapsed,
  userSettings,
}: {
  activeView: AppView;
  children: ReactNode;
  cloudMessage: string;
  cloudState: CloudState;
  navItems: WorkspaceNavItem[];
  onCreate: () => void;
  notificationCount?: number;
  onOpenCommand: () => void;
  onOpenNotifications?: () => void;
  onOpenSavedView?: (view: WorkspaceSavedView) => void;
  onRefreshCloud: () => void;
  onSignOut: () => void;
  onToggleSidebar: () => void;
  onToggleTheme: () => void;
  savedViews?: WorkspaceSavedView[];
  sidebarCollapsed: boolean;
  userSettings: UserSettings;
}) {
  return (
    <div className={cn("grid min-h-screen transition-[grid-template-columns] duration-200", sidebarCollapsed ? "lg:grid-cols-[76px_1fr]" : "lg:grid-cols-[260px_1fr]")}>
      <aside className={cn("sticky top-0 hidden h-screen border-r border-[var(--border)] bg-[var(--surface)]/80 backdrop-blur lg:block", sidebarCollapsed ? "p-3" : "p-4")}>
        <div className={cn("mb-6 flex items-center", sidebarCollapsed ? "justify-center" : "gap-3 px-2")}>
          <div className="flex h-11 w-11 items-center justify-center rounded-lg border border-[var(--foreground)] bg-[var(--foreground)] text-lg font-black text-[var(--background)]">
            LL
          </div>
          {!sidebarCollapsed && (
            <>
              <div className="min-w-0 flex-1">
                <p className="text-lg font-black leading-tight">Lucky List</p>
                <p className="text-xs font-semibold text-[var(--muted)]">พื้นที่งานส่วนตัว</p>
              </div>
              <button
                type="button"
                onClick={onToggleSidebar}
                className="focus-ring flex h-10 w-10 items-center justify-center rounded-lg text-[var(--muted)] transition hover:bg-[var(--surface-strong)] hover:text-[var(--foreground)]"
                aria-label="ย่อแถบด้านข้าง"
                title="ย่อแถบด้านข้าง"
              >
                <PanelLeftClose size={18} />
              </button>
            </>
          )}
        </div>
        {sidebarCollapsed && (
          <button
            type="button"
            onClick={onToggleSidebar}
            className="focus-ring mb-4 flex h-10 w-full items-center justify-center rounded-lg text-[var(--muted)] transition hover:bg-[var(--surface-strong)] hover:text-[var(--foreground)]"
            aria-label="ขยายแถบด้านข้าง"
            title="ขยายแถบด้านข้าง"
          >
            <PanelLeftOpen size={18} />
          </button>
        )}
        <nav className="grid gap-1">
          {navItems.map((item) => {
            const Icon = item.icon;
            const active = item.view === activeView;
            return (
              <Link
                key={item.view}
                href={item.href}
                className={cn(
                  "flex min-h-11 items-center rounded-lg text-sm font-bold transition",
                  sidebarCollapsed ? "justify-center px-0" : "gap-3 px-3 py-2.5",
                  active
                    ? "bg-[var(--foreground)] text-[var(--background)]"
                    : "text-[var(--muted)] hover:bg-[var(--surface-strong)] hover:text-[var(--foreground)]",
                )}
                title={item.label}
              >
                <Icon size={18} />
                {!sidebarCollapsed && item.label}
              </Link>
            );
          })}
        </nav>
        {savedViews.length > 0 && (
          <div className={cn("mt-5 border-t border-[var(--border)] pt-4", sidebarCollapsed && "grid justify-items-center")}>
            {!sidebarCollapsed && <p className="mb-2 px-3 text-[11px] font-black text-[var(--muted)]">มุมมองลัด</p>}
            <div className="grid gap-1">
              {savedViews.map((view) => {
                const Icon = view.icon;
                return (
                  <button
                    key={view.label}
                    type="button"
                    onClick={() => onOpenSavedView?.(view)}
                    className={cn(
                      "focus-ring flex min-h-10 items-center rounded-lg text-left text-xs font-bold text-[var(--muted)] transition hover:bg-[var(--surface-strong)] hover:text-[var(--foreground)]",
                      sidebarCollapsed ? "w-10 justify-center px-0" : "w-full gap-2 px-3",
                    )}
                    title={`${view.label}: ${view.detail}`}
                  >
                    <Icon size={15} />
                    {!sidebarCollapsed && (
                      <>
                        <span className="min-w-0 flex-1 truncate">{view.label}</span>
                        <span className="rounded-md border border-[var(--border)] px-1.5 py-0.5 text-[10px] font-black">{view.count}</span>
                      </>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        )}
        {!sidebarCollapsed ? (
          <Panel className="mt-6 p-3">
            <div className="flex items-center gap-2 text-sm font-black">
              <CloudStatusIcon state={cloudState} size={17} />
              สถานะข้อมูล
            </div>
            <p className="mt-2 text-xs leading-5 text-[var(--muted)]">{cloudMessage}</p>
            <Button variant="secondary" className="mt-3 w-full" onClick={onRefreshCloud}>
              <RefreshCcw size={15} />
              อัปเดตข้อมูล
            </Button>
          </Panel>
        ) : (
          <button
            type="button"
            onClick={onRefreshCloud}
            className="focus-ring mt-6 flex h-11 w-full items-center justify-center rounded-lg border border-[var(--border)] text-[var(--muted)] transition hover:bg-[var(--surface-strong)] hover:text-[var(--foreground)]"
            aria-label="อัปเดตข้อมูล"
            title={cloudMessage}
          >
            <CloudStatusIcon state={cloudState} size={18} />
          </button>
        )}
      </aside>

      <main className="min-w-0 pb-24 lg:pb-0">
        <header className="sticky top-0 z-30 border-b border-[var(--border)] bg-[var(--background)]/88 px-3 py-2.5 backdrop-blur md:px-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-xs font-bold uppercase text-[var(--muted)]">Lucky List</p>
              <h1 className="text-xl font-black md:text-2xl">{navItems.find((item) => item.view === activeView)?.label}</h1>
            </div>
            <div className="flex items-center gap-2">
              <div className="hidden items-center gap-2 rounded-lg border border-[var(--border)] px-3 py-2 text-xs font-semibold text-[var(--muted)] md:flex">
                <CloudStatusIcon state={cloudState} size={15} />
                {cloudMessage}
              </div>
              <Button variant="secondary" onClick={onOpenCommand} className="px-3" title="คำสั่ง">
                <Command size={17} />
                <span className="hidden md:inline">คำสั่ง</span>
              </Button>
              <Button variant="secondary" onClick={onOpenNotifications} className="relative px-3" title="ศูนย์แจ้งเตือน">
                <Bell size={17} />
                {Boolean(notificationCount) && (
                  <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-[var(--danger)] px-1 text-[10px] font-black text-white">
                    {Math.min(notificationCount ?? 0, 99)}
                  </span>
                )}
              </Button>
              <Button variant="secondary" onClick={onToggleTheme} className="px-3">
                {userSettings.theme === "dark" ? <Sun size={17} /> : <Moon size={17} />}
              </Button>
              <Button onClick={onCreate}>
                <CirclePlus size={17} />
                <span className="hidden sm:inline">งานใหม่</span>
              </Button>
              <Button variant="ghost" onClick={onSignOut} className="px-3">
                <LogOut size={17} />
              </Button>
            </div>
          </div>
        </header>

        <div className="mx-auto grid max-w-none gap-4 p-3 md:p-4 xl:p-5">{children}</div>
      </main>
    </div>
  );
}
