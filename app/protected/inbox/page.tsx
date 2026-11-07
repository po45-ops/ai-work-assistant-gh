"use client";

import { Suspense, useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { InboxCapture } from "@/components/inbox/inbox-capture";
import { InboxItemActions } from "@/components/inbox/inbox-item-actions";
import { callGasApi } from "@/lib/gas/client";
import type { InboxItem, InboxStatus } from "@/lib/inbox/data";

const inboxStatuses: readonly InboxStatus[] = ["pending", "processing", "needs_clarification", "processed", "failed"];
const inboxLabels: Record<InboxStatus, string> = {
  pending: "รอดำเนินการ",
  processing: "กำลังประมวลผล",
  needs_clarification: "ต้องการข้อมูลเพิ่ม",
  processed: "ประมวลผลแล้ว",
  failed: "ประมวลผลไม่สำเร็จ",
};
const inboxPageSize = 15;

type InboxResult = {
  items: InboxItem[];
  count: number;
  pending: number;
  clarification: number;
  error: string | null;
};

function parseFilters(params: URLSearchParams) {
  const search = (params.get("search") || "").trim().slice(0, 200);
  const rawStatus = params.get("status") || "all";
  const status = inboxStatuses.find((v) => v === rawStatus) ?? "all";
  const pageVal = Number(params.get("page") || 1);
  const page = Number.isSafeInteger(pageVal) && pageVal > 0 ? pageVal : 1;
  return { search, status, page };
}

function inboxQuery(filters: ReturnType<typeof parseFilters>, page = filters.page) {
  const query = new URLSearchParams();
  if (filters.search) query.set("search", filters.search);
  if (filters.status !== "all") query.set("status", filters.status);
  if (page > 1) query.set("page", String(page));
  return `/protected/inbox${query.size ? `?${query}` : ""}`;
}

export default function InboxPage() {
  return (
    <Suspense fallback={<div role="status" className="px-4 py-8 text-base text-[#705c4d]">กำลังโหลด Inbox ของคุณ…</div>}>
      <Content />
    </Suspense>
  );
}

function Content() {
  const searchParams = useSearchParams();
  const queryKey = searchParams.toString();
  const filters = parseFilters(new URLSearchParams(queryKey));
  const [data, setData] = useState<InboxResult | null>(null);

  const fetchInbox = useCallback(async () => {
    try {
      const res = await callGasApi<InboxResult>("inbox.list", parseFilters(new URLSearchParams(queryKey)));
      if (res.ok && res.data) {
        setData(res.data);
      } else {
        setData({ items: [], count: 0, pending: 0, clarification: 0, error: res.message || "โหลด Inbox ไม่สำเร็จ" });
      }
    } catch {
      setData({ items: [], count: 0, pending: 0, clarification: 0, error: "เชื่อมต่อ Google Apps Script ไม่สำเร็จ" });
    }
  }, [queryKey]);

  useEffect(() => {
    fetchInbox();
    window.addEventListener("po-data-updated", fetchInbox);
    return () => window.removeEventListener("po-data-updated", fetchInbox);
  }, [fetchInbox]);

  if (!data) {
    return <div role="status" className="px-4 py-8 text-base text-[#705c4d]">กำลังโหลด Inbox ของคุณ…</div>;
  }

  const { items, count, pending, clarification, error } = data;
  const pages = Math.max(1, Math.ceil(count / inboxPageSize));
  const filtered = Boolean(filters.search || filters.status !== "all");

  return (
    <div className="mx-auto w-full max-w-[1260px] px-4 py-5 sm:px-6 lg:px-8 xl:py-8">
      <div className="mb-6">
        <p className="text-sm font-semibold tracking-wider text-[#8f6447]">INBOX</p>
        <h1 className="mt-2 text-3xl font-bold tracking-tight sm:text-4xl">Inbox</h1>
        <p className="mt-2 text-base text-[#705c4d]">
          บันทึกข้อความหรือเอกสาร ให้ AI ช่วยวิเคราะห์ แล้วตรวจร่างก่อนสร้างงานและกำหนดการ
        </p>
      </div>
      <InboxCapture />
      {error ? (
        <section role="alert" className="mt-6 rounded-[24px] border border-[#e8ddd2] bg-[#fffdfa] p-6">
          <h2 className="text-lg font-bold">ยังโหลด Inbox ไม่ได้</h2>
          <p className="mt-2 text-base text-[#705c4d]">{error}</p>
        </section>
      ) : (
        <>
          <div className="my-6 grid gap-3 sm:grid-cols-2">
            <div className="rounded-2xl border border-[#e8ddd2] bg-[#fffdfa] p-4">
              <p className="text-sm font-semibold text-[#705c4d]">รอดำเนินการ</p>
              <p className="mt-2 text-3xl font-bold">{pending.toLocaleString("th-TH")}</p>
            </div>
            <div className="rounded-2xl border border-[#e8ddd2] bg-[#fffdfa] p-4">
              <p className="text-sm font-semibold text-[#705c4d]">ต้องการข้อมูลเพิ่ม</p>
              <p className="mt-2 text-3xl font-bold">{clarification.toLocaleString("th-TH")}</p>
            </div>
          </div>
          <form
            method="get"
            action="/protected/inbox"
            aria-label="ค้นหาและกรอง Inbox"
            className="mb-5 flex flex-col gap-3 rounded-[24px] border border-[#e8ddd2] bg-[#fffdfa] p-4 sm:flex-row sm:items-end"
          >
            <div className="flex-1">
              <label htmlFor="inbox-search" className="mb-2 block text-sm font-semibold">
                ค้นหาข้อความ
              </label>
              <input
                id="inbox-search"
                name="search"
                type="search"
                maxLength={200}
                defaultValue={filters.search}
                placeholder="คำในข้อความ"
                className="min-h-12 w-full rounded-xl border border-[#dfd0c2] bg-white px-3 text-base"
              />
            </div>
            <div className="sm:w-56">
              <label htmlFor="inbox-status" className="mb-2 block text-sm font-semibold">
                สถานะ
              </label>
              <select
                id="inbox-status"
                name="status"
                defaultValue={filters.status}
                className="min-h-12 w-full rounded-xl border border-[#dfd0c2] bg-white px-3 text-base"
              >
                <option value="all">ทุกสถานะ</option>
                {inboxStatuses.map((status) => (
                  <option key={status} value={status}>
                    {inboxLabels[status]}
                  </option>
                ))}
              </select>
            </div>
            <button type="submit" className="min-h-12 rounded-xl bg-[#f4eadf] px-5 text-sm font-semibold text-[#604a3b]">
              ค้นหา
            </button>
            {filtered && (
              <Link href="/protected/inbox" className="inline-flex min-h-12 items-center px-3 text-sm font-semibold text-[#8f6447]">
                ล้างตัวกรอง
              </Link>
            )}
          </form>
          <section className="overflow-hidden rounded-[24px] border border-[#e8ddd2] bg-[#fffdfa] premium-shadow">
            <div className="flex items-center justify-between border-b border-[#eee4db] p-5">
              <h2 className="text-lg font-bold">{filtered ? "ผลการค้นหา" : "ข้อความทั้งหมด"}</h2>
              <span className="text-sm text-[#705c4d]">{count.toLocaleString("th-TH")} รายการ</span>
            </div>
            {items.length === 0 ? (
              <div className="px-5 py-12 text-center">
                <h3 className="text-lg font-bold">{filtered ? "ไม่พบข้อความตามเงื่อนไข" : "ยังไม่มีข้อความใน Inbox"}</h3>
                <p className="mt-2 text-base text-[#705c4d]">
                  {filtered ? "ลองค้นหาใหม่หรือล้างตัวกรอง" : "บันทึกข้อความที่นึกขึ้นได้ในช่องด้านบน"}
                </p>
              </div>
            ) : (
              <ul className="divide-y divide-[#eee4db]">
                {items.map((item) => (
                  <InboxRow key={item.id} item={item} />
                ))}
              </ul>
            )}
          </section>
          {pages > 1 && (
            <nav aria-label="หน้ารายการ Inbox" className="mt-5 flex items-center justify-between gap-3 text-sm">
              {filters.page > 1 ? (
                <Link href={inboxQuery(filters, filters.page - 1)} className="inline-flex min-h-12 items-center rounded-xl border border-[#dfd0c2] bg-white px-4">
                  ก่อนหน้า
                </Link>
              ) : (
                <span />
              )}
              <span>
                หน้า {filters.page} จาก {pages}
              </span>
              {filters.page < pages ? (
                <Link href={inboxQuery(filters, filters.page + 1)} className="inline-flex min-h-12 items-center rounded-xl border border-[#dfd0c2] bg-white px-4">
                  ถัดไป
                </Link>
              ) : (
                <span />
              )}
            </nav>
          )}
        </>
      )}
    </div>
  );
}

function InboxRow({ item }: { item: InboxItem }) {
  const time = new Intl.DateTimeFormat("th-TH", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Asia/Bangkok",
  }).format(new Date(item.created_at));
  const hasDraft = Boolean(item.ai_draft) && !item.ai_commit_result;
  const statusLabel = item.ai_commit_result
    ? "บันทึกแล้ว"
    : hasDraft
      ? "ร่างพร้อมตรวจ"
      : inboxLabels[item.processing_status] ?? item.processing_status;
  return (
    <li className="p-5">
      <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
        <span
          className={`rounded-full px-3 py-1 font-semibold ${
            item.ai_commit_result
              ? "bg-[#e5eee6] text-[#385640]"
              : hasDraft
                ? "bg-[#e9f0f7] text-[#405b73]"
                : "bg-[#f4eadf] text-[#8f6447]"
          }`}
        >
          {statusLabel}
        </span>
        <time dateTime={item.created_at} className="text-[#705c4d]">
          {time}
        </time>
      </div>
      <p className="mt-3 whitespace-pre-wrap break-words text-base leading-7">{item.raw_text}</p>
      {item.ai_summary && !hasDraft && (
        <p className="mt-3 rounded-xl bg-[#f7f1e9] p-3 text-sm text-[#604a3b]">สรุป: {item.ai_summary}</p>
      )}
      {item.clarification_question && !hasDraft && (
        <p className="mt-2 text-sm font-semibold text-[#8f6447]">ต้องการข้อมูลเพิ่ม: {item.clarification_question}</p>
      )}
      <InboxItemActions
        id={item.id}
        initialDraft={item.ai_draft}
        attachments={item.attachments}
        committed={item.ai_commit_result}
        initialClarificationResponse={item.ai_clarification_response}
      />
    </li>
  );
}
