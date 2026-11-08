#!/usr/bin/env node
/**
 * สคริปต์นำเข้าข้อมูลจากไฟล์ CSV หรือ JSON ที่ Export มาจาก Supabase เข้าสู่ Google Sheet
 *
 * รองรับ 2 รูปแบบการทำงาน:
 * 1) แปลงไฟล์ CSV/JSON จาก Supabase ให้ตรงกับโครงสร้างแท็บ Google Sheet ทั้ง 9 ตาราง
 *    (เพิ่ม/แมปคอลัมน์ id, user_email, created_at, updated_at อัตโนมัติ)
 *    แล้วบันทึกเป็นไฟล์ CSV พร้อมนำเข้าในโฟลเดอร์ ./import-ready/
 * 2) หากระบุ --webapp-url และ --id-token จะยิงข้อมูลเข้า Google Sheet ผ่าน Apps Script Web App (`admin.importRows`) ให้โดยอัตโนมัติ
 *
 * ตัวอย่างวิธีรัน:
 *   node scripts/import-supabase-to-sheets.mjs --input ./supabase-export --email your.email@gmail.com
 *   node scripts/import-supabase-to-sheets.mjs --input ./tasks.csv --table tasks --email your.email@gmail.com
 */

import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";

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

/**
 * แยกวิเคราะห์ CSV ที่รองรับเครื่องหมายอัญประกาศ ("...") และบรรทัดใหม่ภายในเซลล์ตามมาตรฐาน RFC 4180
 */
export function parseCsv(content) {
  const rows = [];
  let row = [];
  let field = "";
  let inQuotes = false;
  const text = content.replace(/^\uFEFF/, "");

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    const next = text[i + 1];
    if (inQuotes) {
      if (ch === '"' && next === '"') {
        field += '"';
        i++;
      } else if (ch === '"') {
        inQuotes = false;
      } else {
        field += ch;
      }
    } else {
      if (ch === '"') {
        inQuotes = true;
      } else if (ch === ",") {
        row.push(field);
        field = "";
      } else if (ch === "\r" && next === "\n") {
        row.push(field);
        rows.push(row);
        row = [];
        field = "";
        i++;
      } else if (ch === "\n") {
        row.push(field);
        rows.push(row);
        row = [];
        field = "";
      } else {
        field += ch;
      }
    }
  }
  if (field.length > 0 || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  if (rows.length === 0) return [];
  const headers = rows[0].map((h) => h.trim());
  return rows.slice(1).filter((r) => r.some((cell) => cell !== "")).map((r) => {
    const obj = {};
    headers.forEach((h, idx) => {
      obj[h] = r[idx] !== undefined && r[idx] !== "" ? r[idx] : null;
    });
    return obj;
  });
}

