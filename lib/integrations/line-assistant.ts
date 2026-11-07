export type DigestTask = {
  title: string;
  due_date: string | null;
  priority: string;
  status?: string;
  archived_at?: string | null;
};

export type LineAction =
  | { type: "create_task"; title: string; description: string; due_date: string | null; priority: "high" | "medium" | "low" }
  | { type: "create_project"; name: string; goal: string; description: string; target_date: string | null; priority: "high" | "medium" | "low"; milestones: Array<{ name: string; description: string; due_date: string | null }>; tasks: Array<{ title: string; description: string; due_date: string | null; priority: "high" | "medium" | "low"; estimated_minutes: number | null; milestone_index: number | null }> }
  | { type: "create_event"; title: string; description: string; date: string; end_date?: string; start_time: string | null; end_time: string | null }
  | { type: "reschedule_event"; title: string; current_date: string; current_start_time: string | null; new_date: string; new_start_time: string | null; new_end_time: string | null }
  | { type: "complete_task"; title: string }
  | { type: "reschedule_task"; title: string; due_date: string };

export type AiResult = { reply: string; action: LineAction | null; transcript?: string | null };

export type LineHistoryMessage = { role: "user" | "assistant"; content: string };

export function normalizeLineHistory(history: LineHistoryMessage[]): LineHistoryMessage[] {
  const turns: LineHistoryMessage[] = [];
  for (const message of history) {
    const content = message.content.trim();
    if (!content || (message.role === "assistant" && isServiceFailureReply(content)) || (!turns.length && message.role === "assistant")) continue;
    const previous = turns[turns.length - 1];
    if (previous?.role === message.role) previous.content += "\n\n" + content;
    else turns.push({ role: message.role, content });
  }
  // The request is made immediately after a user message is saved. A trailing
  // assistant message would make Gemini answer the wrong turn.
  if (turns[turns.length - 1]?.role === "assistant") turns.pop();
  return turns;
}

function isServiceFailureReply(content: string) {
  return /^(?:เมื่อกี้โป(?:ต่อบริการตอบคำถามไม่ติด|ตอบไม่ทัน|ตอบเต็มโควตา|เปิดเสียงไม่ทัน)|เมื่อกี้บริการตอบเต็มโควตา|เมื่อกี้คำตอบของโปหลุดไป|โปยังต่อบริการ AI ไม่ติด|ตอนนี้ผู้ช่วย AI ตอบกลับไม่ได้ชั่วคราว)/u.test(content);
}

