"use server";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
function integer(form: FormData, name: string, min: number, max: number) {
  const value = Number(form.get(name));
  return Number.isInteger(value) && value >= min && value <= max ? value : null;
}
export async function saveWorkSettings(form: FormData): Promise<{ ok: boolean; message: string }> {
  const start = String(form.get("default_work_start") ?? "");
  const end = String(form.get("default_work_end") ?? "");
  const capacity = integer(form, "daily_capacity_minutes", 15, 1440);
  const focus = integer(form, "default_focus_minutes", 5, 240);
  const rest = integer(form, "default_break_minutes", 0, 120);
  const maxImportant = integer(form, "daily_max_important_tasks", 1, 20);
  if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(start) || !/^([01]\d|2[0-3]):[0-5]\d$/.test(end) || end <= start) return { ok: false, message: "เวลาเริ่มและสิ้นสุดไม่ถูกต้อง หรือเวลาสิ้นสุดต้องอยู่หลังเวลาเริ่ม" };
  if (capacity === null || focus === null || rest === null || maxImportant === null) return { ok: false, message: "ตัวเลขการวางแผนอยู่นอกช่วงที่รองรับ" };
  const payload = { default_work_start: start, default_work_end: end, daily_capacity_minutes: capacity, default_focus_minutes: focus, default_break_minutes: rest, daily_max_important_tasks: maxImportant, allow_weekend: form.get("allow_weekend") === "on" };
  const version = String(form.get("updated_at") ?? "");
  if (version && !Number.isFinite(Date.parse(version))) return { ok: false, message: "ข้อมูลการตั้งค่าไม่ถูกต้อง กรุณาโหลดหน้าใหม่" };
  try {
    const supabase = await createClient();
    const { data: auth, error: authError } = await supabase.auth.getUser();
    if (authError || !auth.user) return { ok: false, message: "เซสชันหมดอายุ กรุณาเข้าสู่ระบบอีกครั้ง" };
    if (version) {
      const { data, error } = await supabase.from("settings").update(payload).eq("user_id", auth.user.id).eq("updated_at", version).select("user_id").maybeSingle();
      if (error) return { ok: false, message: "บันทึกการตั้งค่าไม่สำเร็จ กรุณาลองอีกครั้ง" };
      if (!data) return { ok: false, message: "การตั้งค่านี้เปลี่ยนไปแล้ว กรุณาโหลดหน้าใหม่" };
    } else {
      const { error } = await supabase.from("settings").insert({ ...payload, user_id: auth.user.id });
      if (error) return { ok: false, message: "สร้างการตั้งค่าไม่สำเร็จ กรุณาโหลดหน้าใหม่แล้วลองอีกครั้ง" };
    }
    revalidatePath("/protected/settings"); revalidatePath("/protected");
    return { ok: true, message: "บันทึกการตั้งค่าแล้ว" };
  } catch { return { ok: false, message: "เชื่อมต่อไม่สำเร็จ กรุณาลองอีกครั้ง" }; }
}
