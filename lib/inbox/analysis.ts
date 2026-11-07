export type DraftPriority = "high" | "medium" | "low";
export type InboxDraftTask = {
  title: string;
  description: string;
  due_date: string | null;
  priority: DraftPriority;
  estimated_minutes: number | null;
  milestone_index: number | null;
};
export type InboxDraftMilestone = {
  name: string;
  description: string;
  due_date: string | null;
  priority: DraftPriority;
};
export type InboxDraft = {
  kind: "note" | "task" | "project" | "event";
  title: string;
  summary: string;
  description: string;
  goal: string;
  priority: DraftPriority;
  start_date: string | null;
  due_date: string | null;
  end_date: string | null;
  start_time: string | null;
  end_time: string | null;
  estimated_minutes: number | null;
  clarification_question: string | null;
  milestones: InboxDraftMilestone[];
  tasks: InboxDraftTask[];
};

const priorities: DraftPriority[] = ["high", "medium", "low"];
const kinds = ["note", "task", "project", "event"] as const;
function record(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : null;
}
function stringValue(value: unknown, max: number, fallback = "") {
  return typeof value === "string" ? value.trim().slice(0, max) : fallback;
}
function dateValue(value: unknown): string | null | undefined {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return undefined;
  const date = new Date(`${value}T12:00:00Z`);
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value ? value : undefined;
}
function timeValue(value: unknown): string | null | undefined {
  if (value === null || value === undefined || value === "") return null;
  return typeof value === "string" && /^([01]\d|2[0-3]):[0-5]\d$/.test(value) ? value : undefined;
}
function priorityValue(value: unknown): DraftPriority {
  return priorities.includes(value as DraftPriority) ? value as DraftPriority : "medium";
}
function minutesValue(value: unknown): number | null | undefined {
  if (value === null || value === undefined || value === "") return null;
  const minutes = Number(value);
  return Number.isInteger(minutes) && minutes >= 0 && minutes <= 2147483647 ? minutes : undefined;
}

export function parseInboxDraft(value: unknown): { data: InboxDraft; error?: never } | { data?: never; error: string } {
  const input = record(value);
  if (!input || !kinds.includes(input.kind as InboxDraft["kind"])) return { error: "ร่างจาก AI ไม่อยู่ในรูปแบบที่รองรับ กรุณาวิเคราะห์ใหม่" };
  const kind = input.kind as InboxDraft["kind"];
  const title = stringValue(input.title, 200);
  const summary = stringValue(input.summary, 2000);
  const description = stringValue(input.description, 5000);
  const goal = stringValue(input.goal, 1000);
  const startDate = dateValue(input.start_date);
  const dueDate = dateValue(input.due_date);
  const endDate = dateValue(input.end_date);
  const startTime = timeValue(input.start_time);
  const endTime = timeValue(input.end_time);
  const estimatedMinutes = minutesValue(input.estimated_minutes);
  if (!title || !summary || startDate === undefined || dueDate === undefined || endDate === undefined || startTime === undefined || endTime === undefined || estimatedMinutes === undefined) {
    return { error: "ร่างมีชื่อหรือวันที่ไม่ถูกต้อง กรุณาวิเคราะห์ใหม่หรือแก้ข้อมูลให้ครบ" };
  }
  if (startDate && endDate && endDate < startDate) return { error: "วันสิ้นสุดต้องไม่มาก่อนวันเริ่มต้น" };
  if (kind === "event" && !startDate) return { error: "กรุณาระบุวันนัดหมายก่อนบันทึกลง Google Calendar" };
  if (kind === "event" && endDate && endDate > (startDate ?? "") && (startTime || endTime)) return { error: "นัดหลายวันต้องเป็นกิจกรรมทั้งวัน กรุณาล้างช่องเวลา" };
  if (endTime && !startTime) return { error: "กรุณาระบุเวลาเริ่มก่อนระบุเวลาสิ้นสุด" };
  if (startTime && endTime && startTime === endTime) return { error: "เวลาเริ่มและสิ้นสุดต้องไม่ตรงกัน" };

  const rawTasks = Array.isArray(input.tasks) ? input.tasks.slice(0, 20) : [];
  const tasks: InboxDraftTask[] = [];
  for (const value of rawTasks) {
    const item = record(value);
    if (!item) continue;
    const taskTitle = stringValue(item.title, 200);
    const date = dateValue(item.due_date);
    const minutes = minutesValue(item.estimated_minutes);
    const milestoneIndex = item.milestone_index === null || item.milestone_index === undefined || item.milestone_index === "" ? null : Number(item.milestone_index);
    if (!taskTitle || date === undefined || minutes === undefined || (milestoneIndex !== null && (!Number.isInteger(milestoneIndex) || milestoneIndex < 0 || milestoneIndex >= 20))) return { error: "งานย่อยบางรายการมีชื่อ วันที่ หรือเวลาประมาณไม่ถูกต้อง" };
    tasks.push({ title: taskTitle, description: stringValue(item.description, 5000), due_date: date, priority: priorityValue(item.priority), estimated_minutes: minutes, milestone_index: milestoneIndex });
  }

  const rawMilestones = Array.isArray(input.milestones) ? input.milestones.slice(0, 20) : [];
  const milestones: InboxDraftMilestone[] = [];
  for (const value of rawMilestones) {
    const item = record(value);
    if (!item) continue;
    const name = stringValue(item.name, 200);
    const date = dateValue(item.due_date);
    if (!name || date === undefined) return { error: "หมุดหมายบางรายการมีชื่อหรือวันที่ไม่ถูกต้อง" };
    milestones.push({ name, description: stringValue(item.description, 5000), due_date: date, priority: priorityValue(item.priority) });
  }
  if (tasks.some((task) => task.milestone_index !== null && task.milestone_index >= milestones.length)) return { error: "งานย่อยอ้างถึงหมุดหมายที่ไม่มีอยู่ กรุณาเลือกหมุดหมายใหม่" };
  if (kind === "project" && !tasks.length && !milestones.length) return { error: "โปรเจกต์นี้ยังไม่มีงานย่อยหรือหมุดหมายให้บันทึก กรุณาแก้ร่างก่อน" };
  return { data: {
    kind, title, summary, description, goal, priority: priorityValue(input.priority),
    start_date: startDate ?? null, due_date: dueDate ?? null, end_date: endDate ?? null,
    start_time: startTime ?? null, end_time: endTime ?? null,
    estimated_minutes: estimatedMinutes ?? null,
    clarification_question: stringValue(input.clarification_question, 500) || null,
    milestones, tasks,
  } };
}
