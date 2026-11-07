/**
 * Po · AI Work Assistant — Google Apps Script Backend
 * ทำหน้าที่แทน Supabase Database + Auth + Storage + Next.js Server Actions + Vercel Cron
 *
 * คีย์ลับทั้งหมดอ่านจาก Script Properties เท่านั้น (ห้ามใส่ค่าจริงในโค้ด):
 * - SPREADSHEET_ID (ถ้าไม่ใส่ จะใช้ Spreadsheet ที่ผูกกับสคริปต์นี้)
 * - GOOGLE_CLIENT_ID (สำหรับตรวจ Google Identity Services ID Token)
 * - ALLOWED_USER_EMAILS (ตัวเลือก: รายชื่ออีเมลที่อนุญาต คั่นด้วย comma)
 * - GEMINI_API_KEY
 * - GEMINI_PRIMARY_MODEL (ค่าเริ่มต้น: gemini-2.5-flash)
 * - GEMINI_FALLBACK_MODEL (ค่าเริ่มต้น: gemini-2.5-flash-lite)
 * - GEMINI_COMPLEX_MODEL (ค่าเริ่มต้น: gemini-2.5-pro)
 * - LINE_CHANNEL_ACCESS_TOKEN
 * - LINE_CHANNEL_SECRET
 * - LINE_OA_BASIC_ID
 * - LINE_WEBHOOK_TOKEN (token เสริมใน URL ?webhook_token=... สำหรับตรวจ webhook บน Apps Script)
 * - INBOX_DRIVE_FOLDER_ID (ตัวเลือก: โฟลเดอร์ Google Drive เก็บไฟล์แนบ Inbox)
 */

const SHEETS_SCHEMA = {
  tasks: [
    "id", "user_email", "created_at", "updated_at",
    "title", "description", "status", "priority", "due_date",
    "project_id", "milestone_id", "estimated_minutes",
    "completed_at", "archive_after", "archived_at",
    "source_inbox_id", "calendar_event_id"
  ],
  projects: [
    "id", "user_email", "created_at", "updated_at",
    "name", "goal", "description", "status", "priority",
    "risk_level", "progress_percent", "start_date", "target_date", "completed_at"
  ],
  milestones: [
    "id", "user_email", "created_at", "updated_at",
    "project_id", "name", "description", "status", "priority",
    "progress_percent", "due_date", "sequence_no"
  ],
  inbox: [
    "id", "user_email", "created_at", "updated_at",
    "raw_text", "input_type", "source", "processed", "processing_status",
    "ai_summary", "clarification_question", "ai_draft", "ai_commit_result",
    "ai_calendar_event_id", "ai_analyzed_at", "ai_clarification_response"
  ],
  inbox_attachments: [
    "id", "user_email", "created_at", "updated_at",
    "inbox_id", "drive_file_id", "storage_path", "file_name",
    "mime_type", "file_size_bytes", "text_excerpt"
  ],
  settings: [
    "id", "user_email", "created_at", "updated_at",
    "default_work_start", "default_work_end", "daily_capacity_minutes",
    "default_focus_minutes", "default_break_minutes", "daily_max_important_tasks",
    "allow_weekend", "retention_completed_days"
  ],
  integration_connections: [
    "id", "user_email", "created_at", "updated_at",
    "google_refresh_token_ciphertext", "google_calendar_id", "google_email",
    "google_connected_at", "line_user_id", "line_display_name",
    "line_link_code_hash", "line_link_expires_at",
    "line_daily_digest_enabled", "line_voice_enabled"
  ],
  line_messages: [
    "id", "user_email", "created_at", "updated_at",
    "role", "content", "source_event_id", "pending_action", "pending_action_expires_at"
  ],
  line_daily_digest_deliveries: [
    "id", "user_email", "created_at", "updated_at",
    "digest_date", "status", "attempted_at", "sent_at", "error_code"
  ]
};

const DEFAULT_SETTINGS = {
  default_work_start: "18:00",
  default_work_end: "21:00",
  daily_capacity_minutes: 180,
  default_focus_minutes: 25,
  default_break_minutes: 5,
  daily_max_important_tasks: 3,
  allow_weekend: true,
  retention_completed_days: 30
};

/**
 * 1. สร้างแท็บตารางทั้งหมดและหัวคอลัมน์ใน Google Sheet อัตโนมัติ
 */
function setupSheets() {
  const ss = getSpreadsheet_();
  Object.keys(SHEETS_SCHEMA).forEach(function (sheetName) {
    const headers = SHEETS_SCHEMA[sheetName];
    let sheet = ss.getSheetByName(sheetName);
    if (!sheet) {
      sheet = ss.insertSheet(sheetName);
    }
    if (sheet.getLastRow() === 0) {
      sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
      sheet.setFrozenRows(1);
    } else {
      const existing = sheet.getRange(1, 1, 1, Math.max(sheet.getLastColumn(), 1)).getValues()[0];
      headers.forEach(function (col) {
        if (existing.indexOf(col) === -1) {
          existing.push(col);
        }
      });
      sheet.getRange(1, 1, 1, existing.length).setValues([existing]);
      sheet.setFrozenRows(1);
    }
  });
  return { ok: true, tables: Object.keys(SHEETS_SCHEMA) };
}

/**
 * 2. ตั้ง Time-driven Trigger แทน Vercel Cron (ทำงานทุกวันเวลา 18:00 น. เวลาไทย)
 */
function setupDailyDigestTrigger() {
  const triggers = ScriptApp.getProjectTriggers();
  triggers.forEach(function (trigger) {
    if (trigger.getHandlerFunction() === "runDailyLineDigest") {
      ScriptApp.deleteTrigger(trigger);
    }
  });
  ScriptApp.newTrigger("runDailyLineDigest")
    .timeBased()
    .atHour(18)
    .everyDays(1)
    .inTimezone("Asia/Bangkok")
    .create();
  return { ok: true, message: "ตั้งเวลาส่งสรุปงาน LINE รายวัน (18:00 น.) เรียบร้อยแล้ว" };
}

/**
 * HTTP GET Handler (Health check & basic info)
 */
function doGet(e) {
  const params = (e && e.parameter) || {};
  if (params.action === "health") {
    return jsonResponse_({ ok: true, service: "Po AI Work Assistant GAS Backend", time: nowIso_() });
  }
  return jsonResponse_({
    ok: true,
    message: "Po · AI Work Assistant API is running. Use POST with action and idToken."
  });
}

/**
 * HTTP POST Handler (CRUD API, Gemini Analysis, LINE Webhook, Data Import)
 */
function doPost(e) {
  try {
    const rawBody = (e && e.postData && e.postData.contents) ? e.postData.contents : "{}";
    const body = JSON.parse(rawBody);
    const params = (e && e.parameter) || {};

    // กรณี LINE Webhook (มี body.events เป็น Array)
    if (Array.isArray(body.events)) {
      const expectedToken = getProp_("LINE_WEBHOOK_TOKEN");
      if (expectedToken && params.webhook_token !== expectedToken) {
        return jsonResponse_({ ok: false, message: "Unauthorized webhook" });
      }
      handleLineWebhookEvents_(body.events);
      return jsonResponse_({ ok: true });
    }

    const action = body.action || params.action || "";
    const idToken = body.idToken || params.idToken || "";

    // ตรวจสอบ Google ID Token ก่อนเข้าถึงข้อมูลทุกครั้ง
    const user = verifyGoogleIdToken_(idToken);
    if (!user || !user.email) {
      return jsonResponse_({ ok: false, error: "UNAUTHORIZED", message: "เซสชันหมดอายุหรือไม่ถูกต้อง กรุณาเข้าสู่ระบบด้วย Google อีกครั้ง" });
    }

    const email = user.email.toLowerCase();
    const payload = body.payload || {};

    switch (action) {
      case "auth.me":
        return jsonResponse_({ ok: true, data: user });
      case "dashboard.get":
        return jsonResponse_({ ok: true, data: getDashboardData_(email) });
      case "tasks.list":
        return jsonResponse_({ ok: true, data: listTasksData_(email, payload) });
      case "tasks.save":
        return jsonResponse_(saveTaskData_(email, payload));
      case "tasks.changeStatus":
        return jsonResponse_(changeTaskStatusData_(email, payload));
      case "tasks.delete":
        return jsonResponse_(deleteTaskData_(email, payload));
      case "projects.list":
        return jsonResponse_({ ok: true, data: listProjectsData_(email, payload) });
      case "projects.detail":
        return jsonResponse_({ ok: true, data: getProjectDetailData_(email, payload.id) });
      case "projects.save":
        return jsonResponse_(saveProjectData_(email, payload));
      case "projects.changeStatus":
        return jsonResponse_(changeProjectStatusData_(email, payload));
      case "projects.delete":
        return jsonResponse_(deleteProjectData_(email, payload));
      case "milestones.save":
        return jsonResponse_(saveMilestoneData_(email, payload));
      case "calendar.get":
        return jsonResponse_({ ok: true, data: getCalendarData_(email, payload.month) });
      case "inbox.list":
        return jsonResponse_({ ok: true, data: listInboxData_(email, payload) });
      case "inbox.capture":
        return jsonResponse_(captureInboxData_(email, payload));
      case "inbox.analyze":
        return jsonResponse_(analyzeInboxData_(email, payload));
      case "inbox.commit":
        return jsonResponse_(commitInboxData_(email, payload));
      case "reports.get":
        return jsonResponse_({ ok: true, data: getReportsData_(email) });
      case "settings.get":
        return jsonResponse_({ ok: true, data: getSettingsPageData_(email) });
      case "settings.save":
        return jsonResponse_(saveSettingsData_(email, payload));
      case "integrations.google.connect":
        return jsonResponse_(connectGoogleCalendar_(email));
      case "integrations.google.disconnect":
        return jsonResponse_(disconnectIntegration_(email, "google"));
      case "integrations.line.link":
        return jsonResponse_(createLineLinkCode_(email));
      case "integrations.line.disconnect":
        return jsonResponse_(disconnectIntegration_(email, "line"));
      case "integrations.line.digest":
        return jsonResponse_(toggleLineDigest_(email, Boolean(payload.enabled)));
      case "integrations.line.voice":
        return jsonResponse_(toggleLineVoice_(email, Boolean(payload.enabled)));
      case "integrations.line.clearHistory":
        return jsonResponse_(clearLineHistory_(email));
      case "admin.importRows":
        return jsonResponse_(importTableRows_(email, payload));
      default:
        return jsonResponse_({ ok: false, message: "ไม่รู้จักคำสั่ง: " + action });
    }
  } catch (err) {
    return jsonResponse_({
      ok: false,
      message: err && err.message ? String(err.message) : "เกิดข้อผิดพลาดในฝั่งเซิร์ฟเวอร์"
    });
  }
}

