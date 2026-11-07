import Link from "next/link";
import { ArrowUpRight, CalendarDays, ChevronLeft, ChevronRight, CircleCheck, FolderKanban, ListTodo, Plus } from "lucide-react";
import type { CalendarEvent } from "@/lib/calendar/data";

const weekdays = ["จ", "อ", "พ", "พฤ", "ศ", "ส", "อา"];
const kindLabels = { task: "งาน", milestone: "Milestone", project: "เป้าหมายโปรเจกต์", google: "Google Calendar" };
function calendarUrl(month: string, day: string) { return "/protected/calendar?month=" + month + "&day=" + day; }
function monthShift(month: string, difference: number) {
  const date = new Date(Date.UTC(Number(month.slice(0, 4)), Number(month.slice(5, 7)) - 1 + difference, 1));
  return date.toISOString().slice(0, 7);
}
function dateLabel(date: string, options: Intl.DateTimeFormatOptions) { return new Intl.DateTimeFormat("th-TH", options).format(new Date(date + "T12:00:00Z")); }
function eventLink(event: CalendarEvent) {
  if (event.kind === "task") return "/protected/tasks?search=" + encodeURIComponent(event.title);
  if (event.kind === "google") return "/protected/calendar";
  return "/protected/projects/view?id=" + encodeURIComponent(event.projectId ?? "");
}

export function CalendarIntegratedWorkspace({ month, day, today, events, error, googleError, googleConnected, truncated }: {
  month: string; day: string; today: string; events: CalendarEvent[]; error: string | null;
  googleError: string | null; googleConnected: boolean; truncated: boolean;
}) {
  const year = Number(month.slice(0, 4));
  const monthIndex = Number(month.slice(5, 7)) - 1;
  const days = new Date(Date.UTC(year, monthIndex + 1, 0)).getUTCDate();
  const firstDay = (new Date(Date.UTC(year, monthIndex, 1)).getUTCDay() + 6) % 7;
  const cells = Math.ceil((firstDay + days) / 7) * 7;
  const eventCount = new Map<string, number>();
  for (const event of events) eventCount.set(event.date, (eventCount.get(event.date) ?? 0) + 1);
  const selected = events.filter((event) => event.date === day);
  const next = monthShift(month, 1);
  const previous = monthShift(month, -1);
  const todayMonth = today.slice(0, 7);

  return <div className="mx-auto w-full max-w-[1320px] px-4 py-5 sm:px-6 lg:px-8 xl:py-8">
    <div className="mb-7 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between"><div><p className="text-sm font-semibold tracking-wider text-[#8f6447]">CALENDAR</p><h1 className="mt-2 text-3xl font-bold tracking-tight sm:text-4xl">ปฏิทิน</h1><p className="mt-2 text-base text-[#705c4d]">งานและกำหนดการจากระบบ{googleConnected ? " รวมถึง Google Calendar" : ""}</p></div><Link href="/protected/tasks" className="inline-flex min-h-12 w-fit items-center gap-2 rounded-xl bg-[#8f6447] px-5 text-base font-semibold text-white"><Plus className="h-5 w-5" />เพิ่มงานในหน้า Tasks</Link></div>
    {googleError && <p role="status" className="mb-4 rounded-xl bg-[#fff3d8] p-3 text-sm text-[#70512e]">{googleError}</p>}
    {!googleConnected && <p className="mb-4 text-sm text-[#705c4d]">ต้องการดูนัดหมายส่วนตัวด้วยไหม? <Link href="/protected/settings" className="font-semibold text-[#8f6447] underline underline-offset-2">เชื่อม Google Calendar ในหน้า ตั้งค่า</Link></p>}
    {error ? <section role="alert" className="rounded-[24px] border border-[#e8ddd2] bg-[#fffdfa] p-6"><h2 className="text-lg font-bold">ยังโหลดปฏิทินไม่ได้</h2><p className="mt-2 text-base text-[#705c4d]">{error}</p></section> : <div className="grid gap-5 xl:grid-cols-[minmax(0,1.1fr)_minmax(340px,.9fr)]">
      <section aria-label="ปฏิทินรายเดือน" className="rounded-[24px] border border-[#e8ddd2] bg-[#fffdfa] p-3 premium-shadow sm:p-6">
        <div className="mb-5 flex items-center justify-between gap-2"><Link href={calendarUrl(previous, previous + "-01")} aria-label="เดือนก่อนหน้า" className="flex h-12 w-12 items-center justify-center rounded-xl text-[#8f6447] hover:bg-[#f4eadf]"><ChevronLeft className="h-5 w-5" /></Link><div className="text-center"><h2 className="text-lg font-bold sm:text-xl">{dateLabel(month + "-01", { month: "long", year: "numeric" })}</h2><p className="mt-1 text-sm text-[#705c4d]">{events.length.toLocaleString("th-TH")} กำหนดการ</p></div><Link href={calendarUrl(next, next + "-01")} aria-label="เดือนถัดไป" className="flex h-12 w-12 items-center justify-center rounded-xl text-[#8f6447] hover:bg-[#f4eadf]"><ChevronRight className="h-5 w-5" /></Link></div>
        <div className="grid grid-cols-7 gap-1 text-center sm:gap-2">{weekdays.map((weekday) => <span key={weekday} className="py-2 text-sm font-semibold text-[#8c7564]">{weekday}</span>)}{Array.from({ length: cells }, (_, index) => {
          const number = index - firstDay + 1;
          if (number < 1 || number > days) return <span key={"blank-" + index} aria-hidden="true" />;
          const date = month + "-" + String(number).padStart(2, "0");
          const count = eventCount.get(date) ?? 0;
          const active = date === day;
          const current = date === today;
          const cellClass = active ? "bg-[#8f6447] text-white" : current ? "bg-[#f4eadf] text-[#6a4932]" : "text-[#4b3b30] hover:bg-[#f7f1e9]";
          const countClass = active ? "bg-white/25 text-white" : "bg-[#ead8c7] text-[#68472f]";
          return <Link key={date} href={calendarUrl(month, date)} aria-label={dateLabel(date, { day: "numeric", month: "long" }) + (count ? " " + count + " กำหนดการ" : "")} aria-current={active ? "date" : undefined} className={"flex min-h-14 min-w-0 flex-col items-center justify-center rounded-xl text-sm font-semibold transition-colors sm:min-h-16 " + cellClass}><span>{number}</span>{count > 0 && <span className={"mt-1 rounded-full px-1.5 text-[11px] leading-5 " + countClass}>{count}</span>}</Link>;
        })}</div>
        <div className="mt-5 flex flex-wrap items-center justify-between gap-2 border-t border-[#eee4db] pt-4 text-sm"><span className="text-[#705c4d]">เลือกวันที่เพื่อดูรายการด้านล่าง</span>{month !== todayMonth || day !== today ? <Link href={calendarUrl(todayMonth, today)} className="inline-flex min-h-11 items-center font-semibold text-[#8f6447]">กลับไปวันนี้</Link> : null}</div>
      </section>
      <section aria-label="กำหนดการวันที่เลือก" className="rounded-[24px] border border-[#e8ddd2] bg-[#fffdfa] p-5 premium-shadow sm:p-6"><div className="mb-5 flex items-start justify-between gap-3"><div><p className="text-sm font-semibold text-[#8f6447]">กำหนดการ</p><h2 className="mt-1 text-xl font-bold">{dateLabel(day, { weekday: "long", day: "numeric", month: "long", year: "numeric" })}</h2><p className="mt-2 text-sm text-[#705c4d]">{selected.length.toLocaleString("th-TH")} รายการ</p></div><CalendarDays className="h-6 w-6 shrink-0 text-[#8f6447]" /></div>
        {selected.length === 0 ? <div className="rounded-xl bg-[#f7f1e9] px-4 py-8 text-center"><CircleCheck className="mx-auto h-8 w-8 text-[#8f6447]" /><p className="mt-3 text-base font-semibold">ยังไม่มีกำหนดการในวันนี้</p><p className="mt-1 text-sm text-[#705c4d]">เพิ่มงานพร้อมวันครบกำหนดในหน้า Tasks</p></div> : <ul className="space-y-3">{selected.map((event) => <li key={event.kind + "-" + event.id}><CalendarEventCard event={event} /></li>)}</ul>}
      </section>
    </div>}
    {truncated && <p role="status" className="mt-5 text-sm text-[#933f30]">มีข้อมูลจำนวนมาก ปฏิทินแสดงได้สูงสุด 1,000 รายการต่อประเภทในเดือนนี้</p>}
  </div>;
}

