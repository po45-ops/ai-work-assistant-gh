"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { CalendarDays, Check, FileText, LoaderCircle, Plus, Sparkles, Trash2 } from "lucide-react";
import { analyzeInboxItem, commitInboxDraft } from "@/app/protected/inbox/actions";
import { parseInboxDraft, type InboxDraft, type InboxDraftMilestone, type InboxDraftTask } from "@/lib/inbox/analysis";

type Attachment = { file_name: string; mime_type: string; file_size_bytes: number };
type CommitResult = { kind?: string; project_id?: string; task_ids?: string[] };
const inputClass = "min-h-11 w-full rounded-xl border border-[#dfd0c2] bg-white px-3 text-sm text-[#2f241e] outline-none focus:ring-2 focus:ring-[#8f6447]/30";
const labelClass = "mb-1.5 block text-xs font-semibold text-[#705c4d]";
const kindLabels: Record<InboxDraft["kind"], string> = { note: "เก็บเป็นสรุป", task: "งานเดียว", project: "โปรเจกต์", event: "นัดหมายในปฏิทิน" };

export function InboxItemActions({ id, initialDraft, attachments, committed, initialClarificationResponse }: { id: string; initialDraft: unknown; attachments: Attachment[]; committed: unknown; initialClarificationResponse: string | null }) {
  const router = useRouter();
  const initial = parseInboxDraft(initialDraft);
  const [draft, setDraft] = useState<InboxDraft | null>(initial.data ?? null);
  const [commitResult, setCommitResult] = useState<CommitResult | null>(() => committed && typeof committed === "object" ? committed as CommitResult : null);
  const [working, setWorking] = useState<"analyze" | "save" | null>(null);
  const [notice, setNotice] = useState<{ error: boolean; message: string } | null>(null);
  const [clarificationAnswer, setClarificationAnswer] = useState(initialClarificationResponse ?? "");
  const validation = useMemo(() => draft ? parseInboxDraft(draft) : null, [draft]);

  useEffect(() => {
    setCommitResult(committed && typeof committed === "object" ? committed as CommitResult : null);
  }, [committed]);

  async function analyze(answer = "") {
    if (working) return;
    setWorking("analyze"); setNotice(null);
    try {
      const result = await analyzeInboxItem(id, answer);
      setNotice({ error: !result.ok, message: result.message });
      if (result.ok && result.data) { setDraft(result.data); setClarificationAnswer(""); }
      router.refresh();
    } catch { setNotice({ error: true, message: "วิเคราะห์ไม่สำเร็จ ข้อความยังอยู่ใน Inbox ลองใหม่ได้" }); }
    finally { setWorking(null); }
  }

  async function save() {
    if (!draft || !validation?.data || working) return;
    setWorking("save"); setNotice(null);
    try {
      const result = await commitInboxDraft(id, validation.data);
      setNotice({ error: !result.ok, message: result.message });
      if (result.ok && result.data) setCommitResult(result.data);
      if (result.ok) router.refresh();
    } catch { setNotice({ error: true, message: "บันทึกไม่สำเร็จ ร่างยังอยู่ใน Inbox ลองใหม่ได้" }); }
    finally { setWorking(null); }
  }

  function update(patch: Partial<InboxDraft>) { setDraft((current) => current ? { ...current, ...patch } : current); }
  function updateTask(index: number, patch: Partial<InboxDraftTask>) {
    setDraft((current) => current ? { ...current, tasks: current.tasks.map((task, i) => i === index ? { ...task, ...patch } : task) } : current);
  }
  function updateMilestone(index: number, patch: Partial<InboxDraftMilestone>) {
    setDraft((current) => current ? { ...current, milestones: current.milestones.map((item, i) => i === index ? { ...item, ...patch } : item) } : current);
  }

  if (commitResult) return <div className="mt-4 flex flex-wrap items-center gap-2 rounded-xl bg-[#e5eee6] p-3 text-sm text-[#385640]">
    <Check className="h-4 w-4 shrink-0" />
    <span>{commitResult.kind === "event" ? "เพิ่มใน Google Calendar แล้ว" : commitResult.kind === "project" ? "สร้างโปรเจกต์แล้ว" : commitResult.kind === "note" ? "เก็บเป็นสรุปแล้ว" : "สร้างงานแล้ว"}</span>
    {commitResult.project_id && <Link className="font-semibold underline underline-offset-2" href={`/protected/projects/${commitResult.project_id}`}>เปิดโปรเจกต์</Link>}
    {commitResult.task_ids?.length ? <Link className="font-semibold underline underline-offset-2" href="/protected/tasks">เปิดงาน ({commitResult.task_ids.length})</Link> : null}
    {commitResult.kind === "event" && <Link className="font-semibold underline underline-offset-2" href="/protected/calendar">เปิดปฏิทิน</Link>}
    {notice && <p role={notice.error ? "alert" : "status"} className={`mt-3 rounded-xl p-3 text-sm ${notice.error ? "bg-[#fde5dd] text-[#933f30]" : "bg-[#e5eee6] text-[#385640]"}`}>{notice.message}</p>}
  </div>;

  return <div className="mt-4 border-t border-[#eee4db] pt-4">
    {attachments.length > 0 && <div className="mb-3 flex flex-wrap gap-2">{attachments.map((attachment) => <span key={attachment.file_name} className="inline-flex max-w-full items-center gap-2 rounded-lg bg-[#f7f1e9] px-3 py-2 text-xs text-[#604a3b]"><FileText className="h-4 w-4 shrink-0" /><span className="max-w-[250px] truncate">{attachment.file_name}</span><span className="shrink-0 text-[#8c7a6a]">{(attachment.file_size_bytes / 1024 / 1024).toFixed(1)} MB</span></span>)}</div>}
    {!draft && <div className="flex flex-col gap-3 rounded-xl bg-[#f7f1e9] p-4 sm:flex-row sm:items-center sm:justify-between">
      <div><p className="text-sm font-semibold text-[#604a3b]">ยังไม่มีร่างวิเคราะห์</p><p className="mt-1 text-xs leading-5 text-[#705c4d]">ให้ AI ช่วยสรุปและแยกงานจากข้อความหรือไฟล์แนบ รายการจริงจะยังไม่ถูกสร้างจนกว่าคุณจะตรวจและยืนยัน</p></div>
      <button type="button" disabled={working !== null} onClick={() => analyze()} className="inline-flex min-h-11 shrink-0 items-center justify-center gap-2 rounded-xl bg-[#8f6447] px-4 text-sm font-semibold text-white disabled:opacity-50">{working === "analyze" ? <><LoaderCircle className="h-4 w-4 animate-spin" />กำลังวิเคราะห์…</> : <><Sparkles className="h-4 w-4" />วิเคราะห์ด้วย AI</>}</button>
    </div>}
    {draft && <div className="rounded-2xl border border-[#e8ddd2] bg-[#fffdfa] p-4 sm:p-5">
      <div className="flex flex-wrap items-start justify-between gap-3"><div><p className="text-xs font-bold tracking-wide text-[#8f6447]">ร่างจาก AI · ตรวจทานก่อนบันทึก</p><p className="mt-1 text-sm text-[#705c4d]">แก้รายละเอียดและวันที่ได้ รายการจริงจะถูกสร้างหลังจากกดยืนยัน</p></div><button type="button" disabled={working !== null} onClick={() => analyze()} className="inline-flex min-h-10 items-center gap-2 rounded-lg border border-[#dfd0c2] px-3 text-xs font-semibold text-[#604a3b] disabled:opacity-50"><Sparkles className="h-3.5 w-3.5" />วิเคราะห์ใหม่</button></div>
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <Field label="ประเภท"><select className={inputClass} value={draft.kind} onChange={(event) => update({ kind: event.target.value as InboxDraft["kind"] })}>{Object.entries(kindLabels).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></Field>
        <Field label="ความสำคัญ"><select className={inputClass} value={draft.priority} onChange={(event) => update({ priority: event.target.value as InboxDraft["priority"] })}><option value="high">สูง</option><option value="medium">ปานกลาง</option><option value="low">ต่ำ</option></select></Field>
        <Field label={draft.kind === "project" ? "ชื่อโปรเจกต์" : draft.kind === "event" ? "ชื่อนัดหมาย" : "ชื่อรายการ"} wide><input className={inputClass} maxLength={200} value={draft.title} onChange={(event) => update({ title: event.target.value })} /></Field>
        <Field label="สรุปสั้น ๆ" wide><textarea className={`${inputClass} min-h-20 py-2`} maxLength={2000} value={draft.summary} onChange={(event) => update({ summary: event.target.value })} /></Field>
        <Field label="รายละเอียด" wide><textarea className={`${inputClass} min-h-20 py-2`} maxLength={5000} value={draft.description} onChange={(event) => update({ description: event.target.value })} /></Field>
        {draft.kind === "project" && <Field label="เป้าหมาย" wide><textarea className={`${inputClass} min-h-16 py-2`} maxLength={1000} value={draft.goal} onChange={(event) => update({ goal: event.target.value })} /></Field>}
        {(draft.kind === "task" || draft.kind === "project") && <Field label={draft.kind === "project" ? "วันเป้าหมาย" : "กำหนดส่ง"}><input type="date" className={inputClass} value={draft.due_date ?? ""} onChange={(event) => update({ due_date: event.target.value || null })} /></Field>}
        {draft.kind === "task" && <Field label="เวลาที่คาดว่าจะใช้ (นาที)"><input type="number" min="0" step="5" className={inputClass} value={draft.estimated_minutes ?? ""} onChange={(event) => update({ estimated_minutes: event.target.value === "" ? null : Number(event.target.value) })} /></Field>}
        {draft.kind === "project" && <Field label="วันเริ่มต้น"><input type="date" className={inputClass} value={draft.start_date ?? ""} onChange={(event) => update({ start_date: event.target.value || null })} /></Field>}
        {draft.kind === "event" && <>
          <Field label="วันเริ่ม"><input type="date" className={inputClass} value={draft.start_date ?? ""} onChange={(event) => update({ start_date: event.target.value || null })} /></Field>
          <Field label="วันสุดท้าย (ถ้ามี)"><input type="date" className={inputClass} value={draft.end_date ?? ""} onChange={(event) => update({ end_date: event.target.value || null })} /></Field>
          <Field label="เวลาเริ่ม (ถ้ามี)"><input type="time" className={inputClass} value={draft.start_time ?? ""} onChange={(event) => update({ start_time: event.target.value || null })} /></Field>
          <Field label="เวลาสิ้นสุด (ถ้ามี)"><input type="time" className={inputClass} value={draft.end_time ?? ""} onChange={(event) => update({ end_time: event.target.value || null })} /></Field>
        </>}
      </div>
      {draft.clarification_question && <div className="mt-3 rounded-xl bg-[#fff2d7] p-3 text-sm text-[#785720]"><strong>AI ขอข้อมูลเพิ่ม:</strong> {draft.clarification_question}{initialClarificationResponse && <p className="mt-2 whitespace-pre-wrap rounded-lg bg-white/70 p-2 text-xs"><strong>ข้อมูลที่ตอบไว้:</strong> {initialClarificationResponse}</p>}<label className="mb-1.5 mt-3 block text-xs font-semibold" htmlFor={`clarification-${id}`}>ตอบเพิ่มได้ที่นี่ หรือแก้ข้อมูลในร่างด้านบน</label><textarea id={`clarification-${id}`} maxLength={2000} className={`${inputClass} min-h-16 py-2`} value={clarificationAnswer} onChange={(event) => setClarificationAnswer(event.target.value)} placeholder="พิมพ์ข้อมูลที่ต้องการให้ AI นำไปพิจารณา" /><button type="button" disabled={working !== null || !clarificationAnswer.trim()} onClick={() => analyze(clarificationAnswer)} className="mt-2 inline-flex min-h-10 items-center gap-2 rounded-lg bg-[#8f6447] px-3 text-xs font-semibold text-white disabled:opacity-50">{working === "analyze" ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}ส่งคำตอบให้ AI วิเคราะห์ต่อ</button></div>}
      {draft.kind === "project" && <ProjectDraftEditor draft={draft} update={update} updateTask={updateTask} updateMilestone={updateMilestone} />}
      <div className="mt-5 flex flex-col gap-2 border-t border-[#eee4db] pt-4 sm:flex-row sm:items-center sm:justify-between">
        {validation && !validation.data ? <p role="alert" className="text-xs text-[#a14435]">{validation.error}</p> : <p className="text-xs text-[#705c4d]">ข้อมูลจะถูกบันทึกหลังจากคุณยืนยันเท่านั้น{draft.kind === "event" ? " · ใช้เวลาไทย" : ""}</p>}
        <div className="flex flex-wrap gap-2 sm:justify-end"><button type="button" disabled={working !== null} onClick={() => analyze()} className="min-h-11 rounded-xl border border-[#dfd0c2] px-4 text-sm font-semibold text-[#604a3b] disabled:opacity-50">วิเคราะห์ใหม่</button><button type="button" disabled={working !== null || !validation?.data} onClick={save} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-[#8f6447] px-4 text-sm font-semibold text-white disabled:opacity-50">{working === "save" ? <><LoaderCircle className="h-4 w-4 animate-spin" />กำลังบันทึก…</> : <>{draft.kind === "event" ? <CalendarDays className="h-4 w-4" /> : <Check className="h-4 w-4" />}ยืนยันและบันทึก{draft.kind === "task" ? "งาน" : draft.kind === "project" ? "โปรเจกต์" : draft.kind === "event" ? "กิจกรรม" : "สรุป"}</>}</button></div>
      </div>
    </div>}
    {notice && <p role={notice.error ? "alert" : "status"} className={`mt-3 rounded-xl p-3 text-sm ${notice.error ? "bg-[#fde5dd] text-[#933f30]" : "bg-[#e5eee6] text-[#385640]"}`}>{notice.message}</p>}
  </div>;
}

function Field({ label, wide, children }: { label: string; wide?: boolean; children: ReactNode }) {
  return <div className={wide ? "sm:col-span-2" : ""}><label className={labelClass}>{label}</label>{children}</div>;
}

function ProjectDraftEditor({ draft, update, updateTask, updateMilestone }: {
  draft: InboxDraft;
  update: (patch: Partial<InboxDraft>) => void;
  updateTask: (index: number, patch: Partial<InboxDraftTask>) => void;
  updateMilestone: (index: number, patch: Partial<InboxDraftMilestone>) => void;
}) {
  return <div className="mt-5 space-y-5">
    <section>
      <div className="mb-2 flex items-center justify-between gap-3"><h3 className="text-sm font-bold">หมุดหมาย</h3><button type="button" disabled={draft.milestones.length >= 8} onClick={() => update({ milestones: [...draft.milestones, { name: "", description: "", due_date: null, priority: "medium" }] })} className="inline-flex min-h-9 items-center gap-1 rounded-lg border border-[#dfd0c2] px-3 text-xs font-semibold disabled:opacity-40"><Plus className="h-3.5 w-3.5" />เพิ่ม</button></div>
      {draft.milestones.map((milestone, index) => <div key={index} className="mb-2 grid gap-2 rounded-xl bg-[#f8f3ed] p-3 sm:grid-cols-[1fr_170px_40px]"><input aria-label={`ชื่อหมุดหมาย ${index + 1}`} className={inputClass} maxLength={200} value={milestone.name} onChange={(event) => updateMilestone(index, { name: event.target.value })} placeholder="ชื่อหมุดหมาย" /><input aria-label={`กำหนดหมุดหมาย ${index + 1}`} type="date" className={inputClass} value={milestone.due_date ?? ""} onChange={(event) => updateMilestone(index, { due_date: event.target.value || null })} /><button type="button" aria-label="ลบหมุดหมาย" onClick={() => update({ milestones: draft.milestones.filter((_, i) => i !== index), tasks: draft.tasks.map((task) => ({ ...task, milestone_index: task.milestone_index === index ? null : task.milestone_index !== null && task.milestone_index > index ? task.milestone_index - 1 : task.milestone_index })) })} className="inline-flex h-10 items-center justify-center rounded-lg text-[#a14435] hover:bg-[#f4e1dd]"><Trash2 className="h-4 w-4" /></button></div>)}
    </section>
    <section>
      <div className="mb-2 flex items-center justify-between gap-3"><h3 className="text-sm font-bold">งานย่อย</h3><button type="button" disabled={draft.tasks.length >= 12} onClick={() => update({ tasks: [...draft.tasks, { title: "", description: "", due_date: null, priority: "medium", estimated_minutes: null, milestone_index: null }] })} className="inline-flex min-h-9 items-center gap-1 rounded-lg border border-[#dfd0c2] px-3 text-xs font-semibold disabled:opacity-40"><Plus className="h-3.5 w-3.5" />เพิ่ม</button></div>
      {draft.tasks.map((task, index) => <div key={index} className="mb-2 grid gap-2 rounded-xl bg-[#f8f3ed] p-3 sm:grid-cols-[1fr_190px_40px]"><div><input aria-label={`ชื่องานย่อย ${index + 1}`} className={inputClass} maxLength={200} value={task.title} onChange={(event) => updateTask(index, { title: event.target.value })} placeholder="ชื่องานย่อย" /><textarea aria-label={`รายละเอียดงานย่อย ${index + 1}`} className={`${inputClass} mt-2 min-h-16 py-2`} maxLength={5000} value={task.description} onChange={(event) => updateTask(index, { description: event.target.value })} placeholder="รายละเอียดเพิ่มเติม (ถ้ามี)" /></div><div><label className={labelClass}>กำหนดส่ง</label><input aria-label={`กำหนดส่งงานย่อย ${index + 1}`} type="date" className={inputClass} value={task.due_date ?? ""} onChange={(event) => updateTask(index, { due_date: event.target.value || null })} /><label className={`${labelClass} mt-2`}>เวลาประมาณ (นาที)</label><input aria-label={`เวลาประมาณงานย่อย ${index + 1}`} type="number" min="0" step="5" className={inputClass} value={task.estimated_minutes ?? ""} onChange={(event) => updateTask(index, { estimated_minutes: event.target.value === "" ? null : Number(event.target.value) })} /><label className={`${labelClass} mt-2`}>ความสำคัญ</label><select aria-label={`ความสำคัญงานย่อย ${index + 1}`} className={inputClass} value={task.priority} onChange={(event) => updateTask(index, { priority: event.target.value as InboxDraftTask["priority"] })}><option value="high">สูง</option><option value="medium">ปานกลาง</option><option value="low">ต่ำ</option></select><label className={`${labelClass} mt-2`}>หมุดหมาย</label><select aria-label={`หมุดหมายของงานย่อย ${index + 1}`} className={inputClass} value={task.milestone_index ?? ""} onChange={(event) => updateTask(index, { milestone_index: event.target.value === "" ? null : Number(event.target.value) })}><option value="">ไม่ผูกหมุดหมาย</option>{draft.milestones.map((milestone, milestoneIndex) => <option key={milestoneIndex} value={milestoneIndex}>{milestone.name || `หมุดหมาย ${milestoneIndex + 1}`}</option>)}</select></div><button type="button" aria-label="ลบงานย่อย" onClick={() => update({ tasks: draft.tasks.filter((_, i) => i !== index) })} className="inline-flex h-10 items-center justify-center rounded-lg text-[#a14435] hover:bg-[#f4e1dd]"><Trash2 className="h-4 w-4" /></button></div>)}
    </section>
  </div>;
}