/* ============================================================================
 * AUTHENTICATION (Google Identity Services ID Token Verification)
 * ========================================================================== */

function verifyGoogleIdToken_(idToken) {
  if (!idToken || typeof idToken !== "string") return null;
  const cache = CacheService.getScriptCache();
  const cacheKey = "gis_tok_" + Utilities.base64EncodeWebSafe(Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, idToken)).slice(0, 32);
  const cached = cache.get(cacheKey);
  if (cached) {
    try { return JSON.parse(cached); } catch (_) {}
  }

  const res = UrlFetchApp.fetch("https://oauth2.googleapis.com/tokeninfo?id_token=" + encodeURIComponent(idToken), {
    muteHttpExceptions: true
  });
  if (res.getResponseCode() !== 200) return null;
  const info = JSON.parse(res.getContentText());
  if (!info || !info.email || String(info.email_verified) !== "true") return null;

  const expectedClientId = getProp_("GOOGLE_CLIENT_ID");
  if (expectedClientId && info.aud !== expectedClientId) return null;

  const allowedEmailsRaw = getProp_("ALLOWED_USER_EMAILS");
  if (allowedEmailsRaw) {
    const allowed = allowedEmailsRaw.split(",").map(function (s) { return s.trim().toLowerCase(); }).filter(Boolean);
    if (allowed.length > 0 && allowed.indexOf(String(info.email).toLowerCase()) === -1) {
      return null;
    }
  }

  const user = {
    email: String(info.email).toLowerCase(),
    name: info.name || info.email,
    picture: info.picture || "",
    sub: info.sub || ""
  };
  cache.put(cacheKey, JSON.stringify(user), 300);
  return user;
}

/* ============================================================================
 * DASHBOARD, TASKS, PROJECTS, MILESTONES, REPORTS, SETTINGS
 * ========================================================================== */

function getDashboardData_(email) {
  const today = bangkokToday_();
  const tasks = readUserRows_("tasks", email).filter(function (t) { return !t.archived_at; });
  const projects = readUserRows_("projects", email);
  const inbox = readUserRows_("inbox", email);

  const openTasks = tasks.filter(function (t) { return t.status !== "done" && t.status !== "cancelled"; });
  const todayTasks = openTasks.filter(function (t) { return t.due_date === today; }).length;
  const important = openTasks.filter(function (t) { return t.priority === "high"; }).length;
  const overdue = openTasks.filter(function (t) { return t.due_date && t.due_date < today; }).length;
  const activeProjects = projects.filter(function (p) { return p.status === "active"; }).length;
  const pendingInbox = inbox.filter(function (i) { return i.processing_status === "pending"; }).length;

  const topTasks = openTasks.slice().sort(function (a, b) {
    if (!a.due_date && !b.due_date) return 0;
    if (!a.due_date) return 1;
    if (!b.due_date) return -1;
    return String(a.due_date).localeCompare(String(b.due_date));
  }).slice(0, 3).map(function (t) {
    return { id: t.id, title: t.title, priority: t.priority || "medium", due_date: t.due_date || null };
  });

  const topProjects = projects.filter(function (p) {
    return p.status === "active" || p.status === "planning";
  }).sort(function (a, b) {
    return String(b.updated_at || "").localeCompare(String(a.updated_at || ""));
  }).slice(0, 2).map(function (p) {
    return { id: p.id, name: p.name, progress_percent: Number(p.progress_percent || 0), status: p.status };
  });

  return {
    today: today,
    todayTasks: todayTasks,
    important: important,
    overdue: overdue,
    activeProjects: activeProjects,
    pendingInbox: pendingInbox,
    tasks: topTasks,
    projects: topProjects,
    error: null
  };
}

function listTasksData_(email, filters) {
  const today = bangkokToday_();
  const pageSize = 30;
  const search = String((filters && filters.search) || "").trim().toLowerCase();
  const status = (filters && filters.status) || "all";
  const priority = (filters && filters.priority) || "all";
  const project = (filters && filters.project) || "";
  const due = (filters && filters.due) || "all";
  const page = Math.max(1, Number((filters && filters.page) || 1));

  let rows = readUserRows_("tasks", email).filter(function (t) { return !t.archived_at; });
  if (search) rows = rows.filter(function (t) { return String(t.title || "").toLowerCase().indexOf(search) !== -1; });
  if (status !== "all") rows = rows.filter(function (t) { return t.status === status; });
  if (priority !== "all") rows = rows.filter(function (t) { return t.priority === priority; });
  if (project) rows = rows.filter(function (t) { return t.project_id === project; });
  if (due === "today") rows = rows.filter(function (t) { return t.due_date === today; });
  if (due === "overdue") rows = rows.filter(function (t) { return t.due_date && t.due_date < today && t.status !== "done" && t.status !== "cancelled"; });

  rows.sort(function (a, b) {
    return String(b.created_at || "").localeCompare(String(a.created_at || "")) || String(b.id).localeCompare(String(a.id));
  });

  const count = rows.length;
  const offset = (page - 1) * pageSize;
  const paged = rows.slice(offset, offset + pageSize).map(normalizeTaskRow_);

  const projects = readUserRows_("projects", email).sort(function (a, b) {
    return String(a.name || "").localeCompare(String(b.name || ""), "th");
  }).map(function (p) { return { id: p.id, name: p.name }; });

  return { tasks: paged, projects: projects, count: count, today: today, error: null };
}

