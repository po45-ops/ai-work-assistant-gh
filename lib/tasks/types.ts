// Verified against the existing Supabase project on 2026-09-27.
export const taskStatuses = ["not_started", "in_progress", "waiting", "done", "cancelled"] as const;
export const taskPriorities = ["high", "medium", "low"] as const;
export type TaskStatus = (typeof taskStatuses)[number];
export type TaskPriority = (typeof taskPriorities)[number];
export const statusLabels: Record<TaskStatus, string> = {
  not_started: "ยังไม่เริ่ม", in_progress: "กำลังทำ", waiting: "รอดำเนินการ", done: "เสร็จแล้ว", cancelled: "ยกเลิก",
};
export const priorityLabels: Record<TaskPriority, string> = { high: "สูง", medium: "ปานกลาง", low: "ต่ำ" };
export type Task = {
  id: string; title: string; description: string | null; status: TaskStatus; priority: TaskPriority;
  due_date: string | null; project_id: string | null; estimated_minutes: number | null;
  completed_at: string | null; archive_after: string | null; updated_at: string;
};
export type ProjectOption = { id: string; name: string };
export type TaskInput = Pick<Task, "title" | "description" | "status" | "priority" | "due_date" | "project_id" | "estimated_minutes">;
export type TaskFilters = {
  search: string; status: TaskStatus | "all"; priority: TaskPriority | "all";
  project: string; due: "all" | "today" | "overdue"; page: number;
};
export type TaskActionResult = { ok: boolean; message: string };
export const pageSize = 30;
