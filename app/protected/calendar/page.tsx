import { Suspense } from "react";
import { CalendarIntegratedWorkspace } from "@/components/calendar/calendar-integrated-workspace";
import { loadCalendar, parseCalendarParams } from "@/lib/calendar/data";
type SearchParams = Promise<Record<string, string | string[] | undefined>>;
export default function CalendarPage({ searchParams }: { searchParams: SearchParams }) {
  return <Suspense fallback={<div role="status" className="px-4 py-8 text-base text-[#705c4d]">กำลังโหลดปฏิทินของคุณ…</div>}><Content searchParams={searchParams} /></Suspense>;
}
async function Content({ searchParams }: { searchParams: SearchParams }) {
  const params = parseCalendarParams(await searchParams);
  const result = await loadCalendar(params.month);
  return <CalendarIntegratedWorkspace {...params} {...result} />;
}
