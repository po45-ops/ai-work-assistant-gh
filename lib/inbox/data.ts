export const inboxStatuses = ["pending", "processing", "needs_clarification", "processed", "failed"] as const;
export type InboxStatus = (typeof inboxStatuses)[number];
export type InboxAttachment = { file_name: string; mime_type: string; file_size_bytes: number };
export type InboxItem = {
  id: string;
  raw_text: string;
  input_type: string;
  source: string;
  processed: boolean;
  processing_status: InboxStatus;
  ai_summary: string | null;
  clarification_question: string | null;
  ai_draft: unknown;
  ai_commit_result: unknown;
  ai_clarification_response: string | null;
  created_at: string;
  attachments: InboxAttachment[];
};
export const inboxLabels: Record<InboxStatus, string> = {
  pending: "รอดำเนินการ",
  processing: "กำลังประมวลผล",
  needs_clarification: "ต้องการข้อมูลเพิ่ม",
  processed: "ประมวลผลแล้ว",
  failed: "ประมวลผลไม่สำเร็จ",
};
export const inboxPageSize = 15;
