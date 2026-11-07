import "server-only";
import { getAuthenticatedUser } from "@/lib/supabase/auth-context";
export type WorkSettings = { default_work_start: string; default_work_end: string; daily_capacity_minutes: number; default_focus_minutes: number; default_break_minutes: number; daily_max_important_tasks: number; allow_weekend: boolean; retention_completed_days: number; updated_at: string | null };
export const defaultWorkSettings: WorkSettings = { default_work_start: "18:00", default_work_end: "21:00", daily_capacity_minutes: 180, default_focus_minutes: 25, default_break_minutes: 5, daily_max_important_tasks: 3, allow_weekend: true, retention_completed_days: 30, updated_at: null };
export async function loadSettings() {
  const { supabase, userId, email } = await getAuthenticatedUser();
  const { data, error } = await supabase.from("settings").select("default_work_start,default_work_end,daily_capacity_minutes,default_focus_minutes,default_break_minutes,daily_max_important_tasks,allow_weekend,retention_completed_days,updated_at").eq("user_id", userId).maybeSingle();
  return { email, settings: data ? { ...data, default_work_start: data.default_work_start.slice(0, 5), default_work_end: data.default_work_end.slice(0, 5) } as WorkSettings : defaultWorkSettings, error: error ? "โหลดการตั้งค่าไม่สำเร็จ กรุณาลองอีกครั้ง" : null };
}