function saveTaskData_(email, payload) {
  const title = String(payload.title || "").trim();
  if (!title || title.length > 200) return { ok: false, message: "กรุณาระบุชื่องาน (ไม่เกิน 200 ตัวอักษร)" };
  const now = nowIso_();
  const id = String(payload.id || "").trim();
  const status = payload.status || "not_started";
  const priority = payload.priority || "medium";
  const dueDate = payload.due_date || null;
  const projectId = payload.project_id || null;
  const estimatedMinutes = payload.estimated_minutes === null || payload.estimated_minutes === "" || payload.estimated_minutes === undefined
    ? null
    : Number(payload.estimated_minutes);

  const settings = getUserSettings_(email);
  const retentionDays = Number(settings.retention_completed_days || 30);

  if (id) {
    const existing = findUserRow_("tasks", email, id);
    if (!existing) return { ok: false, message: "ไม่พบงานที่ต้องการแก้ไข" };
    if (payload.updated_at && existing.updated_at && existing.updated_at !== payload.updated_at) {
      return { ok: false, message: "งานนี้เปลี่ยนไปแล้ว กรุณาโหลดหน้าใหม่ก่อนแก้ไข" };
    }
    const completedAt = status === "done" ? (existing.completed_at || now) : null;
    const archiveAfter = status === "done" ? addDaysIso_(completedAt, retentionDays) : null;
    const updated = Object.assign({}, existing, {
      title: title,
      description: payload.description || null,
      status: status,
      priority: priority,
      due_date: dueDate,
      project_id: projectId,
      milestone_id: existing.project_id !== projectId ? null : existing.milestone_id,
      estimated_minutes: estimatedMinutes,
      completed_at: completedAt,
      archive_after: archiveAfter,
      updated_at: now
    });
    const syncedEventId = syncTaskCalendarIfConnected_(email, updated);
    if (syncedEventId !== undefined) updated.calendar_event_id = syncedEventId;
    updateRowById_("tasks", email, id, updated);
    return { ok: true, message: "บันทึกการแก้ไขแล้ว" };
  } else {
    const newId = Utilities.getUuid();
    const completedAt = status === "done" ? now : null;
    const archiveAfter = status === "done" ? addDaysIso_(now, retentionDays) : null;
    const row = {
      id: newId,
      user_email: email,
      created_at: now,
      updated_at: now,
      title: title,
      description: payload.description || null,
      status: status,
      priority: priority,
      due_date: dueDate,
      project_id: projectId,
      milestone_id: payload.milestone_id || null,
      estimated_minutes: estimatedMinutes,
      completed_at: completedAt,
      archive_after: archiveAfter,
      archived_at: null,
      source_inbox_id: payload.source_inbox_id || null,
      calendar_event_id: null
    };
    const syncedEventId = syncTaskCalendarIfConnected_(email, row);
    if (syncedEventId) row.calendar_event_id = syncedEventId;
    insertRow_("tasks", row);
    return { ok: true, message: "เพิ่มงานแล้ว", id: newId };
  }
}

function changeTaskStatusData_(email, payload) {
  const id = String(payload.id || "");
  const status = String(payload.status || "");
  const existing = findUserRow_("tasks", email, id);
  if (!existing) return { ok: false, message: "ไม่พบงานที่ต้องการเปลี่ยนสถานะ" };
  const now = nowIso_();
  const settings = getUserSettings_(email);
  const retentionDays = Number(settings.retention_completed_days || 30);
  const completedAt = status === "done" ? (existing.completed_at || now) : null;
  const archiveAfter = status === "done" ? addDaysIso_(completedAt, retentionDays) : null;
  const updated = Object.assign({}, existing, {
    status: status,
    completed_at: completedAt,
    archive_after: archiveAfter,
    updated_at: now
  });
  updateRowById_("tasks", email, id, updated);
  return {
    ok: true,
    message: status === "done" ? "ทำงานเสร็จแล้ว และยังเก็บประวัติไว้ตามนโยบายของบัญชี" : "นำงานกลับมาดำเนินการแล้ว"
  };
}

function deleteTaskData_(email, payload) {
  const id = String(payload.id || "");
  const existing = findUserRow_("tasks", email, id);
  if (!existing) return { ok: false, message: "ไม่พบงานที่ต้องการลบ" };
  if (existing.calendar_event_id) {
    deleteCalendarEventQuietly_(email, existing.calendar_event_id);
  }
  deleteRowById_("tasks", email, id);
  return { ok: true, message: "ลบงานแล้ว" };
}

function listProjectsData_(email, filters) {
  const today = bangkokToday_();
  const pageSize = 12;
  const search = String((filters && filters.search) || "").trim().toLowerCase();
  const status = (filters && filters.status) || "all";
  const page = Math.max(1, Number((filters && filters.page) || 1));

  const allProjects = readUserRows_("projects", email).map(normalizeProjectRow_);
  const active = allProjects.filter(function (p) { return p.status === "active"; }).length;
  const completed = allProjects.filter(function (p) { return p.status === "completed"; }).length;
  const overdue = allProjects.filter(function (p) {
    return p.target_date && p.target_date < today && p.status !== "completed" && p.status !== "cancelled";
  }).length;

  let filtered = allProjects.slice();
  if (search) filtered = filtered.filter(function (p) { return String(p.name || "").toLowerCase().indexOf(search) !== -1; });
  if (status !== "all") filtered = filtered.filter(function (p) { return p.status === status; });
  filtered.sort(function (a, b) { return String(b.updated_at || "").localeCompare(String(a.updated_at || "")); });

  const count = filtered.length;
  const offset = (page - 1) * pageSize;
  return {
    projects: filtered.slice(offset, offset + pageSize),
    count: count,
    active: active,
    completed: completed,
    overdue: overdue,
    error: null
  };
}

function getProjectDetailData_(email, id) {
  const project = findUserRow_("projects", email, id);
  if (!project) return { project: null, milestones: [], tasks: [], error: "ไม่พบโปรเจกต์" };
  const milestones = readUserRows_("milestones", email)
    .filter(function (m) { return m.project_id === id; })
    .sort(function (a, b) { return Number(a.sequence_no || 0) - Number(b.sequence_no || 0) || String(a.created_at || "").localeCompare(String(b.created_at || "")); })
    .map(normalizeMilestoneRow_);
  const tasks = readUserRows_("tasks", email)
    .filter(function (t) { return t.project_id === id && !t.archived_at; })
    .sort(function (a, b) { return String(b.created_at || "").localeCompare(String(a.created_at || "")); })
    .slice(0, 100)
    .map(function (t) {
      return { id: t.id, title: t.title, status: t.status, priority: t.priority, due_date: t.due_date || null };
    });
  return { project: normalizeProjectRow_(project), milestones: milestones, tasks: tasks, error: null };
}

function saveProjectData_(email, payload) {
  const name = String(payload.name || "").trim();
  if (!name || name.length > 200) return { ok: false, message: "กรุณาระบุชื่อโปรเจกต์ (ไม่เกิน 200 ตัวอักษร)" };
  const now = nowIso_();
  const id = String(payload.id || "").trim();
  const status = payload.status || "planning";
  const progress = Math.min(100, Math.max(0, Number(payload.progress_percent || 0)));

  if (id) {
    const existing = findUserRow_("projects", email, id);
    if (!existing) return { ok: false, message: "ไม่พบโปรเจกต์ที่ต้องการแก้ไข" };
    const updated = Object.assign({}, existing, {
      name: name,
      goal: payload.goal || null,
      description: payload.description || null,
      status: status,
      priority: payload.priority || "medium",
      risk_level: payload.risk_level || "green",
      progress_percent: progress,
      start_date: payload.start_date || null,
      target_date: payload.target_date || null,
      completed_at: status === "completed" ? (existing.completed_at || now) : null,
      updated_at: now
    });
    updateRowById_("projects", email, id, updated);
    return { ok: true, message: "บันทึกโปรเจกต์แล้ว", id: id };
  } else {
    const newId = Utilities.getUuid();
    insertRow_("projects", {
      id: newId,
      user_email: email,
      created_at: now,
      updated_at: now,
      name: name,
      goal: payload.goal || null,
      description: payload.description || null,
      status: status,
      priority: payload.priority || "medium",
      risk_level: payload.risk_level || "green",
      progress_percent: progress,
      start_date: payload.start_date || null,
      target_date: payload.target_date || null,
      completed_at: status === "completed" ? now : null
    });
    return { ok: true, message: "เพิ่มโปรเจกต์แล้ว", id: newId };
  }
}

function changeProjectStatusData_(email, payload) {
  const id = String(payload.id || "");
  const status = String(payload.status || "");
  const existing = findUserRow_("projects", email, id);
  if (!existing) return { ok: false, message: "ไม่พบโปรเจกต์" };
  const now = nowIso_();
  const updated = Object.assign({}, existing, {
    status: status,
    completed_at: status === "completed" ? now : null,
    progress_percent: status === "completed" ? 100 : existing.progress_percent,
    updated_at: now
  });
  updateRowById_("projects", email, id, updated);
  return { ok: true, message: status === "completed" ? "ปิดโปรเจกต์แล้ว" : "นำโปรเจกต์กลับมาดำเนินการแล้ว" };
}

function deleteProjectData_(email, payload) {
  const id = String(payload.id || "");
  const existing = findUserRow_("projects", email, id);
  if (!existing) return { ok: false, message: "ไม่พบโปรเจกต์ที่ต้องการลบ" };

  // ลบ milestones ของโปรเจกต์นี้ และเคลียร์ project_id ใน tasks ที่ผูกอยู่
  const milestones = readUserRows_("milestones", email).filter(function (m) { return m.project_id === id; });
  milestones.forEach(function (m) { deleteRowById_("milestones", email, m.id); });

  const tasks = readUserRows_("tasks", email).filter(function (t) { return t.project_id === id; });
  tasks.forEach(function (t) {
    updateRowById_("tasks", email, t.id, Object.assign({}, t, { project_id: null, milestone_id: null, updated_at: nowIso_() }));
  });

  deleteRowById_("projects", email, id);
  return { ok: true, message: "ลบโปรเจกต์แล้ว งานที่เคยอยู่ในโปรเจกต์ยังคงอยู่" };
}

