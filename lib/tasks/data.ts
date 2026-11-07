import "server-only";
import { redirect } from "next/navigation";
import { getAuthenticatedUser } from "@/lib/supabase/auth-context";
import { escapeSearch, taskQuery } from "./validation";
import { pageSize, type Task, type ProjectOption, type TaskFilters } from "./types";
const taskColumns = "id,title,description,status,priority,due_date,project_id,estimated_minutes,completed_at,archive_after,updated_at";
export async function loadTasks(filters: TaskFilters) {
  const { supabase, userId } = await getAuthenticatedUser();
  // due_date is a calendar date. The workspace's initial timezone is Thailand.
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Bangkok", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
  let query = supabase.from("tasks").select(taskColumns, { count: "exact" }).eq("user_id", userId).is("archived_at", null);
  if (filters.search) query = query.ilike("title", `%${escapeSearch(filters.search)}%`);
  if (filters.status !== "all") query = query.eq("status", filters.status);
  if (filters.priority !== "all") query = query.eq("priority", filters.priority);
  if (filters.project) query = query.eq("project_id", filters.project);
  if (filters.due === "today") query = query.eq("due_date", today);
  if (filters.due === "overdue") query = query.lt("due_date", today).not("status", "in", "(done,cancelled)");
  const offset = (filters.page - 1) * pageSize;
  const [tasksResult, projectsResult] = await Promise.all([
    query.order("created_at", { ascending: false }).order("id", { ascending: false }).range(offset, offset + pageSize - 1).returns<Task[]>(),
    supabase.from("projects").select("id,name").eq("user_id", userId).order("name").returns<ProjectOption[]>(),
  ]);
  if (tasksResult.error || projectsResult.error) return { tasks: [] as Task[], projects: [] as ProjectOption[], count: 0, today, error: "โหลดข้อมูลงานหรือโปรเจกต์ไม่สำเร็จ กรุณาลองอีกครั้ง" };
  const count = tasksResult.count ?? 0; const lastPage = Math.max(1, Math.ceil(count / pageSize));
  if (filters.page > lastPage) redirect(taskQuery(filters, lastPage));
  return { tasks: tasksResult.data ?? [], projects: projectsResult.data ?? [], count, today, error: null };
}
