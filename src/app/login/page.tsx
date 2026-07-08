"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { KeyRound, LockKeyhole, Mail, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Panel } from "@/components/ui/panel";
import {
  getCurrentCloudSession,
  sendPasswordReset,
  signInWithPassword,
  signOutCloudAccount,
  signUpWithPassword,
} from "@/lib/auth/cloud";
import {
  hasSavedPin,
  isValidPin,
  resetPin as clearSavedPin,
  savePin,
  unlockPrivateSession,
  verifyPin,
} from "@/lib/auth/pin";

type AuthMode = "sign-in" | "sign-up";

function errorMessage(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : fallback;
}

export default function LoginPage() {
  const router = useRouter();
  const [checkingSession, setCheckingSession] = useState(true);
  const [hasCloudSession, setHasCloudSession] = useState(false);
  const [authMode, setAuthMode] = useState<AuthMode>("sign-in");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [pin, setPin] = useState("");
  const [confirmPin, setConfirmPin] = useState("");
  const [hasPin, setHasPin] = useState(() =>
    typeof window === "undefined" ? false : hasSavedPin(),
  );
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  const pinTitle = useMemo(
    () => (hasPin ? "ใส่ PIN เพื่อเข้า Lucky List" : "ตั้ง PIN สำหรับเครื่องนี้"),
    [hasPin],
  );

  useEffect(() => {
    let cancelled = false;

    async function checkSession() {
      const session = await getCurrentCloudSession();
      if (cancelled) return;
      setHasCloudSession(session.mode === "cloud");
      setCheckingSession(false);
      if (session.mode === "error") {
        setMessage(session.message);
      }
    }

    void checkSession();
    return () => {
      cancelled = true;
    };
  }, []);

  async function submitAccount() {
    setMessage("");
    if (!email.trim() || password.length < 6) {
      setMessage("กรอกอีเมลและรหัสผ่านอย่างน้อย 6 ตัวอักษร");
      return;
    }

    setBusy(true);
    try {
      if (authMode === "sign-in") {
        await signInWithPassword(email, password);
        setHasCloudSession(true);
        setMessage("เข้าสู่บัญชี Supabase แล้ว ต่อไปใส่ PIN เพื่อปลดล็อกเครื่องนี้");
        return;
      }

      const data = await signUpWithPassword(email, password);
      if (data.session) {
        setHasCloudSession(true);
        setMessage("สมัครบัญชีสำเร็จ ต่อไปตั้ง PIN สำหรับเครื่องนี้");
      } else {
        setMessage("สมัครบัญชีแล้ว กรุณายืนยันอีเมลจาก Supabase แล้วกลับมาเข้าสู่ระบบ");
        setAuthMode("sign-in");
      }
    } catch (error) {
      setMessage(errorMessage(error, authMode === "sign-in" ? "เข้าสู่ระบบไม่สำเร็จ" : "สมัครบัญชีไม่สำเร็จ"));
    } finally {
      setBusy(false);
    }
  }

  async function submitPin() {
    setMessage("");
    if (!hasCloudSession) {
      setMessage("ต้องเข้าสู่บัญชี Supabase ก่อนตั้งหรือใส่ PIN");
      return;
    }

    if (!isValidPin(pin)) {
      setMessage("PIN ต้องเป็นตัวเลข 4-8 หลัก");
      return;
    }

    if (!hasPin) {
      if (pin !== confirmPin) {
        setMessage("PIN สองช่องไม่ตรงกัน");
        return;
      }
      await savePin(pin);
      router.push("/app");
      return;
    }

    if (!hasSavedPin()) {
      setHasPin(false);
      setMessage("ยังไม่มี PIN ในเครื่องนี้ กรุณาตั้ง PIN ใหม่");
      return;
    }

    if (!(await verifyPin(pin))) {
      setMessage("PIN ไม่ถูกต้อง");
      return;
    }
    unlockPrivateSession();
    router.push("/app");
  }

  async function resetPassword() {
    setMessage("");
    if (!email.trim()) {
      setMessage("กรอกอีเมลก่อนส่งลิงก์รีเซ็ตรหัสผ่าน");
      return;
    }

    setBusy(true);
    try {
      await sendPasswordReset(email);
      setMessage("ส่งลิงก์รีเซ็ตรหัสผ่านไปที่อีเมลแล้ว");
    } catch (error) {
      setMessage(errorMessage(error, "ส่งลิงก์รีเซ็ตรหัสผ่านไม่สำเร็จ"));
    } finally {
      setBusy(false);
    }
  }

  async function signOutAccount() {
    setBusy(true);
    try {
      clearSavedPin();
      await signOutCloudAccount();
      setHasCloudSession(false);
      setHasPin(false);
      setPin("");
      setConfirmPin("");
      setPassword("");
      setMessage("ออกจากบัญชี Supabase แล้ว");
    } finally {
      setBusy(false);
    }
  }

  function resetPin() {
    clearSavedPin();
    setPin("");
    setConfirmPin("");
    setHasPin(false);
    setMessage("ลบ PIN เดิมแล้ว ตั้ง PIN ใหม่ได้เลย");
  }

  if (checkingSession) {
    return (
      <main className="grid min-h-screen place-items-center bg-[var(--background)] p-4">
        <Panel className="w-full max-w-md p-6 text-center">
          <ShieldCheck className="mx-auto mb-3 animate-pulse text-[var(--foreground)]" size={36} />
          <p className="text-sm font-semibold text-[var(--muted)]">กำลังตรวจสอบบัญชี Supabase...</p>
        </Panel>
      </main>
    );
  }

  return (
    <main className="grid min-h-screen place-items-center bg-[var(--background)] p-4">
      <Panel className="w-full max-w-md p-6">
        <div className="mb-6 text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-lg border border-[var(--foreground)] bg-[var(--foreground)] text-[var(--background)]">
            <ShieldCheck size={28} />
          </div>
          <h1 className="text-2xl font-black">
            {hasCloudSession ? pinTitle : authMode === "sign-in" ? "เข้าสู่บัญชี Lucky List" : "สมัครบัญชี Lucky List"}
          </h1>
          <p className="mt-2 text-sm leading-6 text-[var(--muted)]">
            {hasCloudSession
              ? "บัญชี Supabase เชื่อมต่อแล้ว ใช้ PIN เป็นตัวล็อกหน้าจอของเครื่องนี้"
              : "ใช้บัญชี Supabase จริงเพื่อเก็บข้อมูลบนคลาวด์ ย้ายเครื่องได้ และปลอดภัยกว่าโหมดไม่ระบุตัวตน"}
          </p>
        </div>

        {!hasCloudSession ? (
          <div className="grid gap-3">
            <label className="grid gap-1 text-sm font-bold">
              อีเมล
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--muted)]" size={16} />
                <input
                  className="focus-ring w-full rounded-lg border border-[var(--border)] bg-transparent py-2 pl-10 pr-3 text-sm font-semibold"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") void submitAccount();
                  }}
                  type="email"
                  autoComplete="email"
                  placeholder="you@example.com"
                />
              </div>
            </label>

            <label className="grid gap-1 text-sm font-bold">
              รหัสผ่าน
              <div className="relative">
                <LockKeyhole className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--muted)]" size={16} />
                <input
                  className="focus-ring w-full rounded-lg border border-[var(--border)] bg-transparent py-2 pl-10 pr-3 text-sm font-semibold"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") void submitAccount();
                  }}
                  type="password"
                  autoComplete={authMode === "sign-in" ? "current-password" : "new-password"}
                  placeholder="อย่างน้อย 6 ตัวอักษร"
                />
              </div>
            </label>

            {message && <p className="rounded-lg border border-[var(--warning)] bg-[color-mix(in_oklab,var(--warning)_8%,transparent)] p-3 text-sm font-semibold text-[var(--warning)]">{message}</p>}

            <Button onClick={() => void submitAccount()} disabled={busy}>
              {authMode === "sign-in" ? "เข้าสู่ระบบ" : "สมัครบัญชี"}
            </Button>

            <div className="grid gap-2 text-center text-sm">
              <button
                type="button"
                className="font-bold text-[var(--muted)] transition hover:text-[var(--foreground)]"
                onClick={() => {
                  setAuthMode(authMode === "sign-in" ? "sign-up" : "sign-in");
                  setMessage("");
                }}
              >
                {authMode === "sign-in" ? "ยังไม่มีบัญชี? สมัครบัญชีใหม่" : "มีบัญชีแล้ว? กลับไปเข้าสู่ระบบ"}
              </button>
              <button type="button" className="font-bold text-[var(--muted)] transition hover:text-[var(--foreground)]" onClick={() => void resetPassword()} disabled={busy}>
                ลืมรหัสผ่าน
              </button>
            </div>
          </div>
        ) : (
          <div className="grid gap-3">
            <label className="grid gap-1 text-sm font-bold">
              PIN
              <div className="relative">
                <LockKeyhole className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--muted)]" size={16} />
                <input
                  className="focus-ring w-full rounded-lg border border-[var(--border)] bg-transparent py-2 pl-10 pr-3 text-center text-lg font-black tracking-[0.22em]"
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
                ยืนยัน PIN
                <div className="relative">
                  <KeyRound className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--muted)]" size={16} />
                  <input
                    className="focus-ring w-full rounded-lg border border-[var(--border)] bg-transparent py-2 pl-10 pr-3 text-center text-lg font-black tracking-[0.22em]"
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

            <Button onClick={() => void submitPin()} disabled={busy}>
              {hasPin ? "ปลดล็อก" : "ตั้ง PIN"}
            </Button>

            <div className="grid gap-2">
              {hasPin && (
                <Button variant="ghost" onClick={resetPin} disabled={busy}>
                  ลืม PIN / ตั้งใหม่ในเครื่องนี้
                </Button>
              )}
              <Button variant="secondary" onClick={() => void signOutAccount()} disabled={busy}>
                ออกจากบัญชี Supabase
              </Button>
            </div>

            <p className="text-center text-xs leading-5 text-[var(--muted)]">
              PIN เก็บเฉพาะในเบราว์เซอร์นี้ ถ้าย้ายเครื่องให้เข้าสู่บัญชี Supabase ใหม่ แล้วตั้ง PIN ใหม่บนเครื่องนั้น
            </p>
          </div>
        )}
      </Panel>
    </main>
  );
}