function saveMilestoneData_(email, payload) {
  const projectId = String(payload.project_id || "");
  const name = String(payload.name || "").trim();
  if (!projectId || !name) return { ok: false, message: "กรุณาระบุชื่อ Milestone" };
  const project = findUserRow_("projects", email, projectId);
  if (!project) return { ok: false, message: "ไม่พบโปรเจกต์ของคุณ" };

  const now = nowIso_();
  const id = String(payload.id || "").trim();
  if (id) {
    const existing = findUserRow_("milestones", email, id);
    if (!existing) return { ok: false, message: "ไม่พบ Milestone" };
    updateRowById_("milestones", email, id, Object.assign({}, existing, {
      name: name,
      description: payload.description || null,
      status: payload.status || "not_started",
      progress_percent: Math.min(100, Math.max(0, Number(payload.progress_percent || 0))),
      due_date: payload.due_date || null,
      updated_at: now
    }));
    return { ok: true, message: "บันทึก Milestone แล้ว" };
  } else {
    insertRow_("milestones", {
      id: Utilities.getUuid(),
      user_email: email,
      created_at: now,
      updated_at: now,
      project_id: projectId,
      name: name,
      description: payload.description || null,
      status: payload.status || "not_started",
      priority: payload.priority || "medium",
      progress_percent: Math.min(100, Math.max(0, Number(payload.progress_percent || 0))),
      due_date: payload.due_date || null,
      sequence_no: 0
    });
    return { ok: true, message: "เพิ่ม Milestone แล้ว" };
  }
}

/* ============================================================================
 * CALENDAR & REPORTS & SETTINGS
 * ========================================================================== */

function getCalendarData_(email, monthParam) {
  const today = bangkokToday_();
  const month = (monthParam && /^\d{4}-\d{2}$/.test(monthParam)) ? monthParam : today.slice(0, 7);
  const start = month + "-01";
  const year = Number(month.slice(0, 4));
  const monthIndex = Number(month.slice(5, 7)) - 1;
  const end = new Date(Date.UTC(year, monthIndex + 1, 0)).toISOString().slice(0, 10);

  const projects = readUserRows_("projects", email);
  const projectNames = {};
  projects.forEach(function (p) { projectNames[p.id] = p.name; });

  const tasks = readUserRows_("tasks", email).filter(function (t) {
    return !t.archived_at && t.due_date && t.due_date >= start && t.due_date <= end;
  });
  const milestones = readUserRows_("milestones", email).filter(function (m) {
    return m.due_date && m.due_date >= start && m.due_date <= end;
  });
  const dueProjects = projects.filter(function (p) {
    return p.target_date && p.target_date >= start && p.target_date <= end;
  });

  const events = [];
  const taskEventIds = {};
  tasks.forEach(function (t) {
    if (t.calendar_event_id) taskEventIds[t.calendar_event_id] = true;
    events.push({
      id: t.id, kind: "task", title: t.title, date: t.due_date, status: t.status,
      projectId: t.project_id || null, projectName: t.project_id ? (projectNames[t.project_id] || null) : null
    });
  });
  milestones.forEach(function (m) {
    events.push({
      id: m.id, kind: "milestone", title: m.name, date: m.due_date, status: m.status,
      projectId: m.project_id || null, projectName: m.project_id ? (projectNames[m.project_id] || null) : null
    });
  });
  dueProjects.forEach(function (p) {
    events.push({
      id: p.id, kind: "project", title: p.name, date: p.target_date, status: p.status,
      projectId: p.id, projectName: null
    });
  });

  const conn = findUserConnection_(email);
  const googleConnected = Boolean(conn && conn.google_connected_at);
  let googleError = null;
  if (googleConnected) {
    try {
      const cal = CalendarApp.getCalendarById(conn.google_calendar_id || email) || CalendarApp.getDefaultCalendar();
      if (cal) {
        const gEvents = cal.getEvents(new Date(start + "T00:00:00+07:00"), new Date(end + "T23:59:59+07:00"));
        gEvents.forEach(function (ge) {
          const gId = ge.getId();
          if (taskEventIds[gId]) return;
          const startDt = ge.getStartTime();
          const dateStr = Utilities.formatDate(startDt, "Asia/Bangkok", "yyyy-MM-dd");
          const timeStr = ge.isAllDayEvent() ? null : Utilities.formatDate(startDt, "Asia/Bangkok", "HH:mm");
          events.push({
            id: gId, kind: "google", title: ge.getTitle() || "ไม่มีชื่อกิจกรรม",
            date: dateStr, time: timeStr, status: "google", projectId: null, projectName: null, externalUrl: null
          });
        });
      }
    } catch (_) {
      googleError = "เชื่อม Google Calendar ไม่สำเร็จในครั้งนี้ กำหนดการจากระบบยังแสดงตามปกติ";
    }
  }

  events.sort(function (a, b) {
    return String(a.date).localeCompare(String(b.date)) || String(a.title).localeCompare(String(b.title), "th");
  });

  return { events: events, error: null, googleError: googleError, googleConnected: googleConnected, truncated: false };
}

function getReportsData_(email) {
  const today = bangkokToday_();
  const tasks = readUserRows_("tasks", email).filter(function (t) { return !t.archived_at; });
  const projects = readUserRows_("projects", email);

  const open = tasks.filter(function (t) { return t.status !== "done" && t.status !== "cancelled"; }).length;
  const overdue = tasks.filter(function (t) { return t.status !== "done" && t.status !== "cancelled" && t.due_date && t.due_date < today; }).length;
  const projectsActive = projects.filter(function (p) { return p.status === "active"; }).length;
  const projectsCompleted = projects.filter(function (p) { return p.status === "completed"; }).length;

  const daily = [];
  let totalCompleted7d = 0;
  for (let i = 6; i >= 0; i--) {
    const d = shiftDateStr_(today, -i);
    const count = tasks.filter(function (t) {
      if (!t.completed_at) return false;
      const completedDate = Utilities.formatDate(new Date(t.completed_at), "Asia/Bangkok", "yyyy-MM-dd");
      return completedDate === d;
    }).length;
    totalCompleted7d += count;
    daily.push({ date: d, count: count });
  }

  return {
    error: null, today: today, open: open, overdue: overdue,
    projectsActive: projectsActive, projectsCompleted: projectsCompleted,
    completed: totalCompleted7d, daily: daily
  };
}

function getSettingsPageData_(email) {
  const settings = getUserSettings_(email);
  const conn = findUserConnection_(email);
  const messages = readUserRows_("line_messages", email)
    .sort(function (a, b) { return String(b.created_at || "").localeCompare(String(a.created_at || "")); })
    .slice(0, 8)
    .map(function (m) { return { role: m.role, content: m.content, created_at: m.created_at }; });

  const lineConfigured = Boolean(getProp_("LINE_CHANNEL_ACCESS_TOKEN") && getProp_("GEMINI_API_KEY"));
  return {
    email: email,
    settings: settings,
    error: null,
    integration: {
      googleConfigured: true,
      lineConfigured: lineConfigured,
      dataReady: true,
      googleConnected: Boolean(conn && conn.google_connected_at),
      googleEmail: (conn && conn.google_email) || email,
      lineConnected: Boolean(conn && conn.line_user_id),
      lineDisplayName: (conn && conn.line_display_name) || null,
      lineDailyDigestEnabled: Boolean(conn && String(conn.line_daily_digest_enabled) === "true"),
      lineVoiceEnabled: Boolean(conn && String(conn.line_voice_enabled) === "true"),
      lineVoiceAvailable: true,
      recentMessages: messages,
      integrationNotice: null
    }
  };
}

function saveSettingsData_(email, payload) {
  const now = nowIso_();
  const rows = readUserRows_("settings", email);
  const record = {
    id: rows[0] ? rows[0].id : Utilities.getUuid(),
    user_email: email,
    created_at: rows[0] ? rows[0].created_at : now,
    updated_at: now,
    default_work_start: String(payload.default_work_start || "18:00").slice(0, 5),
    default_work_end: String(payload.default_work_end || "21:00").slice(0, 5),
    daily_capacity_minutes: Number(payload.daily_capacity_minutes || 180),
    default_focus_minutes: Number(payload.default_focus_minutes || 25),
    default_break_minutes: Number(payload.default_break_minutes || 5),
    daily_max_important_tasks: Number(payload.daily_max_important_tasks || 3),
    allow_weekend: Boolean(payload.allow_weekend),
    retention_completed_days: rows[0] ? Number(rows[0].retention_completed_days || 30) : 30
  };
  if (rows[0]) {
    updateRowById_("settings", email, rows[0].id, record);
  } else {
    insertRow_("settings", record);
  }
  return { ok: true, message: "บันทึกการตั้งค่าแล้ว" };
}

