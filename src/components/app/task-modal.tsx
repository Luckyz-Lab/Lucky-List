"use client";

import { Plus, Trash2, X } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import type { BoardState, RepeatFrequency, Subtask, Task, TaskPriority } from "@/lib/types";
import { nowIso, uid } from "@/lib/utils";

const priorities: TaskPriority[] = ["Low", "Normal", "High", "Urgent"];
const boards: BoardState[] = ["todo", "wip", "done"];
const repeats: RepeatFrequency[] = ["none", "daily", "weekly", "monthly"];

export function TaskModal(props: {
  task?: Task | null;
  categories: string[];
  open: boolean;
  onClose: () => void;
  onSave: (task: Partial<Task> & Pick<Task, "title">) => Promise<void>;
}) {
  if (!props.open) return null;
  return <TaskModalForm key={props.task?.id ?? "new"} {...props} />;
}

function TaskModalForm({
  task,
  categories,
  onClose,
  onSave,
}: {
  task?: Task | null;
  categories: string[];
  open: boolean;
  onClose: () => void;
  onSave: (task: Partial<Task> & Pick<Task, "title">) => Promise<void>;
}) {
  const [title, setTitle] = useState(task?.title ?? "");
  const [notes, setNotes] = useState(task?.notes ?? "");
  const [category, setCategory] = useState(task?.category ?? categories[0] ?? "");
  const [priority, setPriority] = useState<TaskPriority>(task?.priority ?? "Normal");
  const [boardState, setBoardState] = useState<BoardState>(task?.boardState ?? "todo");
  const [progress, setProgress] = useState(task?.progress ?? 0);
  const [dueAt, setDueAt] = useState(task?.dueAt?.slice(0, 10) ?? "");
  const [repeat, setRepeat] = useState<RepeatFrequency>(task?.repeatRule.frequency ?? "none");
  const [subtasks, setSubtasks] = useState<Subtask[]>(task?.subtasks ?? []);
  const [subtaskTitle, setSubtaskTitle] = useState("");

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
    await onSave({
      ...task,
      title,
      notes,
      category,
      priority,
      boardState,
      progress,
      dueAt: dueAt || null,
      repeatRule: { frequency: repeat },
      subtasks: subtasks.map((subtask, index) => ({
        ...subtask,
        taskId: task?.id ?? subtask.taskId,
        position: index,
        updatedAt: nowIso(),
      })),
    });
    onClose();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 p-3 backdrop-blur">
      <div className="app-surface flex max-h-[92vh] w-full max-w-2xl flex-col overflow-hidden rounded-lg bg-[var(--surface)]">
        <div className="flex items-center justify-between border-b border-[var(--border)] px-5 py-4">
          <div>
            <h2 className="text-lg font-black">{task ? "แก้ไขงาน" : "สร้างงานใหม่"}</h2>
            <p className="text-xs text-[var(--muted)]">ข้อมูลจะถูกบันทึกลง IndexedDB ก่อน แล้ว sync ภายหลัง</p>
          </div>
          <button onClick={onClose} className="focus-ring rounded-lg p-2 text-[var(--muted)] hover:bg-[var(--surface-strong)]">
            <X size={18} />
          </button>
        </div>
        <div className="grid gap-4 overflow-y-auto p-5">
          <label className="grid gap-1 text-sm font-semibold">
            ชื่องาน
            <input className="focus-ring rounded-lg border border-[var(--border)] bg-transparent px-3 py-2" value={title} onChange={(event) => setTitle(event.target.value)} />
          </label>
          <label className="grid gap-1 text-sm font-semibold">
            รายละเอียด
            <textarea className="focus-ring min-h-20 rounded-lg border border-[var(--border)] bg-transparent px-3 py-2" value={notes} onChange={(event) => setNotes(event.target.value)} />
          </label>
          <div className="grid gap-3 md:grid-cols-4">
            <label className="grid gap-1 text-sm font-semibold">
              หมวดหมู่
              <select className="focus-ring rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2" value={category} onChange={(event) => setCategory(event.target.value)}>
                {categories.map((item) => (
                  <option key={item} value={item}>
                    {item}
                  </option>
                ))}
              </select>
            </label>
            <label className="grid gap-1 text-sm font-semibold">
              ความสำคัญ
              <select className="focus-ring rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2" value={priority} onChange={(event) => setPriority(event.target.value as TaskPriority)}>
                {priorities.map((item) => (
                  <option key={item}>{item}</option>
                ))}
              </select>
            </label>
            <label className="grid gap-1 text-sm font-semibold">
              Board
              <select className="focus-ring rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2" value={boardState} onChange={(event) => setBoardState(event.target.value as BoardState)}>
                {boards.map((item) => (
                  <option key={item} value={item}>
                    {item.toUpperCase()}
                  </option>
                ))}
              </select>
            </label>
            <label className="grid gap-1 text-sm font-semibold">
              กำหนดส่ง
              <input type="date" className="focus-ring rounded-lg border border-[var(--border)] bg-transparent px-3 py-2" value={dueAt} onChange={(event) => setDueAt(event.target.value)} />
            </label>
          </div>
          <div className="grid gap-3 md:grid-cols-[1fr_180px]">
            <label className="grid gap-2 text-sm font-semibold">
              ความคืบหน้า {progress}%
              <input type="range" min={0} max={100} step={5} value={progress} onChange={(event) => setProgress(Number(event.target.value))} />
            </label>
            <label className="grid gap-1 text-sm font-semibold">
              ทำซ้ำ
              <select className="focus-ring rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2" value={repeat} onChange={(event) => setRepeat(event.target.value as RepeatFrequency)}>
                {repeats.map((item) => (
                  <option key={item} value={item}>
                    {item}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <div className="rounded-lg border border-[var(--border)] p-3">
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-sm font-black">Subtasks</h3>
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
                    <input className="focus-ring flex-1 bg-transparent text-sm font-semibold" value={subtask.title} onChange={(event) => setSubtasks((items) => items.map((item) => (item.id === subtask.id ? { ...item, title: event.target.value } : item)))} />
                    <button onClick={() => setSubtasks((items) => items.filter((item) => item.id !== subtask.id))} className="rounded-md p-1 text-rose-400 hover:bg-rose-500/10">
                      <Trash2 size={15} />
                    </button>
                  </div>
                  <input type="range" min={0} max={100} step={5} value={subtask.progress} onChange={(event) => setSubtasks((items) => items.map((item) => (item.id === subtask.id ? { ...item, progress: Number(event.target.value) } : item)))} />
                </div>
              ))}
            </div>
          </div>
        </div>
        <div className="flex justify-end gap-2 border-t border-[var(--border)] p-4">
          <Button variant="secondary" onClick={onClose}>
            ยกเลิก
          </Button>
          <Button onClick={submit}>บันทึกงาน</Button>
        </div>
      </div>
    </div>
  );
}