export function validateLineAction(value: unknown): LineAction | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const action = value as Record<string, unknown>;
  if (action.type === "create_task" && typeof action.title === "string" && action.title.trim().length > 0 && action.title.length <= 180) {
    if (action.due_date !== null && action.due_date !== undefined && !validDate(action.due_date)) return null;
    const date = validDate(action.due_date) ? action.due_date : null;
    const priority: "high" | "medium" | "low" = action.priority === "high" || action.priority === "low" ? action.priority : "medium";
    return {
      type: "create_task",
      title: action.title.trim(),
      description: typeof action.description === "string" ? action.description.slice(0, 2000) : "",
      due_date: date,
      priority,
    };
  }
  if (action.type === "create_project" && typeof action.name === "string" && action.name.trim().length > 0 && action.name.length <= 180) {
    const priority = action.priority === "high" || action.priority === "low" ? action.priority : action.priority === "medium" ? "medium" : null;
    const targetDate = action.target_date === null || action.target_date === undefined ? null : validDate(action.target_date) ? action.target_date : undefined;
    if (!priority || targetDate === undefined || !Array.isArray(action.milestones) || !Array.isArray(action.tasks) || action.milestones.length > 8 || action.tasks.length > 12) return null;
    const milestones: Array<{ name: string; description: string; due_date: string | null }> = [];
    for (const value of action.milestones) {
      if (!value || typeof value !== "object" || Array.isArray(value)) return null;
      const item = value as Record<string, unknown>;
      const dueDate = item.due_date === null || item.due_date === undefined ? null : validDate(item.due_date) ? item.due_date : undefined;
      if (typeof item.name !== "string" || !item.name.trim() || item.name.length > 180 || dueDate === undefined) return null;
      milestones.push({ name: item.name.trim(), description: typeof item.description === "string" ? item.description.slice(0, 2000) : "", due_date: dueDate });
    }
    const tasks: Array<{ title: string; description: string; due_date: string | null; priority: "high" | "medium" | "low"; estimated_minutes: number | null; milestone_index: number | null }> = [];
    for (const value of action.tasks) {
      if (!value || typeof value !== "object" || Array.isArray(value)) return null;
      const item = value as Record<string, unknown>;
      const dueDate = item.due_date === null || item.due_date === undefined ? null : validDate(item.due_date) ? item.due_date : undefined;
      const minutes = item.estimated_minutes === null || item.estimated_minutes === undefined ? null : Number.isInteger(item.estimated_minutes) && Number(item.estimated_minutes) >= 0 && Number(item.estimated_minutes) <= 2147483647 ? Number(item.estimated_minutes) : undefined;
      const milestoneIndex = item.milestone_index === null || item.milestone_index === undefined ? null : Number.isInteger(item.milestone_index) && Number(item.milestone_index) >= 0 && Number(item.milestone_index) < milestones.length ? Number(item.milestone_index) : undefined;
      const taskPriority = item.priority === "high" || item.priority === "low" ? item.priority : item.priority === "medium" ? "medium" : null;
      if (typeof item.title !== "string" || !item.title.trim() || item.title.length > 180 || dueDate === undefined || minutes === undefined || milestoneIndex === undefined || !taskPriority) return null;
      tasks.push({ title: item.title.trim(), description: typeof item.description === "string" ? item.description.slice(0, 2000) : "", due_date: dueDate, priority: taskPriority, estimated_minutes: minutes, milestone_index: milestoneIndex });
    }
    if (!tasks.length && !milestones.length) return null;
    return { type: "create_project", name: action.name.trim(), goal: typeof action.goal === "string" ? action.goal.slice(0, 1000) : "", description: typeof action.description === "string" ? action.description.slice(0, 2000) : "", target_date: targetDate, priority, milestones, tasks };
  }
  if (action.type === "create_event" && typeof action.title === "string" && action.title.trim().length > 0 && action.title.length <= 180 && validDate(action.date)) {
    const endDate = action.end_date === undefined || action.end_date === null ? action.date : action.end_date;
    if (!validDate(endDate) || endDate < action.date) return null;
    const hasStartTime = action.start_time !== null && action.start_time !== undefined;
    const hasEndTime = action.end_time !== null && action.end_time !== undefined;
    const startTime = hasStartTime && validTime(action.start_time) ? action.start_time : null;
    const endTime = hasEndTime && validTime(action.end_time) ? action.end_time : null;
    if ((hasStartTime && !startTime) || (hasEndTime && !endTime) || (endTime && !startTime)) return null;
    if (endDate > action.date && (startTime || endTime)) return null;
    if (startTime && endTime && endTime === startTime) return null;
    return {
      type: "create_event",
      title: action.title.trim(),
      description: typeof action.description === "string" ? action.description.slice(0, 2000) : "",
      date: action.date,
      ...(endDate > action.date ? { end_date: endDate } : {}),
      start_time: startTime,
      end_time: endTime,
    };
  }
  if (action.type === "reschedule_event" && typeof action.title === "string" && action.title.trim().length > 0 && action.title.length <= 180 && validDate(action.current_date) && validDate(action.new_date)) {
    const currentStart = action.current_start_time === null || action.current_start_time === undefined ? null : validTime(action.current_start_time) ? action.current_start_time : undefined;
    const newStart = action.new_start_time === null || action.new_start_time === undefined ? null : validTime(action.new_start_time) ? action.new_start_time : undefined;
    const newEnd = action.new_end_time === null || action.new_end_time === undefined ? null : validTime(action.new_end_time) ? action.new_end_time : undefined;
    if (currentStart === undefined || newStart === undefined || newEnd === undefined || (newEnd && !newStart)) return null;
    if (newStart && newEnd && timeToMinutes(newEnd) <= timeToMinutes(newStart)) return null;
    return { type: "reschedule_event", title: action.title.trim(), current_date: action.current_date, current_start_time: currentStart, new_date: action.new_date, new_start_time: newStart, new_end_time: newEnd };
  }
  if ((action.type === "complete_task" || action.type === "reschedule_task") && typeof action.title === "string" && action.title.trim().length > 0 && action.title.length <= 180) {
    if (action.type === "complete_task") return { type: "complete_task", title: action.title.trim() };
    if (validDate(action.due_date)) return { type: "reschedule_task", title: action.title.trim(), due_date: action.due_date };
  }
  return null;
}

