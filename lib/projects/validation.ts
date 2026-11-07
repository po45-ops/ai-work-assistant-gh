import { isDate, isUuid, escapeSearch } from "@/lib/tasks/validation";
import { projectPriorities, projectStatuses, riskLevels, type ProjectFilters, type ProjectInput } from "./types";
export { isUuid, escapeSearch };
export function parseProjectInput(form: FormData): { data: ProjectInput; error?: never } | { error: string; data?: never } {
  const name = String(form.get("name") ?? "").trim();
  const goal = String(form.get("goal") ?? "").trim();
  const description = String(form.get("description") ?? "").trim();
  const status = projectStatuses.find((value) => value === form.get("status"));
  const priority = projectPriorities.find((value) => value === form.get("priority"));
  const risk_level = riskLevels.find((value) => value === form.get("risk_level"));
  const progress = Number(form.get("progress_percent"));
  const start = String(form.get("start_date") ?? "");
  const target = String(form.get("target_date") ?? "");
  if (!name || name.length > 200) return { error: "กรุณาระบุชื่อโปรเจกต์ไม่เกิน 200 ตัวอักษร" };
  if (goal.length > 1000 || description.length > 5000) return { error: "เป้าหมายหรือรายละเอียดมีความยาวเกินกำหนด" };
  if (!status || !priority || !risk_level) return { error: "สถานะ ความสำคัญ หรือความเสี่ยงไม่ถูกต้อง" };
  if (!Number.isInteger(progress) || progress < 0 || progress > 100) return { error: "ความคืบหน้าต้องอยู่ระหว่าง 0 ถึง 100" };
  if ((start && !isDate(start)) || (target && !isDate(target))) return { error: "วันที่ไม่ถูกต้อง" };
  if (start && target && target < start) return { error: "วันเป้าหมายต้องไม่มาก่อนวันเริ่มต้น" };
  return { data: { name, goal: goal || null, description: description || null, status, priority, risk_level, progress_percent: progress, start_date: start || null, target_date: target || null } };
}
export function parseProjectFilters(params: Record<string, string | string[] | undefined>): ProjectFilters {
  const value = (key: string) => typeof params[key] === "string" ? params[key] : "";
  const page = Number(value("page"));
  return { search: value("search").trim().slice(0, 200), status: projectStatuses.find((status) => status === value("status")) ?? "all", page: Number.isSafeInteger(page) && page > 0 && page <= 100000 ? page : 1 };
}
export function projectQuery(filters: ProjectFilters, page = filters.page) {
  const query = new URLSearchParams();
  if (filters.search) query.set("search", filters.search);
  if (filters.status !== "all") query.set("status", filters.status);
  if (page > 1) query.set("page", String(page));
  return `/protected/projects${query.size ? `?${query}` : ""}`;
}
