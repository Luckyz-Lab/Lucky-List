"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { KeyRound, LockKeyhole, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Panel } from "@/components/ui/panel";

const pinHashKey = "lucky_list_pin_hash";
const pinSaltKey = "lucky_list_pin_salt";
const privateSessionKey = "lucky_private_session";

function bytesToHex(bytes: ArrayBuffer) {
  return Array.from(new Uint8Array(bytes))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

async function hashPin(pin: string, salt: string) {
  const payload = new TextEncoder().encode(`${salt}:${pin}`);
  return bytesToHex(await crypto.subtle.digest("SHA-256", payload));
}

function newSalt() {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return Array.from(bytes)
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

export default function LoginPage() {
  const router = useRouter();
  const [pin, setPin] = useState("");
  const [confirmPin, setConfirmPin] = useState("");
  const [hasPin, setHasPin] = useState(() =>
    typeof window === "undefined" ? false : Boolean(localStorage.getItem(pinHashKey) && localStorage.getItem(pinSaltKey)),
  );
  const [message, setMessage] = useState("");

  const modeLabel = useMemo(() => (hasPin ? "ใส่ PIN เพื่อเข้า Lucky List" : "ตั้ง PIN สำหรับเครื่องนี้"), [hasPin]);

  function validatePin(value: string) {
    return /^\d{4,8}$/.test(value);
  }

  async function submitPin() {
    setMessage("");
    if (!validatePin(pin)) {
      setMessage("PIN ต้องเป็นตัวเลข 4-8 หลัก");
      return;
    }

    if (!hasPin) {
      if (pin !== confirmPin) {
        setMessage("PIN สองช่องไม่ตรงกัน");
        return;
      }
      const salt = newSalt();
      localStorage.setItem(pinSaltKey, salt);
      localStorage.setItem(pinHashKey, await hashPin(pin, salt));
      localStorage.setItem(privateSessionKey, "true");
      router.push("/app");
      return;
    }

    const salt = localStorage.getItem(pinSaltKey);
    const savedHash = localStorage.getItem(pinHashKey);
    if (!salt || !savedHash) {
      setHasPin(false);
      setMessage("ยังไม่มี PIN ในเครื่องนี้ กรุณาตั้ง PIN ใหม่");
      return;
    }

    const inputHash = await hashPin(pin, salt);
    if (inputHash !== savedHash) {
      setMessage("PIN ไม่ถูกต้อง");
      return;
    }
    localStorage.setItem(privateSessionKey, "true");
    router.push("/app");
  }

  function resetPin() {
    localStorage.removeItem(pinHashKey);
    localStorage.removeItem(pinSaltKey);
    localStorage.removeItem(privateSessionKey);
    setPin("");
    setConfirmPin("");
    setHasPin(false);
    setMessage("ลบ PIN เดิมแล้ว ตั้ง PIN ใหม่ได้เลย");
  }

  return (
    <main className="grid min-h-screen place-items-center bg-[var(--background)] p-4">
      <Panel className="w-full max-w-md p-6">
        <div className="mb-6 text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-lg border border-[var(--foreground)] bg-[var(--foreground)] text-[var(--background)]">
            <ShieldCheck size={28} />
          </div>
          <h1 className="text-2xl font-black">{modeLabel}</h1>
          <p className="mt-2 text-sm text-[var(--muted)]">
            ใช้งานแบบส่วนตัวบนเครื่องนี้ ไม่ต้องสมัคร ไม่ต้องรออีเมล ข้อมูลเก็บใน browser และสำรองออกเป็นไฟล์ได้
          </p>
        </div>

        <div className="grid gap-3">
          <label className="grid gap-1 text-sm font-bold">
            PIN
            <div className="relative">
              <LockKeyhole className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--muted)]" size={16} />
              <input
                className="focus-ring w-full rounded-lg border border-[var(--border)] bg-transparent py-2 pl-10 pr-3 text-center text-lg font-black tracking-[0.3em]"
                value={pin}
                onChange={(event) => setPin(event.target.value.replace(/\D/g, "").slice(0, 8))}
                onKeyDown={(event) => {
                  if (event.key === "Enter") void submitPin();
                }}
                type="password"
                inputMode="numeric"
                autoComplete="current-password"
                placeholder="••••"
              />
            </div>
          </label>

          {!hasPin && (
            <label className="grid gap-1 text-sm font-bold">
              Confirm PIN
              <div className="relative">
                <KeyRound className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--muted)]" size={16} />
                <input
                  className="focus-ring w-full rounded-lg border border-[var(--border)] bg-transparent py-2 pl-10 pr-3 text-center text-lg font-black tracking-[0.3em]"
                  value={confirmPin}
                  onChange={(event) => setConfirmPin(event.target.value.replace(/\D/g, "").slice(0, 8))}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") void submitPin();
                  }}
                  type="password"
                  inputMode="numeric"
                  autoComplete="new-password"
                  placeholder="••••"
                />
              </div>
            </label>
          )}

          {message && <p className="rounded-lg border border-[var(--warning)] bg-[color-mix(in_oklab,var(--warning)_8%,transparent)] p-3 text-sm font-semibold text-[var(--warning)]">{message}</p>}

          <Button onClick={() => void submitPin()}>
            {hasPin ? "Unlock" : "Set PIN"}
          </Button>

          {hasPin && (
            <Button variant="ghost" onClick={resetPin}>
              ลืม PIN / ตั้งใหม่ในเครื่องนี้
            </Button>
          )}

          <p className="text-center text-xs leading-5 text-[var(--muted)]">
            PIN นี้กันคนเปิด browser เครื่องเดียวกันเท่านั้น ไม่ใช่ระบบบัญชีออนไลน์ ถ้าล้าง browser data ข้อมูลและ PIN ในเครื่องนี้จะหาย
          </p>
        </div>
      </Panel>
    </main>
  );
}
