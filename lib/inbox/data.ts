import "server-only";
import { redirect } from "next/navigation";
import { getAuthenticatedUser } from "@/lib/supabase/auth-context";
import { escapeSearch } from "@/lib/tasks/validation";
export const inboxStatuses = ["pending", "processing", "needs_clarification", "processed", "failed"] as const;
export type InboxStatus = (typeof inboxStatuses)[number];
export type InboxAttachment = { file_name: string; mime_type: string; file_size_bytes: number };
export type InboxItem = { id: string; raw_text: string; input_type: string; source: string; processed: boolean; processing_status: InboxStatus; ai_summary: string | null; clarification_question: string | null; ai_draft: unknown; ai_commit_result: unknown; ai_clarification_response: string | null; created_at: string; attachments: InboxAttachment[] };
export const inboxLabels: Record<InboxStatus, string> = { pending: "รอดำเนินการ", processing: "กำลังประมวลผล", needs_clarification: "ต้องการข้อมูลเพิ่ม", processed: "ประมวลผลแล้ว", failed: "ประมวลผลไม่สำเร็จ" };
export const inboxPageSize = 15;
export function parseInboxFilters(params: Record<string, string | string[] | undefined>) {
  const search = typeof params.search === "string" ? params.search.trim().slice(0, 200) : "";
  const status = typeof params.status === "string" ? inboxStatuses.find((value) => value === params.status) ?? "all" : "all";
  const pageValue = Number(params.page);
  const page = Number.isSafeInteger(pageValue) && pageValue > 0 && pageValue <= 100000 ? pageValue : 1;
  return { search, status, page };
}
export type InboxFilters = ReturnType<typeof parseInboxFilters>;
export function inboxQuery(filters: InboxFilters, page = filters.page) {
  const query = new URLSearchParams();
  if (filters.search) query.set("search", filters.search);
  if (filters.status !== "all") query.set("status", filters.status);
  if (page > 1) query.set("page", String(page));
  return `/protected/inbox${query.size ? `?${query}` : ""}`;
}
export async function loadInbox(filters: InboxFilters) {
  const { supabase, userId } = await getAuthenticatedUser();
  let query = supabase.from("inbox").select("id,raw_text,input_type,source,processed,processing_status,ai_summary,clarification_question,ai_draft,ai_commit_result,ai_clarification_response,created_at", { count: "exact" }).eq("user_id", userId);
  if (filters.search) query = query.ilike("raw_text", `%${escapeSearch(filters.search)}%`);
  if (filters.status !== "all") query = query.eq("processing_status", filters.status);
  const offset = (filters.page - 1) * inboxPageSize;
  const [list, pending, clarification] = await Promise.all([
    query.order("created_at", { ascending: false }).order("id", { ascending: false }).range(offset, offset + inboxPageSize - 1).returns<Omit<InboxItem, "attachments">[]>(),
    supabase.from("inbox").select("id", { count: "exact", head: true }).eq("user_id", userId).eq("processing_status", "pending"),
    supabase.from("inbox").select("id", { count: "exact", head: true }).eq("user_id", userId).eq("processing_status", "needs_clarification"),
  ]);
  if (list.error || pending.error || clarification.error) return { items: [] as InboxItem[], count: 0, pending: 0, clarification: 0, error: "โหลดข้อความ Inbox ไม่สำเร็จ กรุณาลองอีกครั้ง" };
  const count = list.count ?? 0;
  const lastPage = Math.max(1, Math.ceil(count / inboxPageSize));
  if (filters.page > lastPage) redirect(inboxQuery(filters, lastPage));
  const loaded = list.data ?? [];
  const attachmentsResult = loaded.length ? await supabase.from("inbox_attachments")
    .select("inbox_id,file_name,mime_type,file_size_bytes").eq("user_id", userId).in("inbox_id", loaded.map((item) => item.id)) : { data: [], error: null };
  if (attachmentsResult.error) return { items: [] as InboxItem[], count: 0, pending: 0, clarification: 0, error: "โหลดไฟล์แนบใน Inbox ไม่สำเร็จ กรุณาลองอีกครั้ง" };
  const byInbox = new Map<string, InboxAttachment[]>();
  for (const attachment of attachmentsResult.data ?? []) {
    const current = byInbox.get(attachment.inbox_id) ?? [];
    current.push({ file_name: attachment.file_name, mime_type: attachment.mime_type, file_size_bytes: attachment.file_size_bytes });
    byInbox.set(attachment.inbox_id, current);
  }
  return { items: loaded.map((item) => ({ ...item, attachments: byInbox.get(item.id) ?? [] })) as InboxItem[], count, pending: pending.count ?? 0, clarification: clarification.count ?? 0, error: null };
}
