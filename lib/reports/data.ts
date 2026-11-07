import "server-only";
import { getAuthenticatedUser } from "@/lib/supabase/auth-context";
function bangkokToday() { return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Bangkok", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date()); }
function shift(date: string, days: number) { return new Date(new Date(`${date}T12:00:00Z`).getTime() + days * 86400000).toISOString().slice(0, 10); }
export async function loadReport() {
  const { supabase, userId } = await getAuthenticatedUser();
  const today = bangkokToday();
  const dates = Array.from({ length: 7 }, (_, index) => shift(today, index - 6));
  const [open, overdue, projectsActive, projectsCompleted, ...daily] = await Promise.all([
    supabase.from("tasks").select("id", { count: "exact", head: true }).eq("user_id", userId).is("archived_at", null).not("status", "in", "(done,cancelled)"),
    supabase.from("tasks").select("id", { count: "exact", head: true }).eq("user_id", userId).is("archived_at", null).not("status", "in", "(done,cancelled)").lt("due_date", today),
    supabase.from("projects").select("id", { count: "exact", head: true }).eq("user_id", userId).eq("status", "active"),
    supabase.from("projects").select("id", { count: "exact", head: true }).eq("user_id", userId).eq("status", "completed"),
    ...dates.map((date) => supabase.from("tasks").select("id", { count: "exact", head: true }).eq("user_id", userId).is("archived_at", null).gte("completed_at", `${date}T00:00:00+07:00`).lt("completed_at", `${shift(date, 1)}T00:00:00+07:00`)),
  ]);
  if ([open, overdue, projectsActive, projectsCompleted, ...daily].some((result) => result.error)) return { error: "โหลดรายงานไม่สำเร็จ กรุณาลองอีกครั้ง", today, open: 0, overdue: 0, projectsActive: 0, projectsCompleted: 0, completed: 0, daily: [] as { date: string; count: number }[] };
  const days = dates.map((date, index) => ({ date, count: daily[index].count ?? 0 }));
  return { error: null, today, open: open.count ?? 0, overdue: overdue.count ?? 0, projectsActive: projectsActive.count ?? 0, projectsCompleted: projectsCompleted.count ?? 0, completed: days.reduce((total, item) => total + item.count, 0), daily: days };
}