/* ============================================================================
 * INBOX & GEMINI AI WORKFLOW
 * ========================================================================== */

function listInboxData_(email, filters) {
  const pageSize = 15;
  const search = String((filters && filters.search) || "").trim().toLowerCase();
  const status = (filters && filters.status) || "all";
  const page = Math.max(1, Number((filters && filters.page) || 1));

  const allItems = readUserRows_("inbox", email);
  const pending = allItems.filter(function (i) { return i.processing_status === "pending"; }).length;
  const clarification = allItems.filter(function (i) { return i.processing_status === "needs_clarification"; }).length;

  let filtered = allItems.slice();
  if (search) filtered = filtered.filter(function (i) { return String(i.raw_text || "").toLowerCase().indexOf(search) !== -1; });
  if (status !== "all") filtered = filtered.filter(function (i) { return i.processing_status === status; });
  filtered.sort(function (a, b) { return String(b.created_at || "").localeCompare(String(a.created_at || "")); });

  const attachments = readUserRows_("inbox_attachments", email);
  const byInbox = {};
  attachments.forEach(function (att) {
    if (!byInbox[att.inbox_id]) byInbox[att.inbox_id] = [];
    byInbox[att.inbox_id].push({
      file_name: att.file_name,
      mime_type: att.mime_type,
      file_size_bytes: Number(att.file_size_bytes || 0)
    });
  });

  const count = filtered.length;
  const offset = (page - 1) * pageSize;
  const items = filtered.slice(offset, offset + pageSize).map(function (item) {
    return {
      id: item.id,
      raw_text: item.raw_text,
      input_type: item.input_type || "text",
      source: item.source || "web",
      processed: String(item.processed) === "true",
      processing_status: item.processing_status || "pending",
      ai_summary: item.ai_summary || null,
      clarification_question: item.clarification_question || null,
      ai_draft: parseJsonSafe_(item.ai_draft),
      ai_commit_result: parseJsonSafe_(item.ai_commit_result),
      ai_clarification_response: item.ai_clarification_response || null,
      created_at: item.created_at,
      attachments: byInbox[item.id] || []
    };
  });

  return { items: items, count: count, pending: pending, clarification: clarification, error: null };
}

function captureInboxData_(email, payload) {
  const rawText = String(payload.raw_text || "").trim();
  const attachment = payload.attachment || null;
  if (!rawText && !attachment) {
    return { ok: false, message: "พิมพ์ข้อความหรือแนบไฟล์อย่างน้อยหนึ่งอย่างก่อนบันทึก" };
  }
  const now = nowIso_();
  const inboxId = Utilities.getUuid();
  const storedText = rawText || "ช่วยวิเคราะห์ไฟล์ที่แนบมา สรุปสาระสำคัญ และเสนอสิ่งที่ควรทำต่อ";

  insertRow_("inbox", {
    id: inboxId,
    user_email: email,
    created_at: now,
    updated_at: now,
    raw_text: storedText,
    input_type: "text",
    source: "web",
    processed: false,
    processing_status: "pending",
    ai_summary: null,
    clarification_question: null,
    ai_draft: null,
    ai_commit_result: null,
    ai_calendar_event_id: null,
    ai_analyzed_at: null,
    ai_clarification_response: null
  });

  if (attachment && attachment.file_name) {
    let driveFileId = "";
    const folderId = getProp_("INBOX_DRIVE_FOLDER_ID");
    if (attachment.base64 && folderId) {
      try {
        const bytes = Utilities.base64Decode(attachment.base64);
        const blob = Utilities.newBlob(bytes, attachment.mime_type || "application/octet-stream", attachment.file_name);
        const file = DriveApp.getFolderById(folderId).createFile(blob);
        driveFileId = file.getId();
      } catch (_) {}
    }
    insertRow_("inbox_attachments", {
      id: Utilities.getUuid(),
      user_email: email,
      created_at: now,
      updated_at: now,
      inbox_id: inboxId,
      drive_file_id: driveFileId,
      storage_path: email + "/" + inboxId + "/" + attachment.file_name,
      file_name: attachment.file_name,
      mime_type: attachment.mime_type || "text/plain",
      file_size_bytes: Number(attachment.file_size_bytes || 0),
      text_excerpt: String(attachment.text_excerpt || "").slice(0, 45000)
    });
  }

  return { ok: true, message: attachment ? "บันทึกข้อความและไฟล์ไว้ใน Inbox แล้ว" : "บันทึกข้อความใน Inbox แล้ว", id: inboxId };
}

function analyzeInboxData_(email, payload) {
  const id = String(payload.id || "");
  const clarificationAnswer = String(payload.clarificationAnswer || "").trim();
  const item = findUserRow_("inbox", email, id);
  if (!item) return { ok: false, message: "ไม่พบข้อความนี้ใน Inbox" };
  if (String(item.processed) === "true") return { ok: false, message: "รายการนี้บันทึกเป็นงานแล้ว" };

  const attachments = readUserRows_("inbox_attachments", email).filter(function (a) { return a.inbox_id === id; });
  const att = attachments[0] || null;
  const responseToClarification = [item.ai_clarification_response, clarificationAnswer].filter(Boolean).join("\n").slice(-5000);

  const prompt = [
    "วันนี้คือ " + bangkokToday_() + " ตามเขตเวลา Asia/Bangkok",
    "วิเคราะห์คำขอและเอกสารเพื่อสร้างร่างให้ผู้ใช้ตรวจ ไม่ต้องบันทึกหรือกล่าวอ้างว่าทำรายการแล้ว",
    "เลือก kind เพียงหนึ่งค่า: note (ข้อมูลไว้จำ), task (งานเดียว), project (งานหลายขั้นที่ควรวางแผน), event (นัดหมาย/กิจกรรมลงปฏิทิน)",
    "สรุปเป็นภาษาไทย ใช้ชื่อและข้อเท็จจริงจากข้อมูลต้นฉบับเท่านั้น ห้ามสร้างชื่อโครงการหรือตัวอย่างที่ไม่มีในต้นฉบับ",
    "ตีความปีพุทธศักราชเป็นคริสต์ศักราชโดยลบ 543; วันที่ทั้งหมดตอบเป็น YYYY-MM-DD, เวลาเป็น HH:MM",
    "ตอบเป็น JSON object เท่านั้น มี keys: kind,title,summary,description,goal,priority,start_date,due_date,end_date,start_time,end_time,estimated_minutes,clarification_question,milestones,tasks",
    "ข้อความผู้ใช้: " + item.raw_text,
    att ? ("ไฟล์แนบ: " + att.file_name) : "",
    att && att.text_excerpt ? ("เนื้อหาที่อ่านได้จากไฟล์:\n" + att.text_excerpt) : "",
    responseToClarification ? ("คำตอบเพิ่มเติมจากผู้ใช้:\n" + responseToClarification) : ""
  ].filter(Boolean).join("\n\n");

  const draft = callGeminiJson_(prompt, "คุณเป็นผู้ช่วยจัดการงานที่แม่นยำ วิเคราะห์เอกสารและคำสั่งภาษาไทย ห้ามแต่งวันที่ ชื่อบุคคล ตัวเลข หรือข้อเท็จจริง");
  const now = nowIso_();
  const updated = Object.assign({}, item, {
    ai_draft: JSON.stringify(draft),
    ai_summary: draft.summary || "",
    clarification_question: draft.clarification_question || null,
    ai_analyzed_at: now,
    ai_clarification_response: responseToClarification || null,
    processed: false,
    processing_status: draft.clarification_question ? "needs_clarification" : "pending",
    updated_at: now
  });
  updateRowById_("inbox", email, id, updated);
  return { ok: true, message: "วิเคราะห์แล้ว ตรวจและแก้ร่างก่อนบันทึกได้เลย", data: draft };
}

