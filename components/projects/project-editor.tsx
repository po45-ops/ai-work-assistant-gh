"use client";
import { useEffect, useId, useRef, useState, useTransition, type FormEvent } from "react";
import { LoaderCircle, X } from "lucide-react";
import { saveProject } from "@/app/protected/projects/actions";
import { priorityLabels, projectPriorities, projectStatuses, riskLabels, riskLevels, statusLabels, type Project } from "@/lib/projects/types";
const field = "min-h-12 w-full rounded-xl border border-[#dfd0c2] bg-white px-3 text-base text-[#2f241e] outline-none focus:ring-2 focus:ring-[#8f6447]/40 disabled:opacity-60";
export function ProjectEditor({ project, onClose, onSaved }: { project: Project | null; onClose: () => void; onSaved: (message: string, id: string) => void }) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const nameRef = useRef<HTMLInputElement>(null);
  const savingRef = useRef(false);
  const id = useId();
  const [error, setError] = useState("");
  const [pending, startTransition] = useTransition();
  useEffect(() => { const dialog = dialogRef.current; dialog?.showModal(); nameRef.current?.focus(); return () => dialog?.close(); }, []);
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (savingRef.current) return;
    savingRef.current = true;
    const form = new FormData(event.currentTarget); setError("");
    startTransition(async () => {
      try { const result = await saveProject(form); if (result.ok && result.id) onSaved(result.message, result.id); else setError(result.message); }
      catch { setError("เชื่อมต่อไม่สำเร็จ กรุณาลองอีกครั้ง"); }
      finally { savingRef.current = false; }
    });
  }
  return <dialog ref={dialogRef} aria-labelledby={`${id}-heading`} onCancel={(event) => { event.preventDefault(); if (!pending) onClose(); }} className="m-auto max-h-[90dvh] w-[calc(100%-2rem)] max-w-2xl overflow-y-auto rounded-[24px] border border-[#e8ddd2] bg-[#fffdfa] p-0 text-[#2f241e] shadow-2xl backdrop:bg-[#2f241e]/40">
    <div className="sticky top-0 z-10 flex items-center justify-between border-b border-[#e8ddd2] bg-[#fffdfa] px-5 py-3"><h2 id={`${id}-heading`} className="text-xl font-bold">{project ? "แก้ไขโปรเจกต์" : "สร้างโปรเจกต์"}</h2><button type="button" disabled={pending} onClick={onClose} aria-label="ปิดฟอร์ม" className="flex h-12 w-12 items-center justify-center rounded-xl hover:bg-[#f4eadf]"><X className="h-5 w-5" /></button></div>
    <form onSubmit={submit} className="space-y-5 p-5">
      <input type="hidden" name="id" value={project?.id ?? ""} /><input type="hidden" name="updated_at" value={project?.updated_at ?? ""} />
      <fieldset disabled={pending} className="space-y-4">
        <div><label htmlFor={`${id}-name`} className="mb-2 block text-sm font-semibold">ชื่อโปรเจกต์ *</label><input ref={nameRef} id={`${id}-name`} name="name" required maxLength={200} defaultValue={project?.name ?? ""} className={field} placeholder="เช่น จัดทำแผนการสอน" /></div>
        <div><label htmlFor={`${id}-goal`} className="mb-2 block text-sm font-semibold">เป้าหมาย</label><textarea id={`${id}-goal`} name="goal" maxLength={1000} rows={2} defaultValue={project?.goal ?? ""} className={`${field} py-3`} placeholder="ผลลัพธ์ที่ต้องการ" /></div>
        <div><label htmlFor={`${id}-description`} className="mb-2 block text-sm font-semibold">รายละเอียด</label><textarea id={`${id}-description`} name="description" maxLength={5000} rows={3} defaultValue={project?.description ?? ""} className={`${field} py-3`} /></div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div><label htmlFor={`${id}-status`} className="mb-2 block text-sm font-semibold">สถานะ</label><select id={`${id}-status`} name="status" defaultValue={project?.status ?? "planning"} className={field}>{projectStatuses.map((value) => <option key={value} value={value}>{statusLabels[value]}</option>)}</select></div>
          <div><label htmlFor={`${id}-priority`} className="mb-2 block text-sm font-semibold">ความสำคัญ</label><select id={`${id}-priority`} name="priority" defaultValue={project?.priority ?? "medium"} className={field}>{projectPriorities.map((value) => <option key={value} value={value}>{priorityLabels[value]}</option>)}</select></div>
          <div><label htmlFor={`${id}-risk`} className="mb-2 block text-sm font-semibold">ความเสี่ยง</label><select id={`${id}-risk`} name="risk_level" defaultValue={project?.risk_level ?? "green"} className={field}>{riskLevels.map((value) => <option key={value} value={value}>{riskLabels[value]}</option>)}</select></div>
          <div><label htmlFor={`${id}-progress`} className="mb-2 block text-sm font-semibold">ความคืบหน้า (%)</label><input id={`${id}-progress`} name="progress_percent" type="number" inputMode="numeric" min={0} max={100} step={1} required defaultValue={project?.progress_percent ?? 0} className={field} /></div>
          <div><label htmlFor={`${id}-start`} className="mb-2 block text-sm font-semibold">วันเริ่มต้น</label><input id={`${id}-start`} name="start_date" type="date" defaultValue={project?.start_date ?? ""} className={field} /></div>
          <div><label htmlFor={`${id}-target`} className="mb-2 block text-sm font-semibold">วันเป้าหมาย</label><input id={`${id}-target`} name="target_date" type="date" defaultValue={project?.target_date ?? ""} className={field} /></div>
        </div>
      </fieldset>
      {error && <p role="alert" className="rounded-xl bg-[#fde5dd] p-3 text-sm text-[#933f30]">{error}</p>}
      <div className="flex flex-wrap justify-end gap-3 border-t border-[#e8ddd2] pt-4"><button type="button" onClick={onClose} disabled={pending} className="min-h-12 rounded-xl border border-[#dfd0c2] px-5 text-sm font-bold">ยกเลิก</button><button type="submit" disabled={pending} className="inline-flex min-h-12 items-center gap-2 rounded-xl bg-[#8f6447] px-5 text-sm font-bold text-white disabled:opacity-50">{pending && <LoaderCircle className="h-4 w-4 animate-spin" />}{pending ? "กำลังบันทึก…" : "บันทึกโปรเจกต์"}</button></div>
    </form>
  </dialog>;
}
