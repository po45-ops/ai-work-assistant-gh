import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/integrations/admin";
import { hashLinkCode, randomLinkCode } from "@/lib/integrations/security";
import { createClient } from "@/lib/supabase/server";

export async function POST() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  if (!data.user) return NextResponse.json({ ok: false, message: "กรุณาเข้าสู่ระบบใหม่" }, { status: 401 });
  if (!process.env.LINE_CHANNEL_ACCESS_TOKEN || !process.env.LINE_CHANNEL_SECRET) {
    return NextResponse.json({ ok: false, message: "ยังไม่ได้ตั้งค่าช่องทาง LINE ของระบบ" }, { status: 503 });
  }
  const code = randomLinkCode();
  const admin = createAdminClient();
  const { error } = await admin.from("integration_connections").upsert({
    user_id: data.user.id,
    line_link_code_hash: hashLinkCode(code),
    line_link_expires_at: new Date(Date.now() + 10 * 60 * 1000).toISOString(),
  }, { onConflict: "user_id" });
  if (error) return NextResponse.json({ ok: false, message: "สร้างรหัสเชื่อม LINE ไม่สำเร็จ" }, { status: 500 });
  return NextResponse.json({
    ok: true,
    code,
    lineUrl: process.env.LINE_OA_BASIC_ID ? "https://line.me/R/ti/p/" + encodeURIComponent(process.env.LINE_OA_BASIC_ID) : null,
  });
}
