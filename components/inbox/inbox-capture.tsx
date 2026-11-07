"use client";
import { useRouter } from "next/navigation";
import { useRef, useState, useTransition, type FormEvent } from "react";
import { FileText, Inbox, LoaderCircle, Paperclip, X } from "lucide-react";
import { captureInboxText } from "@/app/protected/inbox/actions";

export function InboxCapture() {
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);
  const lock = useRef(false);
  const [notice, setNotice] = useState<{ error: boolean; message: string } | null>(null);
  const [fileName, setFileName] = useState("");
  const [pending, startTransition] = useTransition();

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (lock.current) return;
    lock.current = true;
    setNotice(null);
    const form = new FormData(event.currentTarget);
    startTransition(async () => {
      try {
        const result = await captureInboxText(form);
        setNotice({ error: !result.ok, message: result.message });
        if (result.ok) {
          formRef.current?.reset();
          setFileName("");
          router.refresh();
        }
      } catch {
        setNotice({ error: true, message: "เชื่อมต่อไม่สำเร็จ กรุณาลองอีกครั้ง" });
      } finally {
        lock.current = false;
      }
    });
  }

  return <section className="rounded-[24px] border border-[#dfcbbb] bg-gradient-to-r from-[#f4e5d8] to-[#fbf6f0] p-5 premium-shadow sm:p-6">
    <div className="flex items-start gap-3">
      <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[#8f6447] text-white"><Inbox className="h-5 w-5" /></div>
      <div><h2 className="text-lg font-bold">บันทึกข้อความหรือเอกสาร</h2><p className="mt-1 text-sm leading-6 text-[#705c4d]">พิมพ์สิ่งที่ต้องทำหรือแนบเอกสาร แล้วให้ AI ช่วยสรุปและจัดเป็นร่างให้ตรวจก่อนบันทึก</p></div>
    </div>
    <form ref={formRef} onSubmit={submit} className="mt-5">
      <label htmlFor="inbox-input" className="mb-2 block text-sm font-semibold">ข้อความหรือคำสั่ง</label>
      <textarea id="inbox-input" name="raw_text" maxLength={5000} rows={4} placeholder="เช่น ช่วยสรุปเอกสารนี้ แล้วแยกสิ่งที่ต้องทำพร้อมกำหนดส่ง" disabled={pending} className="w-full rounded-xl border border-[#dfd0c2] bg-white p-3 text-base text-[#2f241e] outline-none focus:ring-2 focus:ring-[#8f6447]/40 disabled:opacity-50" />
      <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <label htmlFor="inbox-attachment" className="inline-flex min-h-11 w-fit cursor-pointer items-center gap-2 rounded-xl border border-[#dfcbbb] bg-white px-4 text-sm font-semibold text-[#604a3b] hover:bg-[#fbf7f2]">
          <Paperclip className="h-4 w-4" /> แนบไฟล์
          <input id="inbox-attachment" name="attachment" type="file" accept=".pdf,.docx,.txt,.jpg,.jpeg,.png,.webp,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/plain,image/jpeg,image/png,image/webp" disabled={pending} className="sr-only" onChange={(event) => setFileName(event.currentTarget.files?.[0]?.name ?? "")} />
        </label>
        {fileName && <span className="flex min-w-0 items-center gap-2 text-sm text-[#604a3b]"><FileText className="h-4 w-4 shrink-0" /><span className="max-w-[230px] truncate">{fileName}</span><button type="button" aria-label="นำไฟล์ออก" onClick={() => { const input = formRef.current?.elements.namedItem("attachment"); if (input instanceof HTMLInputElement) input.value = ""; setFileName(""); }} className="rounded-full p-1 hover:bg-[#f0e4d9]"><X className="h-4 w-4" /></button></span>}
      </div>
      <div className="mt-3 flex flex-col gap-3 border-t border-[#e9d9ca] pt-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="max-w-2xl text-xs leading-5 text-[#705c4d]">รองรับ PDF, DOCX, TXT และรูปภาพ สูงสุด 3 MB ไฟล์จะถูกส่งให้ Google Gemini ช่วยวิเคราะห์และเก็บเป็นส่วนตัว · DOCX อ่านข้อความ หากเป็นภาพสแกนให้แนบเป็น PDF หรือรูปภาพ</p>
        <button type="submit" disabled={pending} className="inline-flex min-h-12 shrink-0 items-center justify-center gap-2 rounded-xl bg-[#8f6447] px-5 text-sm font-semibold text-white disabled:opacity-50">{pending && <LoaderCircle className="h-4 w-4 animate-spin" />}{pending ? "กำลังบันทึก…" : "บันทึกใน Inbox"}</button>
      </div>
    </form>
    {notice && <p role={notice.error ? "alert" : "status"} className={`mt-4 rounded-xl p-3 text-sm ${notice.error ? "bg-[#fde5dd] text-[#933f30]" : "bg-[#e5eee6] text-[#385640]"}`}>{notice.message}</p>}
  </section>;
}