export function pendingActionIntent(value: string, action: LineAction): "confirm" | "cancel" | null {
  const normalized = normalizeIntentText(value);
  if (["ยกเลิก", "ยกเลิกครับ", "ยกเลิกค่ะ", "ไม่ต้อง", "ไม่ต้องครับ", "ไม่ต้องค่ะ", "ไม่เอา", "ไม่เอาแล้ว", "cancel", "no"].includes(normalized)) return "cancel";

  const exactConfirmations = ["ยืนยัน", "ยืนยันครับ", "ยืนยันค่ะ", "ตกลง", "ตกลงครับ", "ตกลงค่ะ", "โอเค", "โอเคครับ", "โอเคค่ะ", "ok", "okay", "ทำเลย", "ทำเลยครับ", "ทำเลยค่ะ", "ใช่", "ใช่ครับ", "ใช่ค่ะ", "ได้เลย", "บันทึกเลย", "confirm", "yes"];
  if (exactConfirmations.includes(normalized)) return "confirm";

  const affirmativePrefix = /^(?:โอเค|ok|okay|ตกลง|ยืนยัน|ทำเลย|บันทึกเลย|ใช่|ได้เลย)/iu.test(normalized);
  const containsChange = /(?:เปลี่ยน|แก้|เลื่อน|ย้าย|วันที่ใหม่|วันใหม่|เวลาใหม่|เปลี่ยนเป็น|แก้เป็น|เลื่อนเป็น|ย้ายเป็น|ไม่เอา|ยกเลิก)/u.test(normalized);
  if (affirmativePrefix && !containsChange) {
    // Google Calendar events are one-time unless recurrence is explicitly added.
    // Let the user reiterate that default while confirming an event.
    const oneTimeClarification = /(?:ครั้งเดียว|ครั้งนี้|ปีหน้าไม่ต้อง|ไม่ต้องทำซ้ำ|ไม่ให้ซ้ำ)/u.test(normalized);
    if ((!normalized.includes("แต่") || oneTimeClarification) && (!oneTimeClarification || action.type === "create_event")) return "confirm";
  }
  return null;
}

export function isPendingActionCorrection(value: string) {
  const normalized = normalizeIntentText(value);
  if (/(?:พูดผิด|ก่อนหน้านี้ผิด|ขอแก้|แก้|เปลี่ยน|เลื่อน|ย้าย|ไม่ใช่|หมายถึง|ขอเป็น)/u.test(normalized)) return true;
  const hasDateOrTime = /(?:วันที่|วันเริ่ม|วันสิ้นสุด|ช่วงวัน|เดือน|เวลา)/u.test(normalized);
  const specifiesChange = /(?:ถึง|เป็น|ใหม่|เริ่ม|สิ้นสุด)/u.test(normalized);
  return hasDateOrTime && specifiesChange;
}

