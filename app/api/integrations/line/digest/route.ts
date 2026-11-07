import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/integrations/admin";
import { createClient } from "@/lib/supabase/server";

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  if (!data.user) return NextResponse.json({ ok: false }, { status: 401 });

  let body: { enabled?: unknown };
  try { body = await request.json() as { enabled?: unknown }; }
  catch { return NextResponse.json({ ok: false }, { status: 400 }); }
  if (typeof body.enabled !== "boolean") return NextResponse.json({ ok: false }, { status: 400 });

  const admin = createAdminClient();
  const { data: connection } = await admin.from("integration_connections")
    .select("line_user_id").eq("user_id", data.user.id).maybeSingle();
  if (!connection?.line_user_id) return NextResponse.json({ ok: false }, { status: 409 });

  const { error } = await admin.from("integration_connections")
    .update({ line_daily_digest_enabled: body.enabled }).eq("user_id", data.user.id);
  if (error) return NextResponse.json({ ok: false }, { status: 500 });
  return NextResponse.json({ ok: true });
}
