"use client";
import { useRouter } from "next/navigation";
import { useRef, useState, useTransition, type FormEvent } from "react";
import { Clock3, LoaderCircle, LockKeyhole, UserRound } from "lucide-react";
import { saveWorkSettings } from "@/app/protected/settings/actions";
import type { WorkSettings } from "@/lib/settings/data";
import { IntegrationsPanel } from "@/components/settings/integrations-panel";
import type { loadIntegrationStatus } from "@/lib/integrations/data";
const field = "min-h-12 w-full rounded-xl border border-[#dfd0c2] bg-white px-3 text-base text-[#2f241e] outline-none focus:ring-2 focus:ring-[#8f6447]/40 disabled:opacity-50";
type IntegrationStatus = Awaited<ReturnType<typeof loadIntegrationStatus>>;
export function SettingsWorkspace({ email, settings, error, integration }: { email: string; settings: WorkSettings; error: string | null; integration: IntegrationStatus }) {
  const router = useRouter();
  const lock = useRef(false);
  const [notice, setNotice] = useState<{ error: boolean; message: string } | null>(null);
  const [pending, startTransition] = useTransition();
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (lock.current) return;
    lock.current = true; setNotice(null);
    const form = new FormData(event.currentTarget);
    startTransition(async () => {
      try { const result = await saveWorkSettings(form); setNotice({ error: !result.ok, message: result.message }); if (result.ok) router.refresh(); }
      catch { setNotice({ error: true, message: "เชื่อมต่อไม่สำเร็จ กรุณาลองอีกครั้ง" }); }
      finally { lock.current = false; }
    });
  }
  return <div className="mx-auto w-full max-w-[980px] px-4 py-5 sm:px-6 lg:px-8 xl:py-8"><div className="mb-7"><p className="text-sm font-semibold tracking-wider text-[#8f6447]">SETTINGS</p><h1 className="mt-2 text-3xl font-bold tracking-tight sm:text-4xl">ตั้งค่า</h1><p className="mt-2 text-base text-[#705c4d]">ข้อมูลบัญชีและค่าที่ใช้วางแผนงานของคุณ</p></div>
    <section className="mb-5 rounded-[24px] border border-[#e8ddd2] bg-[#fffdfa] p-5 premium-shadow"><div className="flex items-center gap-3"><span className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#f4eadf] text-[#8f6447]"><UserRound className="h-5 w-5" /></span><div><h2 className="text-lg font-bold">บัญชี</h2><p className="mt-1 break-all text-sm text-[#705c4d]">{email || "บัญชีที่เข้าสู่ระบบ"}</p></div></div></section>
    <IntegrationsPanel integration={integration} />
    {error ? <section role="alert" className="rounded-[24px] border border-[#e8ddd2] bg-[#fffdfa] p-6"><h2 className="text-lg font-bold">ยังโหลดการตั้งค่าไม่ได้</h2><p className="mt-2 text-base text-[#705c4d]">{error}</p><button type="button" onClick={() => router.refresh()} className="mt-4 min-h-12 rounded-xl bg-[#8f6447] px-5 font-semibold text-white">ลองอีกครั้ง</button></section> : <><section className="rounded-[24px] border border-[#e8ddd2] bg-[#fffdfa] p-5 premium-shadow sm:p-6"><div className="flex items-start gap-3"><span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[#f4eadf] text-[#8f6447]"><Clock3 className="h-5 w-5" /></span><div><h2 className="text-xl font-bold">ค่าการวางแผนงาน</h2><p className="mt-1 text-sm leading-6 text-[#705c4d]">บันทึกช่วงเวลาทำงานและความจุรายวันไว้สำหรับการจัดตารางในอนาคต ระบบยังไม่จัดตารางอัตโนมัติ</p></div></div><form key={settings.updated_at ?? "default"} onSubmit={submit} className="mt-6"><input type="hidden" name="updated_at" value={settings.updated_at ?? ""} /><fieldset disabled={pending} className="grid gap-4 sm:grid-cols-2"><div><label htmlFor="setting-start" className="mb-2 block text-sm font-semibold">เริ่มทำงาน</label><input id="setting-start" name="default_work_start" type="time" required defaultValue={settings.default_work_start} className={field} /></div><div><label htmlFor="setting-end" className="mb-2 block text-sm font-semibold">สิ้นสุดงาน</label><input id="setting-end" name="default_work_end" type="time" required defaultValue={settings.default_work_end} className={field} /></div><NumberField id="capacity" name="daily_capacity_minutes" label="เวลาทำงานต่อวัน (นาที)" value={settings.daily_capacity_minutes} min={15} max={1440} /><NumberField id="focus" name="default_focus_minutes" label="ช่วงโฟกัส (นาที)" value={settings.default_focus_minutes} min={5} max={240} /><NumberField id="break" name="default_break_minutes" label="เวลาพัก (นาที)" value={settings.default_break_minutes} min={0} max={120} /><NumberField id="important" name="daily_max_important_tasks" label="งานสำคัญสูงสุดต่อวัน" value={settings.daily_max_important_tasks} min={1} max={20} /><label className="flex min-h-12 items-center gap-3 rounded-xl border border-[#dfd0c2] bg-white px-4 text-base font-semibold sm:col-span-2"><input name="allow_weekend" type="checkbox" defaultChecked={settings.allow_weekend} className="h-5 w-5 accent-[#8f6447]" />รวมวันหยุดสุดสัปดาห์ในการวางแผน</label></fieldset><div className="mt-5 flex flex-wrap items-center justify-between gap-3"><p className="text-sm text-[#705c4d]">เขตเวลา: Asia/Bangkok</p><button type="submit" disabled={pending} className="inline-flex min-h-12 items-center gap-2 rounded-xl bg-[#8f6447] px-5 text-sm font-semibold text-white disabled:opacity-50">{pending && <LoaderCircle className="h-4 w-4 animate-spin" />}{pending ? "กำลังบันทึก…" : "บันทึกการตั้งค่า"}</button></div>{notice && <p role={notice.error ? "alert" : "status"} className={`mt-4 rounded-xl p-3 text-sm ${notice.error ? "bg-[#fde5dd] text-[#933f30]" : "bg-[#e5eee6] text-[#385640]"}`}>{notice.message}</p>}</form></section>
      <section className="mt-5 rounded-[24px] border border-[#e8ddd2] bg-[#fffdfa] p-5 premium-shadow"><div className="flex items-center gap-3"><span className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#f4eadf] text-[#8f6447]"><LockKeyhole className="h-5 w-5" /></span><div><h2 className="text-lg font-bold">การเก็บประวัติงาน</h2><p className="mt-1 text-sm leading-6 text-[#705c4d]">งานที่ทำเสร็จเก็บไว้ {settings.retention_completed_days} วันตามค่าปัจจุบันของบัญชี</p></div></div></section></>}
  </div>;
}
function NumberField({ id, name, label, value, min, max }: { id: string; name: string; label: string; value: number; min: number; max: number }) { return <div><label htmlFor={`setting-${id}`} className="mb-2 block text-sm font-semibold">{label}</label><input id={`setting-${id}`} name={name} type="number" inputMode="numeric" min={min} max={max} step={1} required defaultValue={value} className={field} /></div>; }