export function toCsv(headers, records) {
  const escapeCell = (val) => {
    if (val === null || val === undefined) return "";
    const str = typeof val === "object" ? JSON.stringify(val) : String(val);
    if (/[",\r\n]/.test(str)) {
      return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
  };
  const lines = [headers.map(escapeCell).join(",")];
  for (const rec of records) {
    lines.push(headers.map((h) => escapeCell(rec[h])).join(","));
  }
  return lines.join("\n") + "\n";
}

export function normalizeRowsForTable(table, rawRows, defaultEmail, userMap = {}) {
  const columns = SHEETS_SCHEMA[table];
  if (!columns) throw new Error(`ไม่รู้จักตาราง: ${table}`);
  const now = new Date().toISOString();

  return rawRows.map((raw) => {
    const mappedEmail =
      raw.user_email ||
      raw.google_email ||
      (raw.user_id && userMap[raw.user_id]) ||
      defaultEmail ||
      "unknown@example.com";

    const id =
      raw.id ||
      (table === "line_daily_digest_deliveries" && raw.user_id && raw.digest_date
        ? `${raw.user_id}_${raw.digest_date}`
        : raw.user_id && (table === "settings" || table === "integration_connections")
          ? raw.user_id
          : crypto.randomUUID());

    const createdAt = raw.created_at || raw.attempted_at || raw.updated_at || now;
    const updatedAt = raw.updated_at || raw.sent_at || createdAt;

    const normalized = {};
    for (const col of columns) {
      if (col === "id") normalized.id = String(id);
      else if (col === "user_email") normalized.user_email = String(mappedEmail).toLowerCase();
      else if (col === "created_at") normalized.created_at = String(createdAt);
      else if (col === "updated_at") normalized.updated_at = String(updatedAt);
      else normalized[col] = raw[col] !== undefined ? raw[col] : null;
    }
    return normalized;
  });
}

function parseArgs(argv) {
  const args = {};
  for (let i = 2; i < argv.length; i++) {
    const key = argv[i];
    if (key.startsWith("--")) {
      const name = key.slice(2);
      const val = argv[i + 1] && !argv[i + 1].startsWith("--") ? argv[++i] : "true";
      args[name] = val;
    }
  }
  return args;
}

function loadFileRecords(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  const content = fs.readFileSync(filePath, "utf8");
  if (ext === ".json") {
    const parsed = JSON.parse(content);
    return Array.isArray(parsed) ? parsed : (parsed.rows || parsed.data || []);
  }
  if (ext === ".csv") {
    return parseCsv(content);
  }
  throw new Error(`ไม่รองรับนามสกุลไฟล์: ${ext}`);
}

async function main() {
  const args = parseArgs(process.argv);
  if (!args.input) {
    console.log("วิธีใช้งาน:");
    console.log("  node scripts/import-supabase-to-sheets.mjs --input <โฟลเดอร์หรือไฟล์> --email <อีเมลเจ้าของข้อมูล> [--out ./import-ready] [--webapp-url <URL>] [--id-token <TOKEN>]");
    process.exit(0);
  }

  const inputPath = path.resolve(args.input);
  const outDir = path.resolve(args.out || "./import-ready");
  const defaultEmail = (args.email || "").trim().toLowerCase();
  fs.mkdirSync(outDir, { recursive: true });

  const files = fs.statSync(inputPath).isDirectory()
    ? fs.readdirSync(inputPath).map((f) => path.join(inputPath, f))
    : [inputPath];

  // โหลดตาราง users (ถ้ามี) เพื่อแมป user_id -> email
  const userMap = {};
  for (const file of files) {
    const base = path.basename(file, path.extname(file)).toLowerCase();
    if (base === "users" || base === "auth.users") {
      for (const u of loadFileRecords(file)) {
        if (u.id && u.email) userMap[u.id] = String(u.email).toLowerCase();
      }
    }
  }

  const bundle = {};
  for (const file of files) {
    const ext = path.extname(file).toLowerCase();
    if (ext !== ".csv" && ext !== ".json") continue;
    const baseName = (args.table || path.basename(file, ext)).toLowerCase().replace(/^public\./, "");
    if (!SHEETS_SCHEMA[baseName]) continue;

    const rawRows = loadFileRecords(file);
    const normalized = normalizeRowsForTable(baseName, rawRows, defaultEmail, userMap);
    bundle[baseName] = normalized;

    const csvOut = path.join(outDir, `${baseName}.csv`);
    fs.writeFileSync(csvOut, toCsv(SHEETS_SCHEMA[baseName], normalized), "utf8");
    console.log(`✓ แปลงตาราง ${baseName}: ${normalized.length} แถว -> ${csvOut}`);

    if (args["webapp-url"] && args["id-token"]) {
      const res = await fetch(args["webapp-url"], {
        method: "POST",
        headers: { "Content-Type": "text/plain;charset=utf-8" },
        body: JSON.stringify({
          action: "admin.importRows",
          idToken: args["id-token"],
          payload: { table: baseName, rows: normalized },
        }),
      });
      const json = await res.json();
      console.log(`  ↳ ส่งเข้า Google Sheet ผ่าน Apps Script:`, json);
    }
  }

  const bundlePath = path.join(outDir, "supabase-import-bundle.json");
  fs.writeFileSync(bundlePath, JSON.stringify(bundle, null, 2), "utf8");
  console.log(`✓ บันทึกไฟล์รวม JSON พร้อมนำเข้าที่: ${bundlePath}`);

  const gsheetsBatch = Object.entries(bundle)
    .filter(([, rows]) => rows.length > 0)
    .map(([table, rows]) => {
      const cols = SHEETS_SCHEMA[table];
      return {
        op: "append",
        range: `${table}!A1`,
        data: rows.map((row) => cols.map((col) => (row[col] === undefined || row[col] === null ? "" : String(row[col])))),
      };
    });
  const gsheetsBatchPath = path.join(outDir, "gsheets-batch.json");
  fs.writeFileSync(gsheetsBatchPath, JSON.stringify(gsheetsBatch, null, 2), "utf8");
  console.log(`✓ บันทึกไฟล์ Batch สำหรับ gsheets CLI ที่: ${gsheetsBatchPath}`);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((err) => {
    console.error("เกิดข้อผิดพลาด:", err.message);
    process.exit(1);
  });
}
