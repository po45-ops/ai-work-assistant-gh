import "server-only";
import { getAuthenticatedUser } from "@/lib/supabase/auth-context";
import { isDate } from "@/lib/tasks/validation";
import { listGoogleEvents } from "@/lib/integrations/google";
export type CalendarEvent = { id: string; kind: "task" | "milestone" | "project" | "google"; title: string; date: string; time?: string | null; status: string; projectId: string | null; projectName: string | null; externalUrl?: string | null };
function bangkokToday() { return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Bangkok", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date()); }
export function parseCalendarParams(params: Record<string, string | string[] | undefined>) {
  const today = bangkokToday();
  const rawMonth = typeof params.month === "string" ? params.month : "";
  const month = /^\d{4}-(0[1-9]|1[0-2])$/.test(rawMonth) && Number(rawMonth.slice(0, 4)) >= 1900 && Number(rawMonth.slice(0, 4)) <= 2100 ? rawMonth : today.slice(0, 7);
  const rawDay = typeof params.day === "string" ? params.day : "";
  const day = isDate(rawDay) && rawDay.startsWith(`${month}-`) ? rawDay : month === today.slice(0, 7) ? today : `${month}-01`;
  return { month, day, today };
}
export async function loadCalendar(month: string) {
  const { supabase, userId } = await getAuthenticatedUser();
  const year = Number(month.slice(0, 4)); const monthIndex = Number(month.slice(5, 7)) - 1;
  const start = `${month}-01`;
  const end = new Date(Date.UTC(year, monthIndex + 1, 0)).toISOString().slice(0, 10);
  const nextMonth = new Date(Date.UTC(year, monthIndex + 1, 1)).toISOString().slice(0, 10);
  const googleResultPromise = listGoogleEvents(userId, start + "T00:00:00+07:00", nextMonth + "T00:00:00+07:00")
    .then((events) => ({ events, connected: events !== null, error: null as string | null }))
    .catch(() => ({ events: null, connected: false, error: "เชื่อม Google Calendar ไม่สำเร็จในครั้งนี้ กำหนดการจากระบบยังแสดงตามปกติ" }));
  const [tasks, milestones, dueProjects, projectNames, googleResult] = await Promise.all([
    supabase.from("tasks").select("id,title,status,due_date,project_id,calendar_event_id").eq("user_id", userId).is("archived_at", null).gte("due_date", start).lte("due_date", end).order("due_date").limit(1000),
    supabase.from("milestones").select("id,name,status,due_date,project_id").eq("user_id", userId).gte("due_date", start).lte("due_date", end).order("due_date").limit(1000),
    supabase.from("projects").select("id,name,status,target_date").eq("user_id", userId).gte("target_date", start).lte("target_date", end).order("target_date").limit(1000),
    supabase.from("projects").select("id,name").eq("user_id", userId).order("name").limit(1000),
    googleResultPromise,
  ]);
  if (tasks.error || milestones.error || dueProjects.error || projectNames.error) return { events: [] as CalendarEvent[], error: "โหลดกำหนดการไม่สำเร็จ กรุณาลองอีกครั้ง", googleError: null, googleConnected: false, truncated: false };
  const names = new Map((projectNames.data ?? []).map((project) => [project.id, project.name]));
  const events: CalendarEvent[] = [
    ...(tasks.data ?? []).filter((row) => row.due_date).map((row) => ({ id: row.id, kind: "task" as const, title: row.title, date: row.due_date!, status: row.status, projectId: row.project_id, projectName: row.project_id ? names.get(row.project_id) ?? null : null })),
    ...(milestones.data ?? []).filter((row) => row.due_date).map((row) => ({ id: row.id, kind: "milestone" as const, title: row.name, date: row.due_date!, status: row.status, projectId: row.project_id, projectName: names.get(row.project_id) ?? null })),
    ...(dueProjects.data ?? []).filter((row) => row.target_date).map((row) => ({ id: row.id, kind: "project" as const, title: row.name, date: row.target_date!, status: row.status, projectId: row.id, projectName: null })),
  ];
  const taskEventIds = new Set((tasks.data ?? []).map((task) => task.calendar_event_id).filter((id): id is string => Boolean(id)));
  const googleConnected = googleResult.connected;
  const googleError = googleResult.error;
  for (const item of googleResult.events ?? []) {
      if (!item.id || taskEventIds.has(item.id)) continue;
      const date = item.start?.date ?? (item.start?.dateTime ? new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Bangkok", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(item.start.dateTime)) : null);
      if (!date) continue;
      const time = item.start?.dateTime ? new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Bangkok", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(new Date(item.start.dateTime)) : null;
      let externalUrl: string | null = null;
      try {
        const parsed = new URL(item.htmlLink ?? "");
        if (parsed.protocol === "https:" && ["calendar.google.com", "www.google.com"].includes(parsed.hostname) && parsed.pathname.startsWith("/calendar/")) externalUrl = parsed.toString();
      } catch {}
      events.push({ id: item.id, kind: "google", title: item.summary?.trim() || "ไม่มีชื่อกิจกรรม", date, time, status: "google", projectId: null, projectName: null, externalUrl });
  }
  events.sort((a, b) => a.date.localeCompare(b.date) || a.title.localeCompare(b.title, "th"));
  return { events, error: null, googleError, googleConnected, truncated: [tasks, milestones, dueProjects, projectNames].some((result) => (result.data?.length ?? 0) === 1000) };
}
