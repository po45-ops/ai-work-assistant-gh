import { callGasApi, notifyWorkspaceDataChanged } from "@/lib/gas/client";
import { isUuid, parseProjectInput } from "@/lib/projects/validation";
import { projectStatuses, type ActionResult, type ProjectStatus } from "@/lib/projects/types";
import { isDate } from "@/lib/tasks/validation";

export async function deleteProject(id: string, version: string): Promise<ActionResult> {
  if (!isUuid(id)) return { ok: false, message: "ข้อมูลโปรเจกต์ไม่ถูกต้อง กรุณาโหลดหน้าใหม่" };
  try {
    const result = await callGasApi("projects.delete", { id, updated_at: version });
    if (result.ok) notifyWorkspaceDataChanged();
    return { ok: Boolean(result.ok), message: result.message || (result.ok ? "ลบโปรเจกต์แล้ว" : "ลบโปรเจกต์ไม่สำเร็จ") };
  } catch {
    return { ok: false, message: "เชื่อมต่อไม่สำเร็จ กรุณาลองอีกครั้ง" };
  }
}

export async function saveProject(form: FormData): Promise<ActionResult> {
  const parsed = parseProjectInput(form);
  if (!parsed.data) return { ok: false, message: parsed.error };
  const id = String(form.get("id") ?? "");
  const version = String(form.get("updated_at") ?? "");
  try {
    const result = await callGasApi("projects.save", {
      id: id || undefined,
      updated_at: version || undefined,
      ...parsed.data,
    });
    if (result.ok) notifyWorkspaceDataChanged();
    return {
      ok: Boolean(result.ok),
      message: result.message || (result.ok ? "บันทึกโปรเจกต์แล้ว" : "บันทึกโปรเจกต์ไม่สำเร็จ"),
      id: result.id || id,
    };
  } catch {
    return { ok: false, message: "เชื่อมต่อไม่สำเร็จ กรุณาลองอีกครั้ง" };
  }
}

export async function changeProjectStatus(id: string, status: ProjectStatus, version: string): Promise<ActionResult> {
  if (!isUuid(id) || !projectStatuses.includes(status)) return { ok: false, message: "ข้อมูลโปรเจกต์ไม่ถูกต้อง" };
  try {
    const result = await callGasApi("projects.changeStatus", { id, status, updated_at: version });
    if (result.ok) notifyWorkspaceDataChanged();
    return { ok: Boolean(result.ok), message: result.message || (result.ok ? "เปลี่ยนสถานะแล้ว" : "เปลี่ยนสถานะไม่สำเร็จ") };
  } catch {
    return { ok: false, message: "เชื่อมต่อไม่สำเร็จ กรุณาลองอีกครั้ง" };
  }
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
  if (!projectId || !name || name.length > 200 || description.length > 5000) {
    return { ok: false, message: "กรุณาระบุชื่อ Milestone ไม่เกิน 200 ตัวอักษร" };
  }
  if (!status || !Number.isInteger(progress) || progress < 0 || progress > 100 || (due && !isDate(due))) {
    return { ok: false, message: "สถานะ ความคืบหน้า หรือวันที่ไม่ถูกต้อง" };
  }
  try {
    const result = await callGasApi("milestones.save", {
      project_id: projectId,
      id: id || undefined,
      updated_at: version || undefined,
      name,
      description: description || null,
      due_date: due || null,
      status,
      progress_percent: progress,
    });
    if (result.ok) notifyWorkspaceDataChanged();
    return { ok: Boolean(result.ok), message: result.message || (result.ok ? "บันทึก Milestone แล้ว" : "บันทึก Milestone ไม่สำเร็จ") };
  } catch {
    return { ok: false, message: "เชื่อมต่อไม่สำเร็จ กรุณาลองอีกครั้ง" };
  }
}
