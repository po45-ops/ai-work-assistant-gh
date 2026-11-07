import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/integrations/admin";
import { createClient } from "@/lib/supabase/server";

export async function POST() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  if (!data.user) return NextResponse.json({ ok: false }, { status: 401 });
  const admin = createAdminClient();
  const { error } = await admin.from("integration_connections").update({
    line_user_id: null, line_display_name: null, line_link_code_hash: null, line_link_expires_at: null,
  }).eq("user_id", data.user.id);
  return NextResponse.json({ ok: !error }, { status: error ? 500 : 200 });
}
