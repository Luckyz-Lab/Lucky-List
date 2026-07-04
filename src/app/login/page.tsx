"use client";

import { useRouter } from "next/navigation";
import { LockKeyhole, Mail, ShieldCheck } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Panel } from "@/components/ui/panel";
import { createClient, hasSupabaseEnv } from "@/lib/supabase/client";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  async function signIn(mode: "signin" | "signup") {
    setLoading(true);
    setMessage("");
    const client = createClient();
    if (!client) {
      setMessage("ยังไม่ได้ตั้งค่า Supabase env ใช้โหมดส่วนตัวในเครื่องได้ก่อน");
      setLoading(false);
      return;
    }
    const result =
      mode === "signin"
        ? await client.auth.signInWithPassword({ email, password })
        : await client.auth.signUp({ email, password });
    setLoading(false);
    if (result.error) {
      setMessage(result.error.message);
      return;
    }
    router.push("/app");
  }

  function localMode() {
    localStorage.setItem("lucky_private_session", "true");
    router.push("/app");
  }

  return (
    <main className="grid min-h-screen place-items-center bg-[var(--background)] p-4">
      <Panel className="w-full max-w-md p-6">
        <div className="mb-6 text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-lg bg-indigo-600 text-white">
            <ShieldCheck size={28} />
          </div>
          <h1 className="text-2xl font-black">เข้าสู่ Lucky List</h1>
          <p className="mt-2 text-sm text-[var(--muted)]">
            Supabase Auth สำหรับ sync ข้ามเครื่อง หรือใช้โหมดส่วนตัวในเครื่องก่อน
          </p>
        </div>
        <div className="grid gap-3">
          <label className="grid gap-1 text-sm font-bold">
            Email
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--muted)]" size={16} />
              <input className="focus-ring w-full rounded-lg border border-[var(--border)] bg-transparent py-2 pl-10 pr-3" value={email} onChange={(event) => setEmail(event.target.value)} type="email" placeholder="you@example.com" />
            </div>
          </label>
          <label className="grid gap-1 text-sm font-bold">
            Password
            <div className="relative">
              <LockKeyhole className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--muted)]" size={16} />
              <input className="focus-ring w-full rounded-lg border border-[var(--border)] bg-transparent py-2 pl-10 pr-3" value={password} onChange={(event) => setPassword(event.target.value)} type="password" placeholder="อย่างน้อย 6 ตัวอักษร" />
            </div>
          </label>
          {message && <p className="rounded-lg bg-amber-500/10 p-3 text-sm font-semibold text-amber-500">{message}</p>}
          <div className="grid gap-2 sm:grid-cols-2">
            <Button disabled={loading || !email || !password || !hasSupabaseEnv()} onClick={() => signIn("signin")}>
              Login
            </Button>
            <Button variant="secondary" disabled={loading || !email || !password || !hasSupabaseEnv()} onClick={() => signIn("signup")}>
              Sign up
            </Button>
          </div>
          <Button variant="ghost" onClick={localMode}>
            ใช้โหมดส่วนตัวในเครื่อง
          </Button>
          {!hasSupabaseEnv() && (
            <p className="text-center text-xs text-[var(--muted)]">
              เพิ่ม `NEXT_PUBLIC_SUPABASE_URL` และ `NEXT_PUBLIC_SUPABASE_ANON_KEY` ใน `.env.local` เพื่อเปิด login/sync จริง
            </p>
          )}
        </div>
      </Panel>
    </main>
  );
}
