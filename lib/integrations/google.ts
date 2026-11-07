import "server-only";
import { createAdminClient } from "@/lib/integrations/admin";
import { decryptSecret, encryptSecret } from "@/lib/integrations/security";
import { googleAllDayRange, nextCalendarDate } from "@/lib/integrations/calendar-dates";

export type GoogleConnection = {
  google_refresh_token_ciphertext: string | null;
  google_calendar_id: string;
  google_email: string | null;
};

export type GoogleEvent = {
  id: string;
  summary?: string;
  htmlLink?: string;
  start?: { date?: string; dateTime?: string };
  end?: { date?: string; dateTime?: string };
  extendedProperties?: { private?: Record<string, string> };
};

async function accessToken(userId: string) {
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY || !process.env.INTEGRATION_ENCRYPTION_KEY) return null;
  const admin = createAdminClient();
  const { data, error } = await admin.from("integration_connections").select("google_refresh_token_ciphertext").eq("user_id", userId).maybeSingle();
  if (error || !data?.google_refresh_token_ciphertext) return null;
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  if (!clientId || !clientSecret) return null;
  const refreshToken = decryptSecret(data.google_refresh_token_ciphertext);
  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ client_id: clientId, client_secret: clientSecret, refresh_token: refreshToken, grant_type: "refresh_token" }),
    cache: "no-store",
  });
  if (!response.ok) throw new Error("Google Calendar authorization expired or could not be refreshed");
  const token = await response.json() as { access_token?: string; refresh_token?: string };
  if (token.refresh_token) {
    await admin.from("integration_connections").update({ google_refresh_token_ciphertext: encryptSecret(token.refresh_token) }).eq("user_id", userId);
  }
  return token.access_token ?? null;
}

async function calendarRequest(userId: string, path: string, init?: RequestInit) {
  const token = await accessToken(userId);
  if (!token) return null;
  const response = await fetch("https://www.googleapis.com/calendar/v3/calendars/" + encodeURIComponent("primary") + "/events" + path, {
    ...init,
    headers: { authorization: "Bearer " + token, "content-type": "application/json", ...(init?.headers ?? {}) },
    cache: "no-store",
  });
  if (response.status === 404 && init?.method === "DELETE") return { id: "" };
  if (!response.ok) throw new Error("Google Calendar request failed");
  if (response.status === 204) return { id: "" };
  return response.json() as Promise<{ id?: string; items?: GoogleEvent[] }>;
}

export async function listGoogleEvents(userId: string, timeMin: string, timeMax: string): Promise<GoogleEvent[] | null> {
  const query = new URLSearchParams({ timeMin, timeMax, singleEvents: "true", orderBy: "startTime", maxResults: "2500" });
  const result = await calendarRequest(userId, "?" + query.toString());
  return result ? result.items ?? [] : null;
}

export async function deleteTaskCalendarEvent(userId: string, eventId: string): Promise<boolean> {
  const result = await calendarRequest(userId, "/" + encodeURIComponent(eventId), { method: "DELETE" });
  return result !== null;
}

export async function upsertTaskCalendarEvent(userId: string, task: { id: string; title: string; description?: string | null; due_date?: string | null; calendar_event_id?: string | null }): Promise<boolean> {
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY || !process.env.INTEGRATION_ENCRYPTION_KEY) return false;
  const admin = createAdminClient();
  const { data: connection } = await admin.from("integration_connections").select("google_refresh_token_ciphertext").eq("user_id", userId).maybeSingle();
  if (!connection?.google_refresh_token_ciphertext) return false;
  const eventId = task.calendar_event_id ?? null;
  if (!task.due_date) {
    if (eventId && !await calendarRequest(userId, "/" + encodeURIComponent(eventId), { method: "DELETE" })) throw new Error("Google Calendar is not available");
    if (eventId) await admin.from("tasks").update({ calendar_event_id: null }).eq("id", task.id).eq("user_id", userId);
    return true;
  }
  const payload = {
    summary: task.title,
    description: task.description ?? "",
    start: { date: task.due_date },
    end: { date: nextCalendarDate(task.due_date) },
    extendedProperties: { private: { aiWorkAssistantTaskId: task.id } },
  };
  if (eventId) {
    const updated = await calendarRequest(userId, "/" + encodeURIComponent(eventId), { method: "PATCH", body: JSON.stringify(payload) });
    if (!updated) throw new Error("Google Calendar is not available");
  } else {
    const result = await calendarRequest(userId, "", { method: "POST", body: JSON.stringify(payload) });
    if (!result?.id) throw new Error("Google Calendar is not available");
    await admin.from("tasks").update({ calendar_event_id: result.id }).eq("id", task.id).eq("user_id", userId);
  }
  return true;
}

