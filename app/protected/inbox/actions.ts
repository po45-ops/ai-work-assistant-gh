import { callGasApi, notifyWorkspaceDataChanged } from "@/lib/gas/client";
import { parseInboxDraft, type InboxDraft } from "@/lib/inbox/analysis";

const maxAttachmentBytes = 3 * 1024 * 1024;

type ActionResult<T = undefined> =
  | { ok: true; message: string; data?: T }
  | { ok: false; message: string };

async function fileToBase64AndText(file: File): Promise<{
  file_name: string;
  mime_type: string;
  file_size_bytes: number;
  base64: string;
  text_excerpt: string;
}> {
  const buffer = await file.arrayBuffer();
  const bytes = new Uint8Array(buffer);
  let binary = "";
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  const base64 = btoa(binary);
  let textExcerpt = "";
  if (file.type === "text/plain" || file.name.toLowerCase().endsWith(".txt")) {
    textExcerpt = new TextDecoder("utf-8", { fatal: false }).decode(bytes).slice(0, 45000);
  }
  return {
    file_name: file.name,
    mime_type: file.type || "application/octet-stream",
    file_size_bytes: file.size,
    base64,
    text_excerpt: textExcerpt,
  };
}

export async function captureInboxText(form: FormData): Promise<ActionResult> {
  const rawText = String(form.get("raw_text") ?? "").trim();
  const candidate = form.get("attachment");
  const file = candidate instanceof File && candidate.size > 0 ? candidate : null;
  if (!rawText && !file) return { ok: false, message: "พิมพ์ข้อความหรือแนบไฟล์อย่างน้อยหนึ่งอย่างก่อนบันทึก" };
  if (rawText.length > 5000) return { ok: false, message: "ข้อความยาวเกิน 5,000 ตัวอักษร" };
  if (file && (file.size > maxAttachmentBytes || file.size <= 0)) return { ok: false, message: "แนบไฟล์ได้ไม่เกิน 3 MB ต่อไฟล์" };

  try {
    const attachment = file ? await fileToBase64AndText(file) : null;
    const result = await callGasApi("inbox.capture", { raw_text: rawText, attachment });
    if (result.ok) {
      notifyWorkspaceDataChanged();
      return { ok: true, message: result.message || "บันทึกใน Inbox แล้ว" };
    }
    return { ok: false, message: result.message || "บันทึกข้อความไม่สำเร็จ" };
  } catch {
    return { ok: false, message: "เชื่อมต่อไม่สำเร็จ กรุณาลองอีกครั้ง" };
  }
}

export async function analyzeInboxItem(id: string, clarificationAnswer = ""): Promise<ActionResult<InboxDraft>> {
  if (!id) return { ok: false, message: "รายการ Inbox ไม่ถูกต้อง" };
  try {
    const result = await callGasApi<InboxDraft>("inbox.analyze", { id, clarificationAnswer });
    if (!result.ok || !result.data) {
      return { ok: false, message: result.message || "วิเคราะห์ไม่สำเร็จ กรุณาลองใหม่" };
    }
    const parsed = parseInboxDraft(result.data);
    if (!parsed.data) return { ok: false, message: parsed.error };
    notifyWorkspaceDataChanged();
    return { ok: true, message: result.message || "วิเคราะห์แล้ว", data: parsed.data };
  } catch {
    return { ok: false, message: "วิเคราะห์ไม่สำเร็จ กรุณาลองใหม่" };
  }
}

export async function commitInboxDraft(
  id: string,
  candidate: unknown,
): Promise<ActionResult<{ kind?: string; project_id?: string; task_ids?: string[] }>> {
  const parsed = parseInboxDraft(candidate);
  if (!parsed.data) return { ok: false, message: parsed.error };
  try {
    const result = await callGasApi<{ kind?: string; project_id?: string; task_ids?: string[] }>("inbox.commit", {
      id,
      draft: parsed.data,
    });
    if (!result.ok) {
      return { ok: false, message: result.message || "บันทึกรายการไม่สำเร็จ" };
    }
    notifyWorkspaceDataChanged();
    return { ok: true, message: result.message || "บันทึกรายการแล้ว", data: result.data };
  } catch {
    return { ok: false, message: "เชื่อมต่อไม่สำเร็จ กรุณาลองอีกครั้ง" };
  }
}