function CalendarEventCard({ event }: { event: CalendarEvent }) {
  const tone = event.kind === "google" ? "bg-[#e9f0e8] text-[#47644c]" : "bg-[#f4eadf] text-[#8f6447]";
  const contents = <><span className={"flex h-10 w-10 shrink-0 items-center justify-center rounded-xl " + tone}>{event.kind === "task" ? <ListTodo className="h-5 w-5" /> : event.kind === "google" ? <CalendarDays className="h-5 w-5" /> : <FolderKanban className="h-5 w-5" />}</span><span className="min-w-0 flex-1"><span className="text-xs font-semibold text-[#8f6447]">{kindLabels[event.kind]}</span><span className="mt-1 block break-words text-base font-semibold">{event.title}</span>{event.time && <span className="mt-1 block text-sm text-[#705c4d]">เวลา {event.time} น.</span>}{event.projectName && <span className="mt-1 block break-words text-sm text-[#705c4d]">{event.projectName}</span>}{event.status === "done" || event.status === "completed" ? <span className="mt-1 block text-sm text-[#47644c]">เสร็จแล้ว</span> : null}</span><ArrowUpRight className="h-4 w-4 shrink-0 text-[#8f6447]" /></>;
  const className = "flex min-h-16 items-start gap-3 rounded-2xl border border-[#eee4db] bg-[#fffaf5] p-4 hover:border-[#cba98e]";
  return event.externalUrl ? <a href={event.externalUrl} target="_blank" rel="noreferrer" className={className} aria-label={event.title + " เปิดใน Google Calendar"}>{contents}</a> : <Link href={eventLink(event)} className={className}>{contents}</Link>;
}
