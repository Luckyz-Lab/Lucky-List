"use client";

import { Check, Plus, SlidersHorizontal, Trash2, X } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import type { BoardState, RepeatFrequency, Subtask, Task, TaskPriority } from "@/lib/types";
import { boardLabel, categoryLabel, nowIso, priorityLabel, uid } from "@/lib/utils";

const priorities: TaskPriority[] = ["Low", "Normal", "High", "Urgent"];
const boards: BoardState[] = ["todo", "wip", "done"];
const repeats: RepeatFrequency[] = ["none", "daily", "weekly", "monthly"];
const repeatLabels: Record<RepeatFrequency, string> = {
  none: "ไม่ทำซ้ำ",
  daily: "ทุกวัน",
  weekly: "ทุกสัปดาห์",
  monthly: "ทุกเดือน",
};

function toDateTimeLocal(value?: string | null) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const offset = date.getTimezoneOffset() * 60000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 16);
}

export function TaskModal(props: {
  task?: Task | null;
  initialDate?: string | null;
  categories: string[];
  open: boolean;
  onClose: () => void;
  onSave: (task: Partial<Task> & Pick<Task, "title">) => Promise<void>;
}) {
  if (!props.open) return null;
  return <TaskModalForm key={props.task?.id ?? props.initialDate ?? "new"} {...props} />;
}