function commitInboxData_(email, payload) {
  const id = String(payload.id || "");
  const draft = payload.draft;
  const item = findUserRow_("inbox", email, id);
  if (!item) return { ok: false, message: "ไม่พบข้อความนี้ใน Inbox" };
  if (String(item.processed) === "true" || item.ai_commit_result) {
    return { ok: false, message: "รายการนี้บันทึกไว้แล้ว ไม่ได้สร้างซ้ำ" };
  }

  const now = nowIso_();
  let result = { kind: draft.kind };

  if (draft.kind === "task") {
    const saved = saveTaskData_(email, {
      title: draft.title,
      description: draft.description,
      priority: draft.priority || "medium",
      due_date: draft.due_date || null,
      estimated_minutes: draft.estimated_minutes,
      source_inbox_id: id
    });
    if (!saved.ok) return saved;
    result = { kind: "task", task_ids: [saved.id] };
  } else if (draft.kind === "project") {
    const projSaved = saveProjectData_(email, {
      name: draft.title,
      goal: draft.goal || null,
      description: draft.description || null,
      priority: draft.priority || "medium",
      start_date: draft.start_date || null,
      target_date: draft.due_date || null,
      status: "planning",
      risk_level: "green",
      progress_percent: 0
    });
    if (!projSaved.ok) return projSaved;
    const projectId = projSaved.id;
    const milestoneIds = [];
    (draft.milestones || []).forEach(function (m, idx) {
      const mId = Utilities.getUuid();
      insertRow_("milestones", {
        id: mId, user_email: email, created_at: now, updated_at: now,
        project_id: projectId, name: m.name, description: m.description || null,
        status: "not_started", priority: m.priority || "medium", progress_percent: 0,
        due_date: m.due_date || null, sequence_no: idx
      });
      milestoneIds.push(mId);
    });
    const taskIds = [];
    (draft.tasks || []).forEach(function (t) {
      const tSaved = saveTaskData_(email, {
        title: t.title,
        description: t.description || null,
        priority: t.priority || "medium",
        due_date: t.due_date || null,
        estimated_minutes: t.estimated_minutes,
        project_id: projectId,
        milestone_id: t.milestone_index !== null && t.milestone_index !== undefined ? (milestoneIds[t.milestone_index] || null) : null,
        source_inbox_id: id
      });
      if (tSaved.id) taskIds.push(tSaved.id);
    });
    result = { kind: "project", project_id: projectId, milestone_ids: milestoneIds, task_ids: taskIds };
  } else if (draft.kind === "event") {
    const eventId = createCalendarEventFromDraft_(email, draft);
    result = { kind: "event", google_event_id: eventId };
  }

  updateRowById_("inbox", email, id, Object.assign({}, item, {
    ai_draft: JSON.stringify(draft),
    ai_summary: draft.summary || item.ai_summary,
    clarification_question: null,
    ai_commit_result: JSON.stringify(result),
    processed: true,
    processing_status: "processed",
    updated_at: now
  }));

  const msg = draft.kind === "note" ? "สรุปและปิดรายการใน Inbox แล้ว"
    : draft.kind === "project" ? "สร้างโปรเจกต์พร้อมหมุดหมายและงานย่อยแล้ว"
    : draft.kind === "event" ? "เพิ่มกิจกรรมใน Google Calendar แล้ว"
    : "สร้างงานแล้ว";
  return { ok: true, message: msg, data: result };
}

/* ============================================================================
 * INTEGRATIONS & LINE WEBHOOK & DAILY DIGEST TRIGGER
 * ========================================================================== */

function connectGoogleCalendar_(email) {
  const now = nowIso_();
  const conn = findUserConnection_(email);
  const record = Object.assign({}, conn || { id: Utilities.getUuid(), user_email: email, created_at: now }, {
    google_calendar_id: "primary",
    google_email: email,
    google_connected_at: now,
    updated_at: now
  });
  if (conn) updateRowById_("integration_connections", email, conn.id, record);
  else insertRow_("integration_connections", record);
  return { ok: true, message: "เชื่อม Google Calendar สำเร็จแล้ว" };
}

function disconnectIntegration_(email, provider) {
  const conn = findUserConnection_(email);
  if (!conn) return { ok: true };
  const now = nowIso_();
  const patch = provider === "google"
    ? { google_refresh_token_ciphertext: null, google_email: null, google_connected_at: null, updated_at: now }
    : { line_user_id: null, line_display_name: null, line_link_code_hash: null, line_link_expires_at: null, line_daily_digest_enabled: false, line_voice_enabled: false, updated_at: now };
  updateRowById_("integration_connections", email, conn.id, Object.assign({}, conn, patch));
  return { ok: true };
}