export function actionConfirmationText(action: LineAction) {
  if (action.type === "create_project") {
    const plan = [
      ...action.milestones.map((item) => "• หมุดหมาย: " + item.name + (item.due_date ? " · " + formatThaiDate(item.due_date) : "")),
      ...action.tasks.map((item) => "• งาน: " + item.title + (item.due_date ? " · " + formatThaiDate(item.due_date) : "")),
    ];
    const preview = plan.slice(0, 6).join("\n");
    const remaining = plan.length > 6 ? `\nและอีก ${plan.length - 6} รายการ` : "";
    const target = action.target_date ? ` เป้าหมาย ${formatThaiDate(action.target_date)}` : "";
    return `ขอยืนยันก่อนนะ: สร้างโปรเจกต์ “${action.name}”${target} พร้อม ${action.milestones.length} หมุดหมายและ ${action.tasks.length} งานย่อย${preview ? `\n${preview}${remaining}` : ""}\nพิมพ์ “ยืนยัน” เพื่อสร้าง หรือ “ยกเลิก”`;
  }
  if (action.type === "reschedule_event") {
    const from = "วันที่ " + action.current_date + (action.current_start_time ? " เวลา " + action.current_start_time : " (ทั้งวัน)");
    const destinationTime = action.new_start_time ?? action.current_start_time;
    const to = "วันที่ " + action.new_date + (destinationTime ? " เวลา " + destinationTime + (action.new_end_time ? "–" + action.new_end_time : "") : " (ทั้งวัน)");
    return `ขอยืนยันก่อนนะ: เลื่อนนัด “${action.title}” จาก${from} เป็น${to} พิมพ์ “ยืนยัน” เพื่อเลื่อน หรือ “ยกเลิก”`;
  }
  const label = action.type === "create_task" ? "เพิ่มงาน" : action.type === "create_event" ? "สร้างนัดหมายใน Google Calendar" : action.type === "complete_task" ? "ทำเครื่องหมายงานว่าเสร็จ" : "เลื่อนกำหนดงาน";
  const date = action.type === "create_event" ? action.date : action.type === "create_task" || action.type === "reschedule_task" ? action.due_date : null;
  const time = action.type === "create_event" && action.start_time ? " เวลา " + action.start_time + (action.end_time ? "–" + action.end_time : "") : "";
  const range = action.type === "create_event" && action.end_date && action.end_date !== action.date
    ? ` ในช่วงวันที่ ${formatThaiDate(action.date)} ถึง ${formatThaiDate(action.end_date)} (ทั้งวัน)`
    : date ? " วันที่ " + date : "";
  const recurrence = action.type === "create_event" ? " เป็นนัดครั้งเดียว ไม่ทำซ้ำ" : "";
  return "ขอยืนยันก่อนนะครับ: " + label + " “" + action.title + "”" + range + time + recurrence + " พิมพ์ “ยืนยัน” เพื่อทำรายการ หรือ “ยกเลิก”";
}

export function looksLikeActionConfirmation(value: string) {
  return /(?:ขอยืนยันก่อน|พิมพ์.{0,24}ยืนยัน.{0,40}(?:ทำรายการ|สร้าง|บันทึก|เพิ่ม|เลื่อน)|ยืนยันเพื่อ(?:ทำ|สร้าง|บันทึก|เลื่อน))/iu.test(value);
}

