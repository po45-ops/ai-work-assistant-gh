import "server-only";
import { notFound, redirect } from "next/navigation";
import { getAuthenticatedUser } from "@/lib/supabase/auth-context";
import { escapeSearch, isUuid, projectQuery } from "./validation";
import { projectPageSize, type LinkedTask, type Milestone, type Project, type ProjectFilters } from "./types";
const projectColumns = "id,name,goal,description,status,priority,risk_level,progress_percent,start_date,target_date,completed_at,updated_at,created_at";
async function ownClient() {
  return getAuthenticatedUser();
}
export async function loadProjects(filters: ProjectFilters) {
  const { supabase, userId } = await ownClient();
  let query = supabase.from("projects").select(projectColumns, { count: "exact" }).eq("user_id", userId);
  if (filters.search) query = query.ilike("name", `%${escapeSearch(filters.search)}%`);
  if (filters.status !== "all") query = query.eq("status", filters.status);
  const offset = (filters.page - 1) * projectPageSize;
  const [list, active, completed, due] = await Promise.all([
    query.order("updated_at", { ascending: false }).order("id").range(offset, offset + projectPageSize - 1).returns<Project[]>(),
    supabase.from("projects").select("id", { count: "exact", head: true }).eq("user_id", userId).eq("status", "active"),
    supabase.from("projects").select("id", { count: "exact", head: true }).eq("user_id", userId).eq("status", "completed"),
    supabase.from("projects").select("id", { count: "exact", head: true }).eq("user_id", userId).lt("target_date", new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Bangkok", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date())).not("status", "in", "(completed,cancelled)"),
  ]);
  if (list.error || active.error || completed.error || due.error) return { projects: [] as Project[], count: 0, active: 0, completed: 0, overdue: 0, error: "โหลดข้อมูลโปรเจกต์ไม่สำเร็จ กรุณาลองอีกครั้ง" };
  const count = list.count ?? 0;
  const lastPage = Math.max(1, Math.ceil(count / projectPageSize));
  if (filters.page > lastPage) redirect(projectQuery(filters, lastPage));
  return { projects: list.data ?? [], count, active: active.count ?? 0, completed: completed.count ?? 0, overdue: due.count ?? 0, error: null };
}
export async function loadProjectDetail(id: string) {
  if (!isUuid(id)) notFound();
  const { supabase, userId } = await ownClient();
  const projectResult = await supabase.from("projects").select(projectColumns).eq("id", id).eq("user_id", userId).maybeSingle<Project>();
  if (projectResult.error) return { project: null, milestones: [] as Milestone[], tasks: [] as LinkedTask[], error: "โหลดโปรเจกต์ไม่สำเร็จ กรุณาลองอีกครั้ง" };
  if (!projectResult.data) notFound();
  const [milestones, tasks] = await Promise.all([
    supabase.from("milestones").select("id,project_id,name,description,status,priority,progress_percent,due_date,sequence_no,updated_at").eq("user_id", userId).eq("project_id", id).order("sequence_no").order("created_at").returns<Milestone[]>(),
    supabase.from("tasks").select("id,title,status,priority,due_date").eq("user_id", userId).eq("project_id", id).is("archived_at", null).order("created_at", { ascending: false }).limit(100).returns<LinkedTask[]>(),
  ]);
  return { project: projectResult.data, milestones: milestones.data ?? [], tasks: tasks.data ?? [], error: milestones.error || tasks.error ? "โหลด Milestone หรืองานที่เชื่อมโยงไม่สำเร็จ" : null };
}
