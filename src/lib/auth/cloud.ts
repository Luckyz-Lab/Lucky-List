import type { SupabaseClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/client";
import type { Database } from "@/lib/supabase/database.types";

export type CloudSessionState =
  | {
      mode: "cloud";
      client: SupabaseClient<Database>;
      userId: string;
      isAnonymous: boolean;
      message: string;
    }
  | {
      mode: "local-preview";
      client: null;
      userId: null;
      isAnonymous: false;
      message: string;
    }
  | {
      mode: "error";
      client: SupabaseClient<Database> | null;
      userId: null;
      isAnonymous: false;
      message: string;
    };

export function getCloudClient() {
  return createClient();
}

export async function getCurrentCloudSession(): Promise<CloudSessionState> {
  const client = createClient();
  if (!client) {
    return {
      mode: "error",
      client: null,
      userId: null,
      isAnonymous: false,
      message: "ยังไม่ได้ตั้งค่า Supabase ใน .env.local",
    };
  }

  const current = await client.auth.getSession();
  if (!current.data.session?.user.id) {
    return {
      mode: "error",
      client,
      userId: null,
      isAnonymous: false,
      message: "กรุณาเข้าสู่บัญชี Supabase ก่อนใช้งาน Lucky List",
    };
  }

  if (current.data.session.user.is_anonymous) {
    await client.auth.signOut();
    return {
      mode: "error",
      client,
      userId: null,
      isAnonymous: false,
      message: "กรุณาเข้าสู่บัญชี Supabase ด้วยอีเมล แทนบัญชีไม่ระบุตัวตน",
    };
  }

  return {
    mode: "cloud",
    client,
    userId: current.data.session.user.id,
    isAnonymous: false,
    message: "เชื่อมต่อบัญชี Supabase แล้ว",
  };
}

export async function ensureCloudSession(): Promise<CloudSessionState> {
  return getCurrentCloudSession();
}

export async function signInWithPassword(email: string, password: string) {
  const client = createClient();
  if (!client) throw new Error("ยังไม่ได้ตั้งค่า Supabase ใน .env.local");

  const result = await client.auth.signInWithPassword({
    email: email.trim(),
    password,
  });

  if (result.error) throw new Error(result.error.message);
  if (!result.data.session) throw new Error("เข้าสู่ระบบไม่สำเร็จ กรุณาลองอีกครั้ง");
  return result.data.session;
}

export async function signUpWithPassword(email: string, password: string) {
  const client = createClient();
  if (!client) throw new Error("ยังไม่ได้ตั้งค่า Supabase ใน .env.local");

  const result = await client.auth.signUp({
    email: email.trim(),
    password,
  });

  if (result.error) throw new Error(result.error.message);
  return result.data;
}

export async function sendPasswordReset(email: string) {
  const client = createClient();
  if (!client) throw new Error("ยังไม่ได้ตั้งค่า Supabase ใน .env.local");

  const result = await client.auth.resetPasswordForEmail(email.trim(), {
    redirectTo: typeof window === "undefined" ? undefined : `${window.location.origin}/login`,
  });

  if (result.error) throw new Error(result.error.message);
}

export async function signOutCloudAccount() {
  const client = createClient();
  if (!client) return;
  await client.auth.signOut();
}