function createLineLinkCode_(email) {
  const chars = "0123456789ABCDEF";
  let code = "";
  for (let i = 0; i < 10; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  const now = nowIso_();
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString();
  const hash = sha256Hex_(code);
  const conn = findUserConnection_(email);
  const record = Object.assign({}, conn || { id: Utilities.getUuid(), user_email: email, created_at: now, google_calendar_id: "primary" }, {
    line_link_code_hash: hash,
    line_link_expires_at: expiresAt,
    updated_at: now
  });
  if (conn) updateRowById_("integration_connections", email, conn.id, record);
  else insertRow_("integration_connections", record);

  const basicId = getProp_("LINE_OA_BASIC_ID");
  const lineUrl = basicId ? ("https://line.me/R/oaMessage/" + encodeURIComponent(basicId) + "/?" + encodeURIComponent("เชื่อม " + code)) : null;
  return { ok: true, code: code, lineUrl: lineUrl };
}

function toggleLineDigest_(email, enabled) {
  const conn = findUserConnection_(email);
  if (!conn) return { ok: false, message: "กรุณาเชื่อม LINE ก่อน" };
  updateRowById_("integration_connections", email, conn.id, Object.assign({}, conn, {
    line_daily_digest_enabled: enabled,
    updated_at: nowIso_()
  }));
  return { ok: true };
}

function toggleLineVoice_(email, enabled) {
  const conn = findUserConnection_(email);
  if (!conn) return { ok: false, message: "กรุณาเชื่อม LINE ก่อน" };
  updateRowById_("integration_connections", email, conn.id, Object.assign({}, conn, {
    line_voice_enabled: enabled,
    updated_at: nowIso_()
  }));
  return { ok: true };
}

function clearLineHistory_(email) {
  const rows = readUserRows_("line_messages", email);
  rows.forEach(function (r) { deleteRowById_("line_messages", email, r.id); });
  return { ok: true };
}

function handleLineWebhookEvents_(events) {
  events.forEach(function (event) {
    if (!event || event.type !== "message" || !event.replyToken || !event.source || !event.source.userId) return;
    const lineUserId = event.source.userId;
    const text = event.message && event.message.type === "text" ? String(event.message.text || "").trim() : "";
    if (!text) return;

    const allConns = readAllRows_("integration_connections");
    const linkMatch = text.match(/^(?:เชื่อม|link)\s+([a-f0-9]{10})$/i);
    if (linkMatch) {
      const codeHash = sha256Hex_(linkMatch[1].toUpperCase());
      const now = nowIso_();
      const target = allConns.find(function (c) {
        return c.line_link_code_hash === codeHash && c.line_link_expires_at && String(c.line_link_expires_at) > now;
      });
      if (!target) {
        replyLineMessage_(event.replyToken, "รหัสเชื่อมหมดอายุหรือไม่ถูกต้อง กลับไปที่หน้า ตั้งค่า แล้วสร้างรหัสใหม่ได้ครับ");
        return;
      }
      updateRowById_("integration_connections", target.user_email, target.id, Object.assign({}, target, {
        line_user_id: lineUserId,
        line_link_code_hash: null,
        line_link_expires_at: null,
        updated_at: now
      }));
      replyLineMessage_(event.replyToken, "เชื่อม LINE กับผู้ช่วยงานของคุณแล้วครับ ลองบอกงานหรือถามสิ่งที่ต้องการได้เลย");
      return;
    }

    const conn = allConns.find(function (c) { return c.line_user_id === lineUserId; });
    if (!conn || !conn.user_email) {
      replyLineMessage_(event.replyToken, "ยังไม่พบการเชื่อมบัญชีครับ เปิดหน้า ตั้งค่า ใน AI Work Assistant แล้วเลือกเชื่อม LINE ก่อน");
      return;
    }

    const email = conn.user_email;
    const now = nowIso_();
    insertRow_("line_messages", {
      id: Utilities.getUuid(),
      user_email: email,
      created_at: now,
      updated_at: now,
      role: "user",
      content: text,
      source_event_id: event.webhookEventId || null,
      pending_action: null,
      pending_action_expires_at: null
    });

    const openTasks = readUserRows_("tasks", email).filter(function (t) {
      return !t.archived_at && t.status !== "done" && t.status !== "cancelled";
    });
    const contextSummary = openTasks.slice(0, 12).map(function (t) {
      return "- " + t.title + (t.due_date ? " (ครบกำหนด " + t.due_date + ")" : "");
    }).join("\n");

    const aiReply = callGeminiText_(
      "ข้อความจากผู้ใช้: " + text + "\n\nงานที่เปิดอยู่ของผู้ใช้:\n" + (contextSummary || "ไม่มีงานค้าง"),
      "คุณชื่อโป เป็นผู้ช่วยจัดงานส่วนตัวที่พูดภาษาไทยเป็นกันเอง อบอุ่น และกระชับ"
    );

    insertRow_("line_messages", {
      id: Utilities.getUuid(),
      user_email: email,
      created_at: nowIso_(),
      updated_at: nowIso_(),
      role: "assistant",
      content: aiReply,
      source_event_id: null,
      pending_action: null,
      pending_action_expires_at: null
    });
    replyLineMessage_(event.replyToken, aiReply);
  });
}

/**
 * ฟังก์ชันทำงานตามเวลา (Time-driven Trigger แทน Vercel Cron)
 */
function runDailyLineDigest() {
  const token = getProp_("LINE_CHANNEL_ACCESS_TOKEN");
  if (!token) return;
  const today = bangkokToday_();
  const conns = readAllRows_("integration_connections").filter(function (c) {
    return String(c.line_daily_digest_enabled) === "true" && c.line_user_id && c.user_email;
  });

  conns.forEach(function (conn) {
    const email = conn.user_email;
    const deliveries = readUserRows_("line_daily_digest_deliveries", email);
    const alreadySent = deliveries.some(function (d) { return d.digest_date === today && (d.status === "sent" || d.status === "skipped"); });
    if (alreadySent) return;

    const tasks = readUserRows_("tasks", email).filter(function (t) {
      return !t.archived_at && t.status !== "done" && t.status !== "cancelled";
    });
    const now = nowIso_();
    if (tasks.length === 0) {
      insertRow_("line_daily_digest_deliveries", {
        id: Utilities.getUuid(), user_email: email, created_at: now, updated_at: now,
        digest_date: today, status: "skipped", attempted_at: now, sent_at: null, error_code: null
      });
      return;
    }

    const lines = tasks.slice(0, 10).map(function (t) {
      return "• " + t.title + (t.due_date ? " (" + t.due_date + ")" : "");
    });
    const digestText = "📋 สรุปงานประจำวันที่ " + today + " (" + tasks.length + " งาน)\n\n" + lines.join("\n");

    const res = UrlFetchApp.fetch("https://api.line.me/v2/bot/message/push", {
      method: "post",
      contentType: "application/json",
      headers: { Authorization: "Bearer " + token },
      payload: JSON.stringify({
        to: conn.line_user_id,
        messages: [{ type: "text", text: digestText.slice(0, 4900) }]
      }),
      muteHttpExceptions: true
    });

    const ok = res.getResponseCode() >= 200 && res.getResponseCode() < 300;
    insertRow_("line_daily_digest_deliveries", {
      id: Utilities.getUuid(), user_email: email, created_at: now, updated_at: now,
      digest_date: today, status: ok ? "sent" : "failed", attempted_at: now,
      sent_at: ok ? now : null, error_code: ok ? null : ("http_" + res.getResponseCode())
    });
  });
}

/* ============================================================================
 * DATA IMPORT (สำหรับการนำเข้าข้อมูลจาก CSV/JSON ของ Supabase ในขั้นตอนที่ 6)
 * ========================================================================== */

function importTableRows_(email, payload) {
  const table = String(payload.table || "");
  const rows = Array.isArray(payload.rows) ? payload.rows : [];
  if (!SHEETS_SCHEMA[table]) return { ok: false, message: "ไม่พบตาราง: " + table };
  setupSheets();
  let imported = 0;
  rows.forEach(function (r) {
    const now = nowIso_();
    const rowObj = Object.assign({}, r, {
      id: r.id || Utilities.getUuid(),
      user_email: (r.user_email || email).toLowerCase(),
      created_at: r.created_at || now,
      updated_at: r.updated_at || r.created_at || now
    });
    upsertRowById_(table, rowObj.user_email, String(rowObj.id), rowObj);
    imported++;
  });
  return { ok: true, table: table, imported: imported };
}

/* ============================================================================
 * INTERNAL HELPERS (Google Sheets CRUD, Gemini, LINE, Calendar)
 * ========================================================================== */

function getSpreadsheet_() {
  const id = getProp_("SPREADSHEET_ID");
  return id ? SpreadsheetApp.openById(id) : SpreadsheetApp.getActiveSpreadsheet();
}

function getProp_(key) {
  return PropertiesService.getScriptProperties().getProperty(key) || "";
}

function getSheetWithHeaders_(table) {
  const ss = getSpreadsheet_();
  let sheet = ss.getSheetByName(table);
  if (!sheet) {
    setupSheets();
    sheet = ss.getSheetByName(table);
  }
  const lastCol = Math.max(sheet.getLastColumn(), SHEETS_SCHEMA[table].length);
  const headers = sheet.getRange(1, 1, 1, lastCol).getValues()[0];
  return { sheet: sheet, headers: headers };
}

function readAllRows_(table) {
  const info = getSheetWithHeaders_(table);
  const lastRow = info.sheet.getLastRow();
  if (lastRow <= 1) return [];
  const data = info.sheet.getRange(2, 1, lastRow - 1, info.headers.length).getValues();
  return data.map(function (row) {
    const obj = {};
    info.headers.forEach(function (h, i) {
      obj[h] = row[i] === "" ? null : row[i];
    });
    return obj;
  });
}

function readUserRows_(table, email) {
  const target = String(email || "").toLowerCase();
  return readAllRows_(table).filter(function (r) {
    return String(r.user_email || "").toLowerCase() === target;
  });
}

function findUserRow_(table, email, id) {
  const target = String(email || "").toLowerCase();
  const rows = readAllRows_(table);
  return rows.find(function (r) {
    return String(r.user_email || "").toLowerCase() === target && String(r.id) === String(id);
  }) || null;
}

function insertRow_(table, obj) {
  const info = getSheetWithHeaders_(table);
  const values = info.headers.map(function (h) {
    const val = obj[h];
    if (val === null || val === undefined) return "";
    if (typeof val === "object") return JSON.stringify(val);
    return val;
  });
  info.sheet.appendRow(values);
}

function updateRowById_(table, email, id, obj) {
  const info = getSheetWithHeaders_(table);
  const lastRow = info.sheet.getLastRow();
  if (lastRow <= 1) return false;
  const idIdx = info.headers.indexOf("id");
  const emailIdx = info.headers.indexOf("user_email");
  const data = info.sheet.getRange(2, 1, lastRow - 1, info.headers.length).getValues();
  const targetEmail = String(email || "").toLowerCase();
  for (let i = 0; i < data.length; i++) {
    if (String(data[i][idIdx]) === String(id) && String(data[i][emailIdx] || "").toLowerCase() === targetEmail) {
      const rowValues = info.headers.map(function (h) {
        const val = obj[h];
        if (val === null || val === undefined) return "";
        if (typeof val === "object") return JSON.stringify(val);
        return val;
      });
      info.sheet.getRange(i + 2, 1, 1, info.headers.length).setValues([rowValues]);
      return true;
    }
  }
  return false;
}

function upsertRowById_(table, email, id, obj) {
  if (!updateRowById_(table, email, id, obj)) {
    insertRow_(table, obj);
  }
}

function deleteRowById_(table, email, id) {
  const info = getSheetWithHeaders_(table);
  const lastRow = info.sheet.getLastRow();
  if (lastRow <= 1) return false;
  const idIdx = info.headers.indexOf("id");
  const emailIdx = info.headers.indexOf("user_email");
  const data = info.sheet.getRange(2, 1, lastRow - 1, info.headers.length).getValues();
  const targetEmail = String(email || "").toLowerCase();
  for (let i = data.length - 1; i >= 0; i--) {
    if (String(data[i][idIdx]) === String(id) && String(data[i][emailIdx] || "").toLowerCase() === targetEmail) {
      info.sheet.deleteRow(i + 2);
      return true;
    }
  }
  return false;
}

function getUserSettings_(email) {
  const rows = readUserRows_("settings", email);
  if (!rows[0]) return Object.assign({ updated_at: null }, DEFAULT_SETTINGS);
  const r = rows[0];
  return {
    default_work_start: String(r.default_work_start || "18:00").slice(0, 5),
    default_work_end: String(r.default_work_end || "21:00").slice(0, 5),
    daily_capacity_minutes: Number(r.daily_capacity_minutes || 180),
    default_focus_minutes: Number(r.default_focus_minutes || 25),
    default_break_minutes: Number(r.default_break_minutes || 5),
    daily_max_important_tasks: Number(r.daily_max_important_tasks || 3),
    allow_weekend: String(r.allow_weekend) !== "false",
    retention_completed_days: Number(r.retention_completed_days || 30),
    updated_at: r.updated_at || null
  };
}

function findUserConnection_(email) {
  const rows = readUserRows_("integration_connections", email);
  return rows[0] || null;
}

function normalizeTaskRow_(t) {
  return {
    id: String(t.id),
    title: String(t.title || ""),
    description: t.description ? String(t.description) : null,
    status: t.status || "not_started",
    priority: t.priority || "medium",
    due_date: t.due_date ? formatDateCol_(t.due_date) : null,
    project_id: t.project_id ? String(t.project_id) : null,
    estimated_minutes: t.estimated_minutes === null || t.estimated_minutes === "" ? null : Number(t.estimated_minutes),
    completed_at: t.completed_at ? String(t.completed_at) : null,
    archive_after: t.archive_after ? String(t.archive_after) : null,
    updated_at: String(t.updated_at || t.created_at || nowIso_())
  };
}

function normalizeProjectRow_(p) {
  return {
    id: String(p.id),
    name: String(p.name || ""),
    goal: p.goal ? String(p.goal) : null,
    description: p.description ? String(p.description) : null,
    status: p.status || "planning",
    priority: p.priority || "medium",
    risk_level: p.risk_level || "green",
    progress_percent: Number(p.progress_percent || 0),
    start_date: p.start_date ? formatDateCol_(p.start_date) : null,
    target_date: p.target_date ? formatDateCol_(p.target_date) : null,
    completed_at: p.completed_at ? String(p.completed_at) : null,
    updated_at: String(p.updated_at || p.created_at || nowIso_()),
    created_at: String(p.created_at || nowIso_())
  };
}

function normalizeMilestoneRow_(m) {
  return {
    id: String(m.id),
    project_id: String(m.project_id),
    name: String(m.name || ""),
    description: m.description ? String(m.description) : null,
    status: m.status || "not_started",
    priority: m.priority || "medium",
    progress_percent: Number(m.progress_percent || 0),
    due_date: m.due_date ? formatDateCol_(m.due_date) : null,
    sequence_no: Number(m.sequence_no || 0),
    updated_at: String(m.updated_at || m.created_at || nowIso_())
  };
}

function callGeminiJson_(prompt, systemInstruction) {
  const apiKey = getProp_("GEMINI_API_KEY");
  if (!apiKey) throw new Error("ยังไม่ได้ตั้งค่า GEMINI_API_KEY ใน Script Properties");
  const models = [
    getProp_("GEMINI_COMPLEX_MODEL") || "gemini-2.5-flash",
    getProp_("GEMINI_PRIMARY_MODEL") || "gemini-2.5-flash",
    getProp_("GEMINI_FALLBACK_MODEL") || "gemini-2.5-flash-lite"
  ];
  for (let i = 0; i < models.length; i++) {
    const model = models[i];
    const res = UrlFetchApp.fetch("https://generativelanguage.googleapis.com/v1beta/models/" + encodeURIComponent(model) + ":generateContent", {
      method: "post",
      contentType: "application/json",
      headers: { "x-goog-api-key": apiKey },
      payload: JSON.stringify({
        systemInstruction: { parts: [{ text: systemInstruction }] },
        contents: [{ role: "user", parts: [{ text: prompt }] }],
        generationConfig: { responseMimeType: "application/json", temperature: 0.2 }
      }),
      muteHttpExceptions: true
    });
    if (res.getResponseCode() === 200) {
      const data = JSON.parse(res.getContentText());
      const text = (((data.candidates || [])[0] || {}).content || {}).parts
        ? data.candidates[0].content.parts.map(function (p) { return p.text || ""; }).join("").trim()
        : "";
      if (text) return JSON.parse(text);
    }
  }
  throw new Error("เรียกใช้ Gemini AI ไม่สำเร็จ กรุณาตรวจสอบ GEMINI_API_KEY หรือโควตา");
}

function callGeminiText_(prompt, systemInstruction) {
  const apiKey = getProp_("GEMINI_API_KEY");
  if (!apiKey) return "โปยังไม่ได้ตั้งค่า GEMINI_API_KEY ใน Script Properties ครับ";
  const model = getProp_("GEMINI_PRIMARY_MODEL") || "gemini-2.5-flash";
  const res = UrlFetchApp.fetch("https://generativelanguage.googleapis.com/v1beta/models/" + encodeURIComponent(model) + ":generateContent", {
    method: "post",
    contentType: "application/json",
    headers: { "x-goog-api-key": apiKey },
    payload: JSON.stringify({
      systemInstruction: { parts: [{ text: systemInstruction }] },
      contents: [{ role: "user", parts: [{ text: prompt }] }]
    }),
    muteHttpExceptions: true
  });
  if (res.getResponseCode() === 200) {
    const data = JSON.parse(res.getContentText());
    const text = (((data.candidates || [])[0] || {}).content || {}).parts
      ? data.candidates[0].content.parts.map(function (p) { return p.text || ""; }).join("").trim()
      : "";
    if (text) return text;
  }
  return "เมื่อกี้โปตอบไม่ทัน ลองส่งมาใหม่อีกครั้งนะ 🙂";
}

function replyLineMessage_(replyToken, text) {
  const token = getProp_("LINE_CHANNEL_ACCESS_TOKEN");
  if (!token || !replyToken) return;
  UrlFetchApp.fetch("https://api.line.me/v2/bot/message/reply", {
    method: "post",
    contentType: "application/json",
    headers: { Authorization: "Bearer " + token },
    payload: JSON.stringify({
      replyToken: replyToken,
      messages: [{ type: "text", text: String(text || "").slice(0, 4900) }]
    }),
    muteHttpExceptions: true
  });
}

function syncTaskCalendarIfConnected_(email, task) {
  const conn = findUserConnection_(email);
  if (!conn || !conn.google_connected_at) return undefined;
  try {
    const cal = CalendarApp.getDefaultCalendar();
    if (!cal) return undefined;
    if (!task.due_date) {
      if (task.calendar_event_id) {
        const oldEv = cal.getEventById(task.calendar_event_id);
        if (oldEv) oldEv.deleteEvent();
      }
      return null;
    }
    const due = new Date(task.due_date + "T00:00:00+07:00");
    if (task.calendar_event_id) {
      const ev = cal.getEventById(task.calendar_event_id);
      if (ev) {
        ev.setTitle(task.title);
        ev.setDescription(task.description || "");
        ev.setAllDayDate(due);
        return ev.getId();
      }
    }
    const created = cal.createAllDayEvent(task.title, due, { description: task.description || "" });
    return created.getId();
  } catch (_) {
    return undefined;
  }
}

function deleteCalendarEventQuietly_(email, eventId) {
  try {
    const cal = CalendarApp.getDefaultCalendar();
    const ev = cal ? cal.getEventById(eventId) : null;
    if (ev) ev.deleteEvent();
  } catch (_) {}
}

function createCalendarEventFromDraft_(email, draft) {
  const cal = CalendarApp.getDefaultCalendar();
  if (!cal) throw new Error("ไม่พบ Google Calendar");
  const startDate = draft.start_date;
  if (!startDate) throw new Error("กรุณาระบุวันเริ่มกิจกรรม");
  if (draft.start_time) {
    const startDt = new Date(startDate + "T" + draft.start_time + ":00+07:00");
    const endDt = draft.end_time
      ? new Date(startDate + "T" + draft.end_time + ":00+07:00")
      : new Date(startDt.getTime() + 60 * 60 * 1000);
    const ev = cal.createEvent(draft.title, startDt, endDt, { description: draft.description || "" });
    return ev.getId();
  } else {
    const ev = cal.createAllDayEvent(draft.title, new Date(startDate + "T00:00:00+07:00"), { description: draft.description || "" });
    return ev.getId();
  }
}

function nowIso_() {
  return new Date().toISOString();
}

function bangkokToday_() {
  return Utilities.formatDate(new Date(), "Asia/Bangkok", "yyyy-MM-dd");
}

function shiftDateStr_(dateStr, days) {
  const d = new Date(dateStr + "T12:00:00Z");
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

function addDaysIso_(isoStr, days) {
  const d = new Date(isoStr);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString();
}

function formatDateCol_(val) {
  if (!val) return null;
  if (val instanceof Date) return Utilities.formatDate(val, "Asia/Bangkok", "yyyy-MM-dd");
  return String(val).slice(0, 10);
}

function parseJsonSafe_(val) {
  if (!val) return null;
  if (typeof val === "object") return val;
  try { return JSON.parse(String(val)); } catch (_) { return null; }
}

function sha256Hex_(input) {
  const digest = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, input, Utilities.Charset.UTF_8);
  return digest.map(function (b) {
    const v = (b < 0 ? b + 256 : b).toString(16);
    return v.length === 1 ? "0" + v : v;
  }).join("");
}

function jsonResponse_(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}
