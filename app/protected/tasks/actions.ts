import { callGasApi, notifyWorkspaceDataChanged } from "@/lib/gas/client";
import { isUuid, parseTaskInput } from "@/lib/tasks/validation";
import { taskStatuses, type TaskActionResult, type TaskStatus } from "@/lib/tasks/types";

export async function deleteTask(id: string, version: string): Promise<TaskActionResult> {
  if (!isUuid(id) || !version) return { ok: false, message: "ข้อมูลงานไม่ถูกต้อง กรุณาโหลดหน้าใหม่" };
  try {
    const result = await callGasApi("tasks.delete", { id, updated_at: version });
    if (result.ok) notifyWorkspaceDataChanged();
    return { ok: Boolean(result.ok), message: result.message || (result.ok ? "ลบงานแล้ว" : "ลบงานไม่สำเร็จ") };
  } catch {
    return { ok: false, message: "เชื่อมต่อไม่สำเร็จ กรุณาลองอีกครั้ง" };
  }
}

export async function saveTask(form: FormData): Promise<TaskActionResult> {
  const parsed = parseTaskInput(form);
  if (!parsed.data) return { ok: false, message: parsed.error };
  const id = String(form.get("id") ?? "");
  const version = String(form.get("updated_at") ?? "");
  try {
    const result = await callGasApi("tasks.save", {
      id: id || undefined,
      updated_at: version || undefined,
      ...parsed.data,
    });
    if (result.ok) notifyWorkspaceDataChanged();
    return { ok: Boolean(result.ok), message: result.message || (result.ok ? "บันทึกงานแล้ว" : "บันทึกงานไม่สำเร็จ") };
  } catch {
    return { ok: false, message: "เชื่อมต่อไม่สำเร็จ กรุณาลองอีกครั้ง" };
  }
}

export async function changeTaskStatus(id: string, status: TaskStatus, version: string): Promise<TaskActionResult> {
  if (!isUuid(id) || !taskStatuses.includes(status)) return { ok: false, message: "ข้อมูลงานไม่ถูกต้อง กรุณาโหลดหน้าใหม่" };
  try {
    const result = await callGasApi("tasks.changeStatus", { id, status, updated_at: version });
    if (result.ok) notifyWorkspaceDataChanged();
    return { ok: Boolean(result.ok), message: result.message || (result.ok ? "เปลี่ยนสถานะแล้ว" : "เปลี่ยนสถานะไม่สำเร็จ") };
  } catch {
    return { ok: false, message: "เชื่อมต่อไม่สำเร็จ กรุณาลองอีกครั้ง" };
  }
}
