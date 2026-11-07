import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/integrations/admin";
import { bangkokDateTime, formatTaskDigest, isWeeklyReviewDay } from "@/lib/integrations/line-assistant";

export const maxDuration = 60;

function authorized(request: Request) {
  const secret = process.env.CRON_SECRET;
  const supplied = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ?? "";
  if (!secret || supplied.length !== secret.length) return false;
  return timingSafeEqual(Buffer.from(supplied), Buffer.from(secret));
}

export async function GET(request: Request) {
  if (!process.env.CRON_SECRET) return NextResponse.json({ ok: false }, { status: 503 });
  if (!authorized(request)) return NextResponse.json({ ok: false }, { status: 401 });
  if (!process.env.LINE_CHANNEL_ACCESS_TOKEN) return NextResponse.json({ ok: false }, { status: 503 });

  const admin = createAdminClient();
  const { date: today } = bangkokDateTime();
  const { data: connections, error } = await admin.from("integration_connections")
    .select("user_id,line_user_id")
    .eq("line_daily_digest_enabled", true)
    .not("line_user_id", "is", null);
  if (error) {
    console.error("LINE daily digest connection query failed", { code: error.code });
    return NextResponse.json({ ok: false }, { status: 500 });
  }

  const counts = { sent: 0, skipped: 0, failed: 0 };
  for (const connection of connections ?? []) {
    const { data: claimed, error: claimError } = await admin.rpc("claim_line_daily_digest", {
      p_user_id: connection.user_id,
      p_digest_date: today,
    });
    if (claimError) {
      console.error("LINE daily digest claim failed", { code: claimError.code });
      counts.failed++;
      continue;
    }
    if (!claimed || !connection.line_user_id) continue;

    const { data: tasks, error: taskError } = await admin.from("tasks")
      .select("title,status,due_date,priority,archived_at")
      .eq("user_id", connection.user_id).is("archived_at", null)
      .not("status", "in", "(done,cancelled)")
      .order("due_date", { ascending: true, nullsFirst: false }).limit(500);
    if (taskError) {
      await saveDeliveryState(admin, connection.user_id, today, "failed", "task_query_failed");
      console.error("LINE daily digest task query failed", { code: taskError.code });
      counts.failed++;
      continue;
    }
    if (!tasks?.length) {
      await saveDeliveryState(admin, connection.user_id, today, "skipped", null);
      counts.skipped++;
      continue;
    }

    const text = formatTaskDigest(tasks, today, `สรุปงานประจำวันที่ ${today}`, isWeeklyReviewDay(today));
    const response = await fetch("https://api.line.me/v2/bot/message/push", {
      method: "POST",
      headers: { authorization: "Bearer " + process.env.LINE_CHANNEL_ACCESS_TOKEN, "content-type": "application/json" },
      body: JSON.stringify({ to: connection.line_user_id, messages: [{ type: "text", text: text.slice(0, 4900) }] }),
      cache: "no-store",
      signal: AbortSignal.timeout(10_000),
    }).catch(() => null);
    if (!response?.ok) {
      const errorCode = response ? `line_http_${response.status}` : "line_network_error";
      await saveDeliveryState(admin, connection.user_id, today, "failed", errorCode);
      console.error("LINE daily digest push failed", { status: response?.status ?? 0 });
      counts.failed++;
      continue;
    }
    await saveDeliveryState(admin, connection.user_id, today, "sent", null);
    counts.sent++;
  }

  return NextResponse.json({ ok: true, date: today, ...counts });
}

async function saveDeliveryState(
  admin: ReturnType<typeof createAdminClient>,
  userId: string,
  date: string,
  status: "sent" | "skipped" | "failed",
  errorCode: string | null,
) {
  await admin.from("line_daily_digest_deliveries").update({
    status,
    error_code: errorCode,
    sent_at: status === "sent" ? new Date().toISOString() : null,
  }).eq("user_id", userId).eq("digest_date", date);
}