export async function createGoogleCalendarEvent(userId: string, title: string, date: string, description: string, startTime?: string | null, endTime?: string | null, inclusiveEndDate?: string | null, sourceInboxId?: string) {
  let timing: Record<string, unknown>;
  const eventEndDate = inclusiveEndDate ?? date;
  if (eventEndDate < date) throw new Error("Event date range is invalid");
  if (eventEndDate > date && (startTime || endTime)) throw new Error("Multi-day calendar events must be all day");
  const privateProperties = sourceInboxId ? { aiWorkAssistantInboxId: sourceInboxId } : undefined;
  if (privateProperties) {
    const existing = await listGoogleEvents(
      userId,
      date + "T00:00:00+07:00",
      nextCalendarDate(eventEndDate) + "T00:00:00+07:00",
    );
    const match = existing?.find((event) => event.extendedProperties?.private?.aiWorkAssistantInboxId === sourceInboxId);
    if (match?.id) return match.id;
  }
  if (startTime) {
    const [startHour, startMinute] = startTime.split(":").map(Number);
    const [endHour, endMinute] = (endTime ?? "").split(":").map(Number);
    const startMinutes = startHour * 60 + startMinute;
    let endMinutes = endTime ? endHour * 60 + endMinute : startMinutes + 60;
    if (endTime && endMinutes < startMinutes) endMinutes += 1440;
    if (!Number.isFinite(startMinutes) || !Number.isFinite(endMinutes) || endMinutes <= startMinutes || endMinutes >= 2880) {
      throw new Error("Event time range is invalid");
    }
    const endDate = endMinutes >= 1440 ? nextCalendarDate(date) : date;
    const endClock = endMinutes >= 1440 ? String(Math.floor((endMinutes - 1440) / 60)).padStart(2, "0") + ":" + String((endMinutes - 1440) % 60).padStart(2, "0") : String(Math.floor(endMinutes / 60)).padStart(2, "0") + ":" + String(endMinutes % 60).padStart(2, "0");
    timing = {
      start: { dateTime: date + "T" + startTime + ":00+07:00", timeZone: "Asia/Bangkok" },
      end: { dateTime: endDate + "T" + endClock + ":00+07:00", timeZone: "Asia/Bangkok" },
    };
  } else {
    timing = googleAllDayRange(date, eventEndDate);
  }
  const result = await calendarRequest(userId, "", {
    method: "POST",
    body: JSON.stringify({ summary: title, description, ...(privateProperties ? { extendedProperties: { private: privateProperties } } : {}), ...timing }),
  });
  if (!result?.id) throw new Error("Google Calendar is not connected");
  return result.id;
}

export async function rescheduleGoogleCalendarEvent(
  userId: string,
  action: { title: string; current_date: string; current_start_time: string | null; new_date: string; new_start_time: string | null; new_end_time: string | null },
) {
  const events = await listGoogleEvents(
    userId,
    action.current_date + "T00:00:00+07:00",
    nextCalendarDate(action.current_date) + "T00:00:00+07:00",
  );
  if (!events) throw new Error("Google Calendar is not connected");
  const matches = events.filter((event) => {
    if (event.summary !== action.title) return false;
    if (action.current_start_time === null) return event.start?.date === action.current_date;
    return event.start?.dateTime && bangkokDate(event.start.dateTime) === action.current_date && bangkokTime(event.start.dateTime) === action.current_start_time;
  });
  if (matches.length > 1) throw new Error("Calendar event is ambiguous");
  const event = matches[0];
  if (!event?.id) throw new Error("Calendar event was not found");

  let timing: { start: Record<string, string>; end: Record<string, string> };
  if (event.start?.date) {
    if (!action.new_start_time) {
      const originalDays = Math.max(1, dateDifference(event.end?.date ?? nextCalendarDate(event.start.date), event.start.date));
      timing = { start: { date: action.new_date }, end: { date: addDays(action.new_date, originalDays) } };
    } else {
      const start = new Date(`${action.new_date}T${action.new_start_time}:00+07:00`);
      const end = action.new_end_time ? localDateTime(action.new_date, action.new_end_time, action.new_start_time) : new Date(start.getTime() + 60 * 60 * 1000);
      timing = {
        start: { dateTime: start.toISOString(), timeZone: "Asia/Bangkok" },
        end: { dateTime: end.toISOString(), timeZone: "Asia/Bangkok" },
      };
    }
  } else if (event.start?.dateTime) {
    const oldStart = new Date(event.start.dateTime);
    const oldEnd = event.end?.dateTime ? new Date(event.end.dateTime) : new Date(oldStart.getTime() + 60 * 60 * 1000);
    const oldTime = bangkokTime(event.start.dateTime);
    const startTime = action.new_start_time ?? oldTime;
    const start = new Date(`${action.new_date}T${startTime}:00+07:00`);
    const end = action.new_end_time
      ? localDateTime(action.new_date, action.new_end_time, startTime)
      : new Date(start.getTime() + Math.max(15 * 60 * 1000, oldEnd.getTime() - oldStart.getTime()));
    timing = {
      start: { dateTime: start.toISOString(), timeZone: "Asia/Bangkok" },
      end: { dateTime: end.toISOString(), timeZone: "Asia/Bangkok" },
    };
  } else {
    throw new Error("Calendar event was not found");
  }

  const updated = await calendarRequest(userId, "/" + encodeURIComponent(event.id), {
    method: "PATCH",
    body: JSON.stringify(timing),
  });
  if (!updated) throw new Error("Google Calendar is not connected");
  return updated.id;
}

function bangkokTime(value: string) {
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Bangkok", hour: "2-digit", minute: "2-digit", hourCycle: "h23",
  }).format(new Date(value));
}

function bangkokDate(value: string) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Bangkok", year: "numeric", month: "2-digit", day: "2-digit",
  }).format(new Date(value));
}

function dateDifference(end: string, start: string) {
  return Math.round((Date.parse(`${end}T12:00:00Z`) - Date.parse(`${start}T12:00:00Z`)) / 86_400_000);
}

function addDays(value: string, days: number) {
  const date = new Date(`${value}T12:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

function localDateTime(date: string, time: string, startTime: string) {
  const startMinutes = Number(startTime.slice(0, 2)) * 60 + Number(startTime.slice(3, 5));
  const endMinutes = Number(time.slice(0, 2)) * 60 + Number(time.slice(3, 5));
  const targetDate = endMinutes <= startMinutes ? nextCalendarDate(date) : date;
  return new Date(`${targetDate}T${time}:00+07:00`);
}
