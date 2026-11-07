"use client";
import { useEffect, useId, useRef, useState, useTransition, type FormEvent } from "react";
import { X, LoaderCircle } from "lucide-react";
import { saveTask } from "@/app/protected/tasks/actions";
import { taskStatuses, taskPriorities, statusLabels, priorityLabels, type Task, type ProjectOption } from "@/lib/tasks/types";
const fieldClass = "min-h-12 w-full rounded-xl border border-[#dfd0c2] bg-white px-3 text-base text-[#2f241e] outline-none focus:ring-2 focus:ring-[#8f6447]/40 disabled:opacity-60";
export function TaskEditor({ task, projects, onClose, onSaved }: { task: Task | null; projects: ProjectOption[]; onClose: () => void; onSaved: (message: string) => void }) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const titleRef = useRef<HTMLInputElement>(null);
  const savingRef = useRef(false);
  const id = useId();
  const [error, setError] = useState("");
  const [pending, startTransition] = useTransition();
  useEffect(() => {
    const dialog = dialogRef.current;
    dialog?.showModal(); titleRef.current?.focus();
    return () => dialog?.close();
  }, []);
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (savingRef.current) return;
    savingRef.current = true;
    const form = new FormData(event.currentTarget); setError("");
    startTransition(async () => {
      try {
        const result = await saveTask(form);
        if (result.ok) onSaved(result.message); else setError(result.message);
      } catch { setError("เชื่อมต่อไม่สำเร็จ กรุณาลองอีกครั้ง"); }
      finally { savingRef.current = false; }
    });
  }
  return <dialog ref={dialogRef} aria-labelledby={`${id}-heading`} onCancel={(event) => { event.preventDefault(); if (!pending) onClose(); }} className="m-auto max-h-[90dvh] w-[calc(100%-2rem)] max-w-xl overflow-y-auto rounded-[24px] border border-[#e8ddd2] bg-[#fffdfa] p-0 text-[#2f241e] shadow-2xl backdrop:bg-[#2f241e]/40">
    <div className="sticky top-0 z-10 flex items-center justify-between border-b border-[#e8ddd2] bg-[#fffdfa] px-5 py-3">
      <h2 id={`${id}-heading`} className="text-xl font-bold">{task ? "แก้ไขงาน" : "เพิ่มงานใหม่"}</h2>
      <button type="button" disabled={pending} onClick={onClose} aria-label="ปิดฟอร์ม" className="flex h-12 w-12 items-center justify-center rounded-xl hover:bg-[#f4eadf] disabled:opacity-50"><X className="h-5 w-5" /></button>
    </div>
    <form onSubmit={submit} className="space-y-5 p-5">
      <input type="hidden" name="id" value={task?.id ?? ""} />
      <input type="hidden" name="updated_at" value={task?.updated_at ?? ""} />
      <fieldset disabled={pending} className="space-y-4">
        <div><label htmlFor={`${id}-title`} className="mb-2 block text-sm font-semibold">ชื่องาน <span aria-hidden="true">*</span></label><input ref={titleRef} id={`${id}-title`} name="title" required maxLength={200} defaultValue={task?.title ?? ""} className={fieldClass} placeholder="งานที่ต้องทำ" /></div>
        <div><label htmlFor={`${id}-description`} className="mb-2 block text-sm font-semibold">รายละเอียด</label><textarea id={`${id}-description`} name="description" maxLength={5000} rows={3} defaultValue={task?.description ?? ""} className={`${fieldClass} py-3`} /></div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div><label htmlFor={`${id}-status`} className="mb-2 block text-sm font-semibold">สถานะ</label><select id={`${id}-status`} name="status" defaultValue={task?.status ?? "not_started"} className={fieldClass}>{taskStatuses.map((status) => <option key={status} value={status}>{statusLabels[status]}</option>)}</select></div>
          <div><label htmlFor={`${id}-priority`} className="mb-2 block text-sm font-semibold">ความสำคัญ</label><select id={`${id}-priority`} name="priority" defaultValue={task?.priority ?? "medium"} className={fieldClass}>{taskPriorities.map((priority) => <option key={priority} value={priority}>{priorityLabels[priority]}</option>)}</select></div>
        </div>
        <div><label htmlFor={`${id}-project`} className="mb-2 block text-sm font-semibold">โปรเจกต์</label><select id={`${id}-project`} name="project_id" defaultValue={task?.project_id ?? ""} className={fieldClass}><option value="">ไม่อยู่ในโปรเจกต์</option>{projects.map((project) => <option key={project.id} value={project.id}>{project.name}</option>)}</select></div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div><label htmlFor={`${id}-due`} className="mb-2 block text-sm font-semibold">วันครบกำหนด</label><input id={`${id}-due`} type="date" name="due_date" defaultValue={task?.due_date ?? ""} className={fieldClass} /></div>
          <div><label htmlFor={`${id}-minutes`} className="mb-2 block text-sm font-semibold">เวลาประมาณ (นาที)</label><input id={`${id}-minutes`} type="number" inputMode="numeric" min={0} max={2147483647} step={1} name="estimated_minutes" defaultValue={task?.estimated_minutes ?? ""} className={fieldClass} placeholder="เช่น 30" /></div>
        </div>
      </fieldset>
      {error && <p role="alert" className="rounded-xl bg-[#fde5dd] p-3 text-sm text-[#933f30]">{error}</p>}
      <div className="flex flex-wrap justify-end gap-3 border-t border-[#e8ddd2] pt-4">
        <button type="button" onClick={onClose} disabled={pending} className="min-h-12 rounded-xl border border-[#dfd0c2] px-5 text-sm font-bold disabled:opacity-50">ยกเลิก</button>
        <button type="submit" disabled={pending} className="inline-flex min-h-12 items-center gap-2 rounded-xl bg-[#8f6447] px-5 text-sm font-bold text-white disabled:opacity-50">{pending && <LoaderCircle className="h-4 w-4 animate-spin" />}{pending ? "กำลังบันทึก…" : "บันทึกงาน"}</button>
      </div>
    </form>
  </dialog>;
}