function normalizeIntentText(value: string) {
  return value.normalize("NFKC").toLowerCase().replace(/[\s.,!?…:;"'“”‘’()\-]+/gu, "");
}

function formatThaiDate(value: string) {
  const [year, month, day] = value.split("-").map(Number);
  const months = ["มกราคม", "กุมภาพันธ์", "มีนาคม", "เมษายน", "พฤษภาคม", "มิถุนายน", "กรกฎาคม", "สิงหาคม", "กันยายน", "ตุลาคม", "พฤศจิกายน", "ธันวาคม"];
  return `${day} ${months[month - 1]} ${year + 543}`;
}

function validTime(value: unknown): value is string {
  return typeof value === "string" && /^([01]\d|2[0-3]):[0-5]\d$/.test(value);
}

function timeToMinutes(value: string) {
  const [hours, minutes] = value.split(":").map(Number);
  return hours * 60 + minutes;
}

function validDate(value: unknown): value is string {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = new Date(value + "T12:00:00Z");
  return Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}

export function bangkokDateTime(date = new Date()) {
  return {
    date: new Intl.DateTimeFormat("en-CA", {
      timeZone: "Asia/Bangkok", year: "numeric", month: "2-digit", day: "2-digit",
    }).format(date),
    time: new Intl.DateTimeFormat("en-GB", {
      timeZone: "Asia/Bangkok", hour: "2-digit", minute: "2-digit", hourCycle: "h23",
    }).format(date),
  };
}

export function isTimeQuestion(text: string) {
  return /(?:ตอนนี้|ขณะนี้).{0,16}(?:กี่โมง|เวลาอะไร|เวลาเท่าไร)|^(?:กี่โมง|เวลาอะไร|เวลาเท่าไร)\??$/i.test(text.trim());
}

export function isTaskSummaryQuestion(text: string) {
  return /เหลืองานอะไรบ้าง|งานอะไรบ้าง|สรุปงาน(?:ค้าง|ที่เหลือ)?|งานไหนควรรีบ|งานเร่งด่วน|งานค้าง(?:ทั้งหมด)?|ช่วยตามงาน|ตามงาน/i.test(text);
}

export function isAssistantNameQuestion(text: string) {
  return /^(?:(?:เธอ|คุณ|นาย|ผู้ช่วย|โป|โพ)\s*)?(?:ชื่ออะไร|ชื่อว่าอะไร)\??$/i.test(text.trim()) || /(?:เธอ|คุณ|นาย|ผู้ช่วย|โป|โพ).{0,16}(?:ชื่ออะไร|ชื่อว่าอะไร)\??$/i.test(text.trim());
}

export function isPresenceGreeting(text: string) {
  return /^(?:นี่เธอ|เธออยู่ไหม|อยู่ไหม|อยู่ปะ|อยู่มั้ย|โป|โพ|หวัดดี|สวัสดี|hi|hello)(?:ครับ|ค่ะ|จ้า|ค่า)?[!?.\s]*$/i.test(text.trim());
}

export function parseAiResponse(output: string): AiResult | null {
  const normalized = output.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "").trim();
  if (!normalized) return null;

  try {
    const parsed = JSON.parse(normalized) as Partial<AiResult>;
    if (typeof parsed.reply === "string" && parsed.reply.trim()) {
      return {
        reply: parsed.reply.trim(),
        action: parsed.action ?? null,
        ...(typeof parsed.transcript === "string" ? { transcript: parsed.transcript.trim().slice(0, 4500) } : {}),
      };
    }
  } catch {
    // Gemini may return a natural text answer even when JSON was requested.
  }

  const replyField = normalized.match(/"reply"\s*:\s*"((?:\\[\s\S]|[^"\\])*)"/);
  if (replyField) {
    try {
      const reply = JSON.parse(`"${replyField[1]}"`) as string;
      if (reply.trim()) return { reply: reply.trim(), action: null };
    } catch {
      return null;
    }
  }

  if (/^[{\[]/.test(normalized) || /(?:เพิ่มงาน|สร้างนัดหมาย|เลื่อนงาน|เลื่อนนัด|ทำเครื่องหมาย).{0,80}(?:ให้แล้ว|เรียบร้อยแล้ว|เสร็จแล้ว|แล้วครับ|แล้วค่ะ)/i.test(normalized)) return null;
  return { reply: normalized, action: null };
}

function dayDifference(date: string, today: string) {
  return Math.round((Date.parse(date + "T12:00:00Z") - Date.parse(today + "T12:00:00Z")) / 86_400_000);
}

function shortDate(date: string) {
  return new Intl.DateTimeFormat("th-TH", {
    day: "numeric", month: "short", timeZone: "Asia/Bangkok",
  }).format(new Date(`${date}T12:00:00+07:00`));
}

function formatSection(title: string, tasks: DigestTask[], today: string, label: (task: DigestTask) => string, limit = 4) {
  if (!tasks.length) return "";
  const lines = tasks.slice(0, limit).map((task) => `• ${task.title.slice(0, 100)}${label(task) ? ` — ${label(task)}` : ""}`);
  if (tasks.length > limit) lines.push(`• และอีก ${tasks.length - limit} งาน`);
  return `${title} (${tasks.length})\n${lines.join("\n")}`;
}

export function formatTaskDigest(tasks: DigestTask[], today: string, heading = "สรุปงานที่ยังค้าง", includeWeeklyReview = false) {
  const open = tasks.filter((task) => task.status !== "done" && task.status !== "cancelled" && !task.archived_at);
  if (!open.length) return "ตอนนี้ไม่มีงานค้างครับ เยี่ยมเลย 🎉";

  const overdue = open.filter((task) => task.due_date && dayDifference(task.due_date, today) < 0);
  const dueToday = open.filter((task) => task.due_date === today);
  const tomorrow = open.filter((task) => task.due_date && dayDifference(task.due_date, today) === 1);
  const soon = open.filter((task) => task.due_date && dayDifference(task.due_date, today) >= 2 && dayDifference(task.due_date, today) <= 3);
  const shown = new Set([...overdue, ...dueToday, ...tomorrow, ...soon]);
  const important = open.filter((task) => task.priority === "high" && !shown.has(task));
  const otherCount = open.length - shown.size - important.length;
  const sections = [
    formatSection("🔴 เลยกำหนด", overdue, today, (task) => `${shortDate(task.due_date!)} · ${Math.abs(dayDifference(task.due_date!, today))} วันแล้ว`),
    formatSection("⚡ กำหนดวันนี้", dueToday, today, () => "วันนี้"),
    formatSection("📌 กำหนดพรุ่งนี้", tomorrow, today, (task) => shortDate(task.due_date!)),
    formatSection("🗓️ ภายใน 2–3 วัน", soon, today, (task) => shortDate(task.due_date!)),
    formatSection("⭐ งานสำคัญ", important, today, (task) => task.due_date ? shortDate(task.due_date) : "ยังไม่กำหนด"),
  ].filter(Boolean);
  const lead = `${heading} · ${open.length} งาน`;
  const weekly = includeWeeklyReview && isWeeklyReviewDay(today) ? "\n\n" + formatWeeklyTaskReview(open, today) : "";
  if (!sections.length) return `${lead}\nยังไม่มีงานเร่งด่วน งานอื่นอีก ${otherCount} รายการครับ${weekly}`;
  if (otherCount > 0) sections.push(`ยังมีงานอื่นอีก ${otherCount} รายการ`);
  return `${lead}\n\n${sections.join("\n\n")}${weekly}`;
}

export function isWeeklyReviewDay(today: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(today) && new Date(`${today}T12:00:00Z`).getUTCDay() === 0;
}

export function formatWeeklyTaskReview(tasks: DigestTask[], today: string) {
  const open = tasks.filter((task) => task.status !== "done" && task.status !== "cancelled" && !task.archived_at);
  const upcoming = open
    .filter((task) => task.due_date && dayDifference(task.due_date, today) >= 1 && dayDifference(task.due_date, today) <= 7)
    .sort((a, b) => a.due_date!.localeCompare(b.due_date!));
  const importantWithoutDate = open.filter((task) => task.priority === "high" && !task.due_date);
  const lines = [`🗓️ มองสัปดาห์หน้า · ${upcoming.length} งานมีกำหนดส่ง`];
  if (upcoming.length) {
    for (const task of upcoming.slice(0, 5)) lines.push(`• ${task.title.slice(0, 100)} — ${shortDate(task.due_date!)}`);
    if (upcoming.length > 5) lines.push(`• และอีก ${upcoming.length - 5} งาน`);
  } else {
    lines.push("ยังไม่มีงานกำหนดส่งใน 7 วันข้างหน้าครับ");
  }
  if (importantWithoutDate.length) {
    lines.push("⭐ งานสำคัญที่ยังไม่กำหนดวัน");
    for (const task of importantWithoutDate.slice(0, 3)) lines.push(`• ${task.title.slice(0, 100)}`);
    if (importantWithoutDate.length > 3) lines.push(`• และอีก ${importantWithoutDate.length - 3} งาน`);
  }
  return lines.join("\n");
}
