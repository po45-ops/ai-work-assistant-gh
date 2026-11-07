"use server";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { isUuid, parseProjectInput } from "@/lib/projects/validation";
import { projectStatuses, type ActionResult, type ProjectStatus } from "@/lib/projects/types";
import { isDate } from "@/lib/tasks/validation";
async function userClient() {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getUser();
  return { supabase, user: error ? null : data.user };
}
function refresh(id?: string) {
  revalidatePath("/protected/projects");
  if (id) revalidatePath(`/protected/projects/${id}`);
  revalidatePath("/protected/tasks");
  revalidatePath("/protected/calendar");
  revalidatePath("/protected");
}
export async function deleteProject(id: string, version: string): Promise<ActionResult> {
  if (!isUuid(id) || !version || !Number.isFinite(Date.parse(version))) return { ok: false, message: "ข้อมูลโปรเจกต์ไม่ถูกต้อง กรุณาโหลดหน้าใหม่" };
  try {
    const { supabase, user } = await userClient();
    if (!user) return { ok: false, message: "เซสชันหมดอายุ กรุณาเข้าสู่ระบบอีกครั้ง" };
    const { data, error } = await supabase.from("projects").delete().eq("id", id).eq("user_id", user.id).eq("updated_at", version).select("id").maybeSingle();
    if (error) return { ok: false, message: "ลบโปรเจกต์ไม่สำเร็จ โปรดตรวจว่ามีข้อมูลที่ต้องจัดการในโปรเจกต์นี้ แล้วลองอีกครั้ง" };
    if (!data) return { ok: false, message: "โปรเจกต์นี้เปลี่ยนไปแล้ว กรุณาโหลดหน้าใหม่ก่อนลบ" };
    refresh(id);
    return { ok: true, message: "ลบโปรเจกต์แล้ว งานที่เคยอยู่ในโปรเจกต์ยังคงอยู่" };
  } catch { return { ok: false, message: "เชื่อมต่อไม่สำเร็จ กรุณาลองอีกครั้ง" }; }
}
export async function saveProject(form: FormData): Promise<ActionResult> {
  const parsed = parseProjectInput(form);
  if (!parsed.data) return { ok: false, message: parsed.error };
  const id = String(form.get("id") ?? "");
  const version = String(form.get("updated_at") ?? "");
  if (id && (!isUuid(id) || !version || !Number.isFinite(Date.parse(version)))) return { ok: false, message: "ข้อมูลโปรเจกต์ไม่ถูกต้อง กรุณาโหลดหน้าใหม่" };
  try {
    const { supabase, user } = await userClient();
    if (!user) return { ok: false, message: "เซสชันหมดอายุ กรุณาเข้าสู่ระบบอีกครั้ง" };
    const payload = { ...parsed.data, completed_at: parsed.data.status === "completed" ? new Date().toISOString() : null };
    if (id) {
      // Keep the original completion timestamp when editing an already-completed project.
      const existing = await supabase.from("projects").select("status,completed_at").eq("id", id).eq("user_id", user.id).maybeSingle();
      if (existing.error || !existing.data) return { ok: false, message: "ไม่พบโปรเจกต์ที่แก้ไขได้" };
      if (existing.data.status === "completed" && payload.completed_at) payload.completed_at = existing.data.completed_at ?? payload.completed_at;
      const { data, error } = await supabase.from("projects").update(payload).eq("id", id).eq("user_id", user.id).eq("updated_at", version).select("id").maybeSingle();
      if (error) return { ok: false, message: "บันทึกโปรเจกต์ไม่สำเร็จ กรุณาลองอีกครั้ง" };
      if (!data) return { ok: false, message: "โปรเจกต์นี้เปลี่ยนไปแล้ว กรุณาโหลดหน้าใหม่ก่อนแก้ไข" };
      refresh(id);
      return { ok: true, message: "บันทึกโปรเจกต์แล้ว", id };
    }
    const { data, error } = await supabase.from("projects").insert({ ...payload, user_id: user.id }).select("id").single();
    if (error || !data) return { ok: false, message: "เพิ่มโปรเจกต์ไม่สำเร็จ กรุณาลองอีกครั้ง" };
    refresh(data.id);
    return { ok: true, message: "เพิ่มโปรเจกต์แล้ว", id: data.id };
  } catch { return { ok: false, message: "เชื่อมต่อไม่สำเร็จ กรุณาลองอีกครั้ง" }; }
}
export async function changeProjectStatus(id: string, status: ProjectStatus, version: string): Promise<ActionResult> {
  if (!isUuid(id) || !projectStatuses.includes(status) || !version || !Number.isFinite(Date.parse(version))) return { ok: false, message: "ข้อมูลโปรเจกต์ไม่ถูกต้อง" };
  try {
    const { supabase, user } = await userClient();
    if (!user) return { ok: false, message: "เซสชันหมดอายุ กรุณาเข้าสู่ระบบอีกครั้ง" };
    const { data, error } = await supabase.from("projects").update({ status, completed_at: status === "completed" ? new Date().toISOString() : null, ...(status === "completed" ? { progress_percent: 100 } : {}) }).eq("id", id).eq("user_id", user.id).eq("updated_at", version).select("id").maybeSingle();
    if (error) return { ok: false, message: "เปลี่ยนสถานะไม่สำเร็จ กรุณาลองอีกครั้ง" };
    if (!data) return { ok: false, message: "โปรเจกต์นี้เปลี่ยนไปแล้ว กรุณาโหลดหน้าใหม่" };
    refresh(id);
    return { ok: true, message: status === "completed" ? "ปิดโปรเจกต์แล้ว" : "นำโปรเจกต์กลับมาดำเนินการแล้ว" };
  } catch { return { ok: false, message: "เชื่อมต่อไม่สำเร็จ กรุณาลองอีกครั้ง" }; }
}
const milestoneStatuses = ["not_started", "in_progress", "waiting", "done", "cancelled"] as const;
export async function saveMilestone(form: FormData): Promise<ActionResult> {
  const projectId = String(form.get("project_id") ?? "");
  const id = String(form.get("id") ?? "");
  const version = String(form.get("updated_at") ?? "");
  const name = String(form.get("name") ?? "").trim();
  const description = String(form.get("description") ?? "").trim();
  const due = String(form.get("due_date") ?? "");
  const status = milestoneStatuses.find((value) => value === form.get("status"));
  const progress = Number(form.get("progress_percent"));
  if (!isUuid(projectId) || (id && (!isUuid(id) || !version || !Number.isFinite(Date.parse(version))))) return { ok: false, message: "ข้อมูล Milestone ไม่ถูกต้อง" };
  if (!name || name.length > 200 || description.length > 5000) return { ok: false, message: "กรุณาระบุชื่อ Milestone ไม่เกิน 200 ตัวอักษร" };
  if (!status || !Number.isInteger(progress) || progress < 0 || progress > 100 || (due && !isDate(due))) return { ok: false, message: "สถานะ ความคืบหน้า หรือวันที่ไม่ถูกต้อง" };
  try {
    const { supabase, user } = await userClient();
    if (!user) return { ok: false, message: "เซสชันหมดอายุ กรุณาเข้าสู่ระบบอีกครั้ง" };
    const project = await supabase.from("projects").select("id").eq("id", projectId).eq("user_id", user.id).maybeSingle();
    if (project.error || !project.data) return { ok: false, message: "ไม่พบโปรเจกต์ของคุณ" };
    const payload = { name, description: description || null, due_date: due || null, status, progress_percent: progress };
    if (id) {
      const { data, error } = await supabase.from("milestones").update(payload).eq("id", id).eq("project_id", projectId).eq("user_id", user.id).eq("updated_at", version).select("id").maybeSingle();
      if (error) return { ok: false, message: "บันทึก Milestone ไม่สำเร็จ" };
      if (!data) return { ok: false, message: "Milestone นี้เปลี่ยนไปแล้ว กรุณาโหลดหน้าใหม่" };
    } else {
      const { error } = await supabase.from("milestones").insert({ ...payload, project_id: projectId, user_id: user.id });
      if (error) return { ok: false, message: "เพิ่ม Milestone ไม่สำเร็จ" };
    }
    refresh(projectId);
    return { ok: true, message: id ? "บันทึก Milestone แล้ว" : "เพิ่ม Milestone แล้ว" };
  } catch { return { ok: false, message: "เชื่อมต่อไม่สำเร็จ กรุณาลองอีกครั้ง" }; }
}