function TaskModalForm({
  task,
  initialDate,
  categories,
  onClose,
  onSave,
}: {
  task?: Task | null;
  initialDate?: string | null;
  categories: string[];
  open: boolean;
  onClose: () => void;
  onSave: (task: Partial<Task> & Pick<Task, "title">) => Promise<void>;
}) {
  const modalCategories = Array.from(new Set(["Inbox", "Someday", ...categories]));
  const [title, setTitle] = useState(task?.title ?? "");
  const [notes, setNotes] = useState(task?.notes ?? "");
  const [category, setCategory] = useState(task?.category ?? (modalCategories.includes("Inbox") ? "Inbox" : modalCategories[0]) ?? "Inbox");
  const [priority, setPriority] = useState<TaskPriority>(task?.priority ?? "Normal");
  const [boardState, setBoardState] = useState<BoardState>(task?.boardState ?? "todo");
  const [progress, setProgress] = useState(task?.progress ?? 0);
  const [dueAt, setDueAt] = useState(task?.dueAt?.slice(0, 10) ?? initialDate ?? "");
  const [reminderAt, setReminderAt] = useState(toDateTimeLocal(task?.reminderAt));
  const [repeat, setRepeat] = useState<RepeatFrequency>(task?.repeatRule.frequency ?? "none");
  const [subtasks, setSubtasks] = useState<Subtask[]>(task?.subtasks ?? []);
  const [subtaskTitle, setSubtaskTitle] = useState("");
  const [advancedOpen, setAdvancedOpen] = useState(Boolean(task?.reminderAt || task?.repeatRule.frequency !== "none" || task?.subtasks.length));
  const [error, setError] = useState("");
  const completedSubtasks = subtasks.filter((subtask) => subtask.progress >= 100 && !subtask.deletedAt).length;
  const computedProgress = subtasks.length ? Math.round((completedSubtasks / subtasks.length) * 100) : progress;

  function addSubtask() {
    if (!subtaskTitle.trim()) return;
    setSubtasks((items) => [
      ...items,
      {
        id: uid("subtask"),
        taskId: task?.id ?? "",
        title: subtaskTitle.trim(),
        progress: 0,
        position: items.length,
        completedAt: null,
        deletedAt: null,
        updatedAt: nowIso(),
      },
    ]);
    setSubtaskTitle("");
  }

  async function submit() {
    if (!title.trim()) return;
    setError("");
    const finalProgress = subtasks.length ? computedProgress : progress;
    try {
      await onSave({
        ...task,
        title,
        notes,
        category,
        priority,
        boardState,
        progress: finalProgress,
        completedAt: finalProgress >= 100 ? task?.completedAt ?? nowIso() : null,
        dueAt: dueAt || null,
        reminderAt: reminderAt ? new Date(reminderAt).toISOString() : null,
        repeatRule: { frequency: repeat },
        subtasks: subtasks.map((subtask, index) => ({
          ...subtask,
          taskId: task?.id ?? subtask.taskId,
          position: index,
          completedAt: subtask.progress >= 100 ? subtask.completedAt ?? nowIso() : null,
          updatedAt: nowIso(),
        })),
      });
      onClose();
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "บันทึกงานไม่สำเร็จ");
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/55 p-0 backdrop-blur-sm">
      <button type="button" className="hidden flex-1 lg:block" onClick={onClose} aria-label="ปิดหน้าต่างแก้งาน" />
      <div className="app-surface flex h-dvh w-full max-w-2xl flex-col overflow-hidden rounded-none border-l border-[var(--border)] bg-[var(--surface)] shadow-2xl transition-transform duration-200 lg:max-w-[720px]">
        <div className="flex items-center justify-between border-b border-[var(--border)] px-5 py-4">
          <div>
            <h2 className="text-lg font-black">{task ? "แก้ไขงาน" : "งานใหม่"}</h2>
            <p className="text-xs text-[var(--muted)]">ใส่แค่สิ่งที่จำเป็นก่อน รายละเอียดอื่นค่อยเพิ่มทีหลังได้</p>
          </div>
          <button onClick={onClose} className="focus-ring rounded-lg p-2 text-[var(--muted)] hover:bg-[var(--surface-strong)]" aria-label="ปิด">
            <X size={18} />
          </button>
        </div>

        <div className="grid gap-4 overflow-y-auto p-5">
          <label className="grid gap-1 text-sm font-semibold">
            ชื่องาน
            <input className="focus-ring rounded-lg border border-[var(--border)] bg-transparent px-3 py-2" value={title} onChange={(event) => setTitle(event.target.value)} autoFocus />
          </label>

          {error && <p className="rounded-lg border border-[var(--danger)] bg-[color-mix(in_oklab,var(--danger)_8%,transparent)] px-3 py-2 text-sm font-semibold text-[var(--danger)]">{error}</p>}

          <label className="grid gap-1 text-sm font-semibold">
            รายละเอียด
            <textarea className="focus-ring min-h-20 rounded-lg border border-[var(--border)] bg-transparent px-3 py-2" value={notes} onChange={(event) => setNotes(event.target.value)} />
          </label>

          <div className="grid gap-3 md:grid-cols-4">
            <label className="grid gap-1 text-sm font-semibold">
              หมวดหมู่
              <select className="focus-ring rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2" value={category} onChange={(event) => setCategory(event.target.value)}>
                {modalCategories.map((item) => (
                  <option key={item} value={item}>
                    {categoryLabel(item)}
                  </option>
                ))}
              </select>
            </label>
            <label className="grid gap-1 text-sm font-semibold">
              ความสำคัญ
              <select className="focus-ring rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2" value={priority} onChange={(event) => setPriority(event.target.value as TaskPriority)}>
                {priorities.map((item) => (
                  <option key={item} value={item}>{priorityLabel(item)}</option>
                ))}
              </select>
            </label>
            <label className="grid gap-1 text-sm font-semibold">
              สถานะ
              <select className="focus-ring rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2" value={boardState} onChange={(event) => setBoardState(event.target.value as BoardState)}>
                {boards.map((item) => (
                  <option key={item} value={item}>
                    {boardLabel(item)}
                  </option>
                ))}
              </select>
            </label>
            <label className="grid gap-1 text-sm font-semibold">
              กำหนดส่ง
              <input type="date" className="focus-ring rounded-lg border border-[var(--border)] bg-transparent px-3 py-2" value={dueAt} onChange={(event) => setDueAt(event.target.value)} />
            </label>
          </div>

          <div className="rounded-lg border border-[var(--border)] p-3">
            <div className="flex items-center justify-between gap-3 text-sm font-semibold">
              <span>ความคืบหน้า</span>
              <span className="font-black">{computedProgress}%</span>
            </div>
            <div className="mt-2 h-2 overflow-hidden rounded-full bg-[var(--surface-strong)]">
              <div className="h-full rounded-full bg-[var(--foreground)] transition-all duration-200" style={{ width: `${computedProgress}%` }} />
            </div>
            {!subtasks.length && (
              <input className="mt-3 w-full" type="range" min={0} max={100} step={5} value={progress} onChange={(event) => setProgress(Number(event.target.value))} />
            )}
            {subtasks.length > 0 && <p className="mt-2 text-xs font-semibold text-[var(--muted)]">เสร็จแล้ว {completedSubtasks} จาก {subtasks.length} งานย่อย</p>}
          </div>

          <button type="button" onClick={() => setAdvancedOpen((value) => !value)} className="focus-ring flex min-h-10 items-center justify-between rounded-lg border border-[var(--border)] px-3 text-sm font-black transition hover:bg-[var(--surface-strong)]">
            <span className="flex items-center gap-2">
              <SlidersHorizontal size={16} />
              รายละเอียดเพิ่มเติม
            </span>
            <span className="text-xs text-[var(--muted)]">{advancedOpen ? "ซ่อน" : `${subtasks.length} งานย่อย / เตือน / ทำซ้ำ`}</span>
          </button>

          {advancedOpen && (
            <>
              <div className="grid gap-3 md:grid-cols-2">
                <label className="grid gap-1 text-sm font-semibold">
                  เตือน
                  <input type="datetime-local" className="focus-ring rounded-lg border border-[var(--border)] bg-transparent px-3 py-2" value={reminderAt} onChange={(event) => setReminderAt(event.target.value)} />
                </label>
                <label className="grid gap-1 text-sm font-semibold">
                  ทำซ้ำ
                  <select className="focus-ring rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2" value={repeat} onChange={(event) => setRepeat(event.target.value as RepeatFrequency)}>
                    {repeats.map((item) => (
                      <option key={item} value={item}>
                        {repeatLabels[item]}
                      </option>
                    ))}
                  </select>
                </label>
              </div>

              <div className="rounded-lg border border-[var(--border)] p-3">
                <div className="mb-3 flex items-center justify-between">
                  <h3 className="text-sm font-black">งานย่อย</h3>
                  <span className="text-xs text-[var(--muted)]">{subtasks.length} รายการ</span>
                </div>
                <div className="flex gap-2">
                  <input className="focus-ring flex-1 rounded-lg border border-[var(--border)] bg-transparent px-3 py-2 text-sm" value={subtaskTitle} onChange={(event) => setSubtaskTitle(event.target.value)} placeholder="เพิ่มงานย่อย..." />
                  <Button type="button" onClick={addSubtask} className="px-3">
                    <Plus size={16} />
                  </Button>
                </div>
                <div className="mt-3 grid gap-2">
                  {subtasks.map((subtask) => (
                    <div key={subtask.id} className="grid gap-2 rounded-lg bg-[var(--surface-strong)] p-3">
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() =>
                            setSubtasks((items) =>
                              items.map((item) =>
                                item.id === subtask.id
                                  ? {
                                      ...item,
                                      progress: item.progress >= 100 ? 0 : 100,
                                      completedAt: item.progress >= 100 ? null : nowIso(),
                                    }
                                  : item,
                              ),
                            )
                          }
                          className={`focus-ring flex h-6 w-6 shrink-0 items-center justify-center rounded-full border transition ${subtask.progress >= 100 ? "border-[var(--success)] bg-[var(--success)] text-white" : "border-[var(--border)] text-transparent hover:border-[var(--foreground)] hover:text-[var(--foreground)]"}`}
                          aria-label={subtask.progress >= 100 ? "ทำเครื่องหมายว่ายังไม่เสร็จ" : "ทำเครื่องหมายว่าเสร็จแล้ว"}
                        >
                          <Check size={13} strokeWidth={3} />
                        </button>
                        <input className="focus-ring flex-1 bg-transparent text-sm font-semibold" value={subtask.title} onChange={(event) => setSubtasks((items) => items.map((item) => (item.id === subtask.id ? { ...item, title: event.target.value } : item)))} />
                        <button onClick={() => setSubtasks((items) => items.filter((item) => item.id !== subtask.id))} className="rounded-md p-1 text-[var(--danger)] hover:bg-[color-mix(in_oklab,var(--danger)_8%,transparent)]" aria-label="ลบงานย่อย">
                          <Trash2 size={15} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}
        </div>

        <div className="flex justify-end gap-2 border-t border-[var(--border)] p-4">
          <Button variant="secondary" onClick={onClose}>
            ยกเลิก
          </Button>
          <Button onClick={submit}>บันทึก</Button>
        </div>
      </div>
    </div>
  );
}
