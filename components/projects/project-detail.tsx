"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useRef, useState, useTransition, type FormEvent } from "react";
import { ArrowLeft, CalendarDays, Check, Pencil, Plus, RotateCcw, Trash2 } from "lucide-react";
import { changeProjectStatus, deleteProject, saveMilestone } from "@/app/protected/projects/actions";
import { DeleteConfirmation } from "@/components/delete-confirmation";
import { ProjectEditor } from "./project-editor";
import { priorityLabels, riskLabels, statusLabels, type LinkedTask, type Milestone, type Project } from "@/lib/projects/types";
const field = "min-h-12 w-full rounded-xl border border-[#dfd0c2] bg-white px-3 text-base text-[#2f241e] outline-none focus:ring-2 focus:ring-[#8f6447]/40";
const milestoneLabels: Record<string, string> = { not_started: "ยังไม่เริ่ม", in_progress: "กำลังทำ", waiting: "รอ", done: "เสร็จแล้ว", cancelled: "ยกเลิก" };
function dateLabel(value: string) { return new Intl.DateTimeFormat("th-TH", { day: "numeric", month: "short", year: "numeric" }).format(new Date(`${value}T12:00:00`)); }
export function ProjectDetail({ project, milestones, tasks, error }: { project: Project | null; milestones: Milestone[]; tasks: LinkedTask[]; error: string | null }) {
  const router = useRouter();
  const [editProject, setEditProject] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [deleteError, setDeleteError] = useState("");
  const [deletePending, startDeleteTransition] = useTransition();
  const deleteLock = useRef(false);
  const [editMilestone, setEditMilestone] = useState<Milestone | null | undefined>(undefined);
  const [notice, setNotice] = useState<{ error: boolean; message: string } | null>(null);
  const [pending, startTransition] = useTransition();
  if (!project) return <div role="alert" className="mx-auto max-w-4xl p-6 text-base">{error ?? "ไม่พบโปรเจกต์"}</div>;
  function statusChange() {
    if (!project) return;
    startTransition(async () => {
      const result = await changeProjectStatus(project.id, project.status === "completed" ? "active" : "completed", project.updated_at);
      setNotice({ error: !result.ok, message: result.message });
      if (result.ok) router.refresh();
    });
  }
  function confirmDelete() {
    if (!project || deleteLock.current) return;
    deleteLock.current = true;
    setDeleteError("");
    startDeleteTransition(async () => {
      try {
        const result = await deleteProject(project.id, project.updated_at);
        if (result.ok) {
          setConfirmingDelete(false);
          router.replace("/protected/projects");
          router.refresh();
        } else setDeleteError(result.message);
      } catch { setDeleteError("เชื่อมต่อไม่สำเร็จ กรุณาลองอีกครั้ง"); }
      finally { deleteLock.current = false; }
    });
  }
  function milestoneSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    startTransition(async () => {
      const result = await saveMilestone(form);
      setNotice({ error: !result.ok, message: result.message });
      if (result.ok) { setEditMilestone(undefined); router.refresh(); }
    });
  }
  return <div className="mx-auto w-full max-w-[1160px] px-4 py-5 sm:px-6 lg:px-8 xl:py-8">
    <Link href="/protected/projects" className="mb-5 inline-flex min-h-11 items-center gap-2 text-sm font-semibold text-[#8f6447]"><ArrowLeft className="h-4 w-4" />โปรเจกต์ทั้งหมด</Link>
    <div className="mb-6 rounded-[24px] border border-[#e8ddd2] bg-[#fffdfa] p-5 sm:p-7 premium-shadow"><div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between"><div className="min-w-0"><p className="text-sm font-semibold tracking-wider text-[#8f6447]">PROJECT</p><h1 className="mt-2 break-words text-3xl font-bold tracking-tight sm:text-4xl">{project.name}</h1><div className="mt-4 flex flex-wrap gap-2 text-sm"><span className="rounded-full bg-[#f4eadf] px-3 py-1 font-semibold text-[#8f6447]">{statusLabels[project.status]}</span><span className="rounded-full bg-[#f7f1e9] px-3 py-1">สำคัญ{priorityLabels[project.priority]}</span><span className="rounded-full bg-[#f7f1e9] px-3 py-1">ความเสี่ยง: {riskLabels[project.risk_level]}</span></div></div><div className="flex flex-wrap gap-2"><button type="button" disabled={pending || deletePending} onClick={() => setEditProject(true)} className="inline-flex min-h-12 items-center gap-2 rounded-xl border border-[#dfd0c2] px-4 text-sm font-semibold disabled:opacity-50"><Pencil className="h-4 w-4" />แก้ไข</button><button type="button" disabled={pending || deletePending} onClick={statusChange} className="inline-flex min-h-12 items-center gap-2 rounded-xl bg-[#8f6447] px-4 text-sm font-semibold text-white disabled:opacity-50">{project.status === "completed" ? <RotateCcw className="h-4 w-4" /> : <Check className="h-4 w-4" />}{project.status === "completed" ? "เปิดอีกครั้ง" : "ปิดโปรเจกต์"}</button><button type="button" disabled={pending || deletePending} onClick={() => { setDeleteError(""); setConfirmingDelete(true); }} className="inline-flex min-h-12 items-center gap-2 rounded-xl border border-[#edcbbf] px-4 text-sm font-semibold text-[#933f30] hover:bg-[#fde5dd] disabled:opacity-50"><Trash2 className="h-4 w-4" />ลบโปรเจกต์</button></div></div>
      {project.goal && <div className="mt-6"><h2 className="text-sm font-bold text-[#705c4d]">เป้าหมาย</h2><p className="mt-2 whitespace-pre-wrap break-words text-base leading-7">{project.goal}</p></div>}{project.description && <p className="mt-4 whitespace-pre-wrap break-words text-sm leading-6 text-[#705c4d]">{project.description}</p>}
      <div className="mt-6 grid gap-4 border-t border-[#eee4db] pt-5 sm:grid-cols-2"><div><div className="flex justify-between text-sm"><span className="font-semibold text-[#705c4d]">ความคืบหน้า</span><span className="font-bold">{project.progress_percent}%</span></div><div role="progressbar" aria-label="ความคืบหน้าโปรเจกต์" aria-valuenow={project.progress_percent} aria-valuemin={0} aria-valuemax={100} className="mt-2 h-2 rounded-full bg-[#eadfd4]"><div className="h-full rounded-full bg-[#8f6447]" style={{ width: `${project.progress_percent}%` }} /></div></div><div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-[#705c4d]"><span className="inline-flex items-center gap-2"><CalendarDays className="h-4 w-4" />เริ่ม {project.start_date ? dateLabel(project.start_date) : "ยังไม่กำหนด"}</span><span>เป้าหมาย {project.target_date ? dateLabel(project.target_date) : "ยังไม่กำหนด"}</span></div></div></div>
    {notice && <p role={notice.error ? "alert" : "status"} className={`mb-5 rounded-xl p-4 text-sm ${notice.error ? "bg-[#fde5dd] text-[#933f30]" : "bg-[#e5eee6] text-[#385640]"}`}>{notice.message}</p>}
    {error && <p role="alert" className="mb-5 rounded-xl bg-[#fde5dd] p-4 text-sm text-[#933f30]">{error}</p>}
    <div className="grid gap-5 lg:grid-cols-2"><section className="rounded-[24px] border border-[#e8ddd2] bg-[#fffdfa] p-5"><div className="flex items-center justify-between gap-3"><div><h2 className="text-xl font-bold">Milestones</h2><p className="mt-1 text-sm text-[#705c4d]">{milestones.length} ขั้นสำคัญ</p></div><button type="button" onClick={() => setEditMilestone(null)} className="inline-flex min-h-12 items-center gap-1 rounded-xl bg-[#f4eadf] px-3 text-sm font-semibold text-[#8f6447]"><Plus className="h-4 w-4" />เพิ่ม</button></div>
      {editMilestone !== undefined && <form key={editMilestone?.id ?? "new"} onSubmit={milestoneSubmit} className="mt-5 space-y-4 rounded-xl bg-[#f7f1e9] p-4"><h3 className="font-bold">{editMilestone ? "แก้ไข Milestone" : "เพิ่ม Milestone"}</h3><input type="hidden" name="project_id" value={project.id} /><input type="hidden" name="id" value={editMilestone?.id ?? ""} /><input type="hidden" name="updated_at" value={editMilestone?.updated_at ?? ""} /><div><label htmlFor="milestone-name" className="mb-2 block text-sm font-semibold">ชื่อ *</label><input id="milestone-name" name="name" required maxLength={200} defaultValue={editMilestone?.name ?? ""} className={field} /></div><div><label htmlFor="milestone-description" className="mb-2 block text-sm font-semibold">รายละเอียด</label><textarea id="milestone-description" name="description" rows={2} maxLength={5000} defaultValue={editMilestone?.description ?? ""} className={`${field} py-3`} /></div><div className="grid gap-3 sm:grid-cols-2"><div><label htmlFor="milestone-status" className="mb-2 block text-sm font-semibold">สถานะ</label><select id="milestone-status" name="status" defaultValue={editMilestone?.status ?? "not_started"} className={field}>{Object.entries(milestoneLabels).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></div><div><label htmlFor="milestone-progress" className="mb-2 block text-sm font-semibold">ความคืบหน้า (%)</label><input id="milestone-progress" type="number" inputMode="numeric" min={0} max={100} step={1} required name="progress_percent" defaultValue={editMilestone?.progress_percent ?? 0} className={field} /></div><div><label htmlFor="milestone-due" className="mb-2 block text-sm font-semibold">วันครบกำหนด</label><input id="milestone-due" type="date" name="due_date" defaultValue={editMilestone?.due_date ?? ""} className={field} /></div></div><div className="flex flex-wrap gap-2"><button type="submit" disabled={pending} className="min-h-12 rounded-xl bg-[#8f6447] px-5 text-sm font-semibold text-white disabled:opacity-50">บันทึก</button><button type="button" disabled={pending} onClick={() => setEditMilestone(undefined)} className="min-h-12 rounded-xl border border-[#dfd0c2] px-5 text-sm font-semibold">ยกเลิก</button></div></form>}
      {milestones.length === 0 ? <p className="mt-6 text-base text-[#705c4d]">ยังไม่มี Milestone เริ่มเพิ่มขั้นสำคัญของโปรเจกต์</p> : <ul className="mt-5 divide-y divide-[#eee4db]">{milestones.map((item) => <li key={item.id} className="py-4"><div className="flex items-start justify-between gap-2"><div className="min-w-0"><p className="break-words text-base font-semibold">{item.name}</p><p className="mt-1 text-sm text-[#705c4d]">{milestoneLabels[item.status] ?? item.status} · {item.progress_percent}%{item.due_date ? ` · ${dateLabel(item.due_date)}` : ""}</p>{item.description && <p className="mt-2 whitespace-pre-wrap break-words text-sm text-[#705c4d]">{item.description}</p>}</div><button type="button" onClick={() => setEditMilestone(item)} aria-label={`แก้ไข Milestone: ${item.name}`} className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-[#8f6447] hover:bg-[#f4eadf]"><Pencil className="h-4 w-4" /></button></div></li>)}</ul>}</section>
      <section className="rounded-[24px] border border-[#e8ddd2] bg-[#fffdfa] p-5"><div className="flex flex-wrap items-center justify-between gap-3"><div><h2 className="text-xl font-bold">งานในโปรเจกต์</h2><p className="mt-1 text-sm text-[#705c4d]">แสดง {tasks.length} งานล่าสุด</p></div><Link href={`/protected/tasks?project=${project.id}`} className="inline-flex min-h-12 items-center rounded-xl bg-[#f4eadf] px-3 text-sm font-semibold text-[#8f6447]">ดูในหน้า Tasks</Link></div>{tasks.length === 0 ? <p className="mt-6 text-base text-[#705c4d]">ยังไม่มีงานที่เชื่อมกับโปรเจกต์นี้ เพิ่มงานจากหน้า Tasks แล้วเลือกโปรเจกต์นี้</p> : <ul className="mt-5 divide-y divide-[#eee4db]">{tasks.map((task) => <li key={task.id} className="py-4"><p className="break-words text-base font-semibold">{task.title}</p><p className="mt-1 text-sm text-[#705c4d]">{task.status === "done" ? "เสร็จแล้ว" : "ยังไม่เสร็จ"}{task.due_date ? ` · ${dateLabel(task.due_date)}` : ""}</p></li>)}</ul>}</section></div>
    {editProject && <ProjectEditor project={project} onClose={() => setEditProject(false)} onSaved={(message) => { setEditProject(false); setNotice({ error: false, message }); router.refresh(); }} />}
    {confirmingDelete && <DeleteConfirmation title={`ลบโปรเจกต์ “${project.name}”?`} description="โปรเจกต์และ Milestones ในโปรเจกต์จะถูกลบถาวร งานที่เคยเชื่อมไว้ยังอยู่ แต่จะไม่มีโปรเจกต์กำกับ การดำเนินการนี้ย้อนกลับไม่ได้" pending={deletePending} error={deleteError} onConfirm={confirmDelete} onClose={() => { setConfirmingDelete(false); setDeleteError(""); }} />}
  </div>;
}
