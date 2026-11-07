import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/integrations/admin";
import { createClient } from "@/lib/supabase/server";

export async function DELETE() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  if (!data.user) return NextResponse.json({ ok: false }, { status: 401 });
  const admin = createAdminClient();
  const { error } = await admin.from("line_messages").delete().eq("user_id", data.user.id);
  return NextResponse.json({ ok: !error }, { status: error ? 500 : 200 });
}
