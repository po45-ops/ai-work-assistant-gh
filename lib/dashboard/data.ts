import "server-only";
import { getAuthenticatedUser } from "@/lib/supabase/auth-context";
type TaskSummary = { id: string; title: string; priority: string; due_date: string | null };
type ProjectSummary = { id: string; name: string; progress_percent: number; status: string };
export async function loadDashboard() {
  const { supabase, userId } = await getAuthenticatedUser();
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Bangkok", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
  const [todayTasks, important, overdue, activeProjects, pendingInbox, topTasks, topProjects] = await Promise.all([
    supabase.from("tasks").select("id", { count: "exact", head: true }).eq("user_id", userId).is("archived_at", null).eq("due_date", today).not("status", "in", "(done,cancelled)"),
    supabase.from("tasks").select("id", { count: "exact", head: true }).eq("user_id", userId).is("archived_at", null).eq("priority", "high").not("status", "in", "(done,cancelled)"),
    supabase.from("tasks").select("id", { count: "exact", head: true }).eq("user_id", userId).is("archived_at", null).lt("due_date", today).not("status", "in", "(done,cancelled)"),
    supabase.from("projects").select("id", { count: "exact", head: true }).eq("user_id", userId).eq("status", "active"),
    supabase.from("inbox").select("id", { count: "exact", head: true }).eq("user_id", userId).eq("processing_status", "pending"),
    supabase.from("tasks").select("id,title,priority,due_date").eq("user_id", userId).is("archived_at", null).not("status", "in", "(done,cancelled)").order("due_date", { ascending: true, nullsFirst: false }).limit(3).returns<TaskSummary[]>(),
    supabase.from("projects").select("id,name,progress_percent,status").eq("user_id", userId).in("status", ["active", "planning"]).order("updated_at", { ascending: false }).limit(2).returns<ProjectSummary[]>(),
  ]);
  return { today, todayTasks: todayTasks.count ?? 0, important: important.count ?? 0, overdue: overdue.count ?? 0, activeProjects: activeProjects.count ?? 0, pendingInbox: pendingInbox.count ?? 0, tasks: topTasks.data ?? [], projects: topProjects.data ?? [], error: [todayTasks, important, overdue, activeProjects, pendingInbox, topTasks, topProjects].some((result) => result.error) ? "โหลดภาพรวมไม่สำเร็จ กรุณาลองอีกครั้ง" : null };
}
