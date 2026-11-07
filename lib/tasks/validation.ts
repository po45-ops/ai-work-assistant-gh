import { taskPriorities, taskStatuses, type TaskFilters, type TaskInput } from "./types";
export function isUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
}
export function isDate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T12:00:00Z`);
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
}
export function parseTaskInput(form: FormData): { data: TaskInput; error?: never } | { error: string; data?: never } {
  const title = String(form.get("title") ?? "").trim();
  const description = String(form.get("description") ?? "").trim();
  const status = taskStatuses.find((value) => value === form.get("status"));
  const priority = taskPriorities.find((value) => value === form.get("priority"));
  const dueDate = String(form.get("due_date") ?? "");
  const projectId = String(form.get("project_id") ?? "");
  const minutesText = String(form.get("estimated_minutes") ?? "").trim();
  const minutes = minutesText === "" ? null : Number(minutesText);
  if (!title || title.length > 200) return { error: "กรุณาระบุชื่องานไม่เกิน 200 ตัวอักษร" };
  if (description.length > 5000) return { error: "รายละเอียดต้องไม่เกิน 5,000 ตัวอักษร" };
  if (!status || !priority) return { error: "กรุณาเลือกสถานะและความสำคัญที่ถูกต้อง" };
  if (dueDate && !isDate(dueDate)) return { error: "วันครบกำหนดไม่ถูกต้อง" };
  if (projectId && !isUuid(projectId)) return { error: "โปรเจกต์ไม่ถูกต้อง" };
  if (minutes !== null && (!Number.isInteger(minutes) || minutes < 0 || minutes > 2147483647)) return { error: "เวลาประมาณต้องเป็นจำนวนนาทีเต็มตั้งแต่ 0 ขึ้นไป" };
  return { data: { title, description: description || null, status, priority, due_date: dueDate || null, project_id: projectId || null, estimated_minutes: minutes } };
}
export function parseTaskFilters(params: Record<string, string | string[] | undefined>): TaskFilters {
  const one = (key: string) => typeof params[key] === "string" ? params[key] : "";
  const status = taskStatuses.find((value) => value === one("status")) ?? "all";
  const priority = taskPriorities.find((value) => value === one("priority")) ?? "all";
  const project = one("project"); const page = Number(one("page")); const due = one("due");
  return { search: one("search").trim().slice(0, 200), status, priority, project: isUuid(project) ? project : "", due: due === "today" || due === "overdue" ? due : "all", page: Number.isSafeInteger(page) && page > 0 && page <= 100000 ? page : 1 };
}
export function escapeSearch(value: string) { return value.replace(/[\\%_]/g, (match) => `\\${match}`); }
export function taskQuery(filters: TaskFilters, page = filters.page) {
  const query = new URLSearchParams();
  if (filters.search) query.set("search", filters.search);
  if (filters.status !== "all") query.set("status", filters.status);
  if (filters.priority !== "all") query.set("priority", filters.priority);
  if (filters.project) query.set("project", filters.project);
  if (filters.due !== "all") query.set("due", filters.due);
  if (page > 1) query.set("page", String(page));
  return `/protected/tasks${query.size ? `?${query}` : ""}`;
}
