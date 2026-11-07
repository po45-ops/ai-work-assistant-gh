"use client";

import { Suspense, useCallback, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { CalendarIntegratedWorkspace } from "@/components/calendar/calendar-integrated-workspace";
import { callGasApi } from "@/lib/gas/client";
import { isDate } from "@/lib/tasks/validation";
import type { CalendarEvent } from "@/lib/calendar/data";

type CalendarResult = {
  events: CalendarEvent[];
  error: string | null;
  googleError: string | null;
  googleConnected: boolean;
  truncated: boolean;
};

function bangkokToday() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Bangkok",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

export default function CalendarPage() {
  return (
    <Suspense fallback={<div role="status" className="px-4 py-8 text-base text-[#705c4d]">กำลังโหลดปฏิทินของคุณ…</div>}>
      <Content />
    </Suspense>
  );
}

function Content() {
  const searchParams = useSearchParams();
  const today = bangkokToday();
  const rawMonth = searchParams.get("month") || "";
  const month =
    /^\d{4}-(0[1-9]|1[0-2])$/.test(rawMonth) &&
    Number(rawMonth.slice(0, 4)) >= 1900 &&
    Number(rawMonth.slice(0, 4)) <= 2100
      ? rawMonth
      : today.slice(0, 7);
  const rawDay = searchParams.get("day") || "";
  const day =
    isDate(rawDay) && rawDay.startsWith(`${month}-`)
      ? rawDay
      : month === today.slice(0, 7)
        ? today
        : `${month}-01`;

  const [result, setResult] = useState<CalendarResult | null>(null);

  const fetchCalendar = useCallback(async () => {
    try {
      const res = await callGasApi<CalendarResult>("calendar.get", { month });
      if (res.ok && res.data) {
        setResult(res.data);
      } else {
        setResult({
          events: [],
          error: res.message || "โหลดกำหนดการไม่สำเร็จ",
          googleError: null,
          googleConnected: false,
          truncated: false,
        });
      }
    } catch {
      setResult({
        events: [],
        error: "เชื่อมต่อ Google Apps Script ไม่สำเร็จ",
        googleError: null,
        googleConnected: false,
        truncated: false,
      });
    }
  }, [month]);

  useEffect(() => {
    fetchCalendar();
    window.addEventListener("po-data-updated", fetchCalendar);
    return () => window.removeEventListener("po-data-updated", fetchCalendar);
  }, [fetchCalendar]);

  if (!result) {
    return <div role="status" className="px-4 py-8 text-base text-[#705c4d]">กำลังโหลดปฏิทินของคุณ…</div>;
  }

  return <CalendarIntegratedWorkspace month={month} day={day} today={today} {...result} />;
}
