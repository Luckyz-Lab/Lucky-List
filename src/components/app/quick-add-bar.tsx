"use client";

import { Keyboard, Plus, Sparkles } from "lucide-react";
import { FormEvent, useState } from "react";
import { Button } from "@/components/ui/button";
import { Panel } from "@/components/ui/panel";

export function QuickAddBar({ onQuickAdd, className = "" }: { onQuickAdd: (text: string) => Promise<unknown>; className?: string }) {
  const [value, setValue] = useState("");
  const [saving, setSaving] = useState(false);

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
    <Panel className={`p-4 ${className}`}>
      <form onSubmit={submit} className="grid gap-3 md:grid-cols-[1fr_auto] md:items-center">
        <label className="grid gap-2">
          <span className="flex items-center gap-2 text-sm font-black">
            <Sparkles size={17} className="text-indigo-500" />
            Quick Add
          </span>
          <input
            className="focus-ring rounded-lg border border-[var(--border)] bg-transparent px-3 py-2.5 text-sm"
            value={value}
            onChange={(event) => setValue(event.target.value)}
            placeholder="Example: Send report tomorrow 10:00 high #Work"
          />
        </label>
        <Button type="submit" disabled={!value.trim() || saving} className="md:self-end">
          <Plus size={16} />
          Add
        </Button>
      </form>
      <div className="mt-3 flex flex-wrap items-center gap-2 text-xs font-semibold text-[var(--muted)]">
        <Keyboard size={14} />
        <span>Use #category, high/urgent/!!, today/tomorrow/+3d, 10:00, daily/weekly/monthly.</span>
      </div>
    </Panel>
  );
}
