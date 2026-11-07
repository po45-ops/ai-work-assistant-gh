"use server";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { isUuid, parseTaskInput } from "@/lib/tasks/validation";
import { taskStatuses, type TaskActionResult, type TaskStatus } from "@/lib/tasks/types";
import { deleteTaskCalendarEvent, upsertTaskCalendarEvent } from "@/lib/integrations/google";
async function userClient() {
  const supabase = await createClient(); const { data, error } = await supabase.auth.getUser();
  return { supabase, user: error ? null : data.user };
}
async function ownsProject(supabase: Awaited<ReturnType<typeof createClient>>, userId: string, projectId: string | null) {
  if (!projectId) return true;
  const { data, error } = await supabase.from("projects").select("id").eq("id", projectId).eq("user_id", userId).maybeSingle();
  return !error && Boolean(data);
}
function refreshWorkspace() { revalidatePath("/protected/tasks"); revalidatePath("/protected/calendar"); revalidatePath("/protected"); }
export async function deleteTask(id: string, version: string): Promise<TaskActionResult> {
  if (!isUuid(id) || !version || !Number.isFinite(Date.parse(version))) return { ok: false, message: "ข้อมูลงานไม่ถูกต้อง กรุณาโหลดหน้าใหม่" };
  try {
    const { supabase, user } = await userClient();
    if (!user) return { ok: false, message: "เซสชันหมดอายุ กรุณาเข้าสู่ระบบอีกครั้ง" };
    const current = await supabase.from("tasks").select("project_id,calendar_event_id").eq("id", id).eq("user_id", user.id).eq("updated_at", version).is("archived_at", null).maybeSingle();
    if (current.error) return { ok: false, message: "ตรวจสอบงานไม่สำเร็จ กรุณาลองอีกครั้ง" };
    if (!current.data) return { ok: false, message: "งานนี้เปลี่ยนไปแล้ว กรุณาโหลดหน้าใหม่ก่อนลบ" };
    const { data, error } = await supabase.from("tasks").delete().eq("id", id).eq("user_id", user.id).eq("updated_at", version).is("archived_at", null).select("id").maybeSingle();
    if (error) return { ok: false, message: "ลบงานไม่สำเร็จ กรุณาลองอีกครั้ง" };
    if (!data) return { ok: false, message: "งานนี้เปลี่ยนไปแล้ว กรุณาโหลดหน้าใหม่ก่อนลบ" };
    refreshWorkspace();
    revalidatePath("/protected/reports");
    if (current.data.project_id) revalidatePath(`/protected/projects/${current.data.project_id}`);
    if (current.data.calendar_event_id) {
      try {
        if (await deleteTaskCalendarEvent(user.id, current.data.calendar_event_id)) return { ok: true, message: "ลบงานและกิจกรรมที่เชื่อมกับ Google Calendar แล้ว" };
      } catch { /* The task is already deleted; report the calendar cleanup separately. */ }
      return { ok: true, message: "ลบงานแล้ว แต่ยังลบกิจกรรมใน Google Calendar ไม่ได้ กรุณาตรวจปฏิทินของคุณ" };
    }
    return { ok: true, message: "ลบงานแล้ว" };
  } catch { return { ok: false, message: "เชื่อมต่อไม่สำเร็จ กรุณาลองอีกครั้ง" }; }
}
export async function saveTask(form: FormData): Promise<TaskActionResult> {
  const parsed = parseTaskInput(form);
  if (!parsed.data) return { ok: false, message: parsed.error };
  const id = String(form.get("id") ?? ""); const version = String(form.get("updated_at") ?? "");
  if (id && (!isUuid(id) || !version || !Number.isFinite(Date.parse(version)))) return { ok: false, message: "ข้อมูลงานไม่ถูกต้อง กรุณาโหลดหน้าใหม่" };
  try {
    const { supabase, user } = await userClient();
    if (!user) return { ok: false, message: "เซสชันหมดอายุ กรุณาเข้าสู่ระบบอีกครั้ง" };
    if (!await ownsProject(supabase, user.id, parsed.data.project_id)) return { ok: false, message: "ไม่สามารถใช้โปรเจกต์นี้ได้ กรุณาเลือกโปรเจกต์ของคุณ" };
    let calendarTask: { id: string; title: string; description: string | null; due_date: string | null; calendar_event_id: string | null } | null = null;
    if (id) {
      const current = await supabase.from("tasks").select("project_id,calendar_event_id").eq("id", id).eq("user_id", user.id).is("archived_at", null).maybeSingle();
      if (current.error || !current.data) return { ok: false, message: "ไม่พบงานที่สามารถแก้ไขได้ กรุณาโหลดหน้าใหม่" };
      const payload = { ...parsed.data, ...(current.data.project_id !== parsed.data.project_id ? { milestone_id: null } : {}) };
      const { data, error } = await supabase.from("tasks").update(payload).eq("id", id).eq("user_id", user.id).eq("updated_at", version).is("archived_at", null).select("id").maybeSingle();
      if (error) return { ok: false, message: "บันทึกงานไม่สำเร็จ กรุณาลองอีกครั้ง" };
      if (!data) return { ok: false, message: "งานนี้เปลี่ยนไปแล้ว กรุณาปิดฟอร์มและโหลดหน้าใหม่ก่อนแก้ไข" };
      calendarTask = { id, title: parsed.data.title, description: parsed.data.description, due_date: parsed.data.due_date, calendar_event_id: current.data.calendar_event_id };
    } else {
      const { data, error } = await supabase.from("tasks").insert({ ...parsed.data, user_id: user.id }).select("id,calendar_event_id").single();
      if (error) return { ok: false, message: "เพิ่มงานไม่สำเร็จ กรุณาลองอีกครั้ง" };
      if (data) calendarTask = { id: data.id, title: parsed.data.title, description: parsed.data.description, due_date: parsed.data.due_date, calendar_event_id: data.calendar_event_id };
    }
    let calendarNote = "";
    if (calendarTask && (calendarTask.due_date || calendarTask.calendar_event_id)) {
      try {
        const synced = await upsertTaskCalendarEvent(user.id, calendarTask);
        if (synced) calendarNote = calendarTask.due_date ? " และซิงก์ Google Calendar แล้ว" : " และลบกิจกรรม Google Calendar ที่ผูกไว้แล้ว";
      } catch {
        calendarNote = " (บันทึกแล้ว แต่ซิงก์ Google Calendar ไม่สำเร็จ)";
      }
    }
    refreshWorkspace(); return { ok: true, message: (id ? "บันทึกการแก้ไขแล้ว" : "เพิ่มงานแล้ว") + calendarNote };
  } catch { return { ok: false, message: "เชื่อมต่อไม่สำเร็จ กรุณาลองอีกครั้ง" }; }
}
export async function changeTaskStatus(id: string, status: TaskStatus, version: string): Promise<TaskActionResult> {
  if (!isUuid(id) || !taskStatuses.includes(status) || !version || !Number.isFinite(Date.parse(version))) return { ok: false, message: "ข้อมูลงานไม่ถูกต้อง กรุณาโหลดหน้าใหม่" };
  try {
    const { supabase, user } = await userClient();
    if (!user) return { ok: false, message: "เซสชันหมดอายุ กรุณาเข้าสู่ระบบอีกครั้ง" };
    // The existing trigger manages completed_at/archive_after and restore. Never delete on completion.
    const { data, error } = await supabase.from("tasks").update({ status }).eq("id", id).eq("user_id", user.id).eq("updated_at", version).is("archived_at", null).select("id").maybeSingle();
    if (error) return { ok: false, message: "เปลี่ยนสถานะไม่สำเร็จ กรุณาลองอีกครั้ง" };
    if (!data) return { ok: false, message: "งานนี้เปลี่ยนไปแล้วหรือไม่สามารถแก้ไขได้ กรุณาโหลดหน้าใหม่" };
    refreshWorkspace(); return { ok: true, message: status === "done" ? "ทำงานเสร็จแล้ว และยังเก็บประวัติไว้ตามนโยบายของบัญชี" : "นำงานกลับมาดำเนินการแล้ว" };
  } catch { return { ok: false, message: "เชื่อมต่อไม่สำเร็จ กรุณาลองอีกครั้ง" }; }
}
