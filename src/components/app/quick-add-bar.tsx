"use client";

import { Keyboard, Plus, Sparkles } from "lucide-react";
import { FormEvent, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Panel } from "@/components/ui/panel";
import { parseQuickAdd } from "@/lib/quick-add";

export function QuickAddBar({ onQuickAdd, className = "" }: { onQuickAdd: (text: string) => Promise<unknown>; className?: string }) {
  const [value, setValue] = useState("");
  const [saving, setSaving] = useState(false);
  const preview = useMemo(() => parseQuickAdd(value), [value]);
  const examples = ["ส่งรายงาน tomorrow 10:00 high #งาน", "ทบทวนงาน friday #รีวิว", "ร่างข้อเสนอ !! #งาน wip"];

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!value.trim() || saving) return;
    setSaving(true);
    try {
      await onQuickAdd(value);
      setValue("");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Panel className={`p-3 ${className}`}>
      <form onSubmit={submit} className="grid gap-3 md:grid-cols-[1fr_auto] md:items-center">
        <label className="grid gap-2">
          <span className="flex items-center gap-2 text-sm font-black">
            <Sparkles size={17} className="text-[var(--foreground)]" />
            เพิ่มงานด่วน
          </span>
          <input
            className="focus-ring rounded-lg border border-[var(--border)] bg-transparent px-3 py-2.5 text-sm"
            value={value}
            onChange={(event) => setValue(event.target.value)}
            placeholder="เช่น ส่งรายงาน tomorrow 10:00 high #งาน"
          />
        </label>
        <Button type="submit" disabled={!value.trim() || saving} className="md:self-end">
          <Plus size={16} />
          {saving ? "กำลังบันทึก" : "เพิ่ม"}
        </Button>
      </form>
      <div className="mt-3 flex flex-wrap items-center gap-2 text-xs font-semibold text-[var(--muted)]">
        <Keyboard size={14} />
        <span>ใช้ #หมวดหมู่, high/urgent/!!, today/tomorrow/+3d, เวลา 10:00, daily/weekly/monthly ได้ คีย์ลัด: N งานใหม่, B บอร์ด, F โฟกัส, R รีวิว</span>
      </div>
      {preview?.task.title && (
        <div className="mt-3 flex flex-wrap gap-1.5 rounded-lg border border-[var(--border)] bg-[var(--surface-strong)] p-2 text-xs font-bold">
          <span className="text-[var(--muted)]">ตัวอย่างงาน:</span>
          <span>{preview.task.title}</span>
          {preview.task.category && <span className="rounded-md border border-[var(--border)] px-1.5">#{preview.task.category}</span>}
          {preview.task.dueAt && <span className="rounded-md border border-[var(--border)] px-1.5">due {preview.task.dueAt}</span>}
          {preview.task.priority && <span className="rounded-md border border-[var(--border)] px-1.5">{preview.task.priority}</span>}
          {preview.task.boardState && preview.task.boardState !== "todo" && <span className="rounded-md border border-[var(--border)] px-1.5">{preview.task.boardState.toUpperCase()}</span>}
        </div>
      )}
      <div className="mt-2 flex flex-wrap gap-1.5">
        {examples.map((example) => (
          <button key={example} type="button" onClick={() => setValue(example)} className="focus-ring rounded-md border border-[var(--border)] px-2 py-1 text-xs font-bold text-[var(--muted)] transition hover:bg-[var(--surface-strong)] hover:text-[var(--foreground)]">
            {example}
          </button>
        ))}
      </div>
    </Panel>
  );
}
