"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useRef, useState, useTransition, type FormEvent } from "react";
import { ArrowUpRight, CalendarDays, FolderKanban, Pencil, Plus, RotateCcw, Search, Trash2 } from "lucide-react";
import { deleteProject } from "@/app/protected/projects/actions";
import { DeleteConfirmation } from "@/components/delete-confirmation";
import { ProjectEditor } from "./project-editor";
import { parseProjectFilters, projectQuery } from "@/lib/projects/validation";
import { priorityLabels, projectPageSize, projectStatuses, riskLabels, statusLabels, type Project, type ProjectFilters } from "@/lib/projects/types";
const field = "min-h-12 w-full rounded-xl border border-[#dfd0c2] bg-white px-3 text-base text-[#2f241e] outline-none focus:ring-2 focus:ring-[#8f6447]/40";
function dateLabel(value: string) { return new Intl.DateTimeFormat("th-TH", { day: "numeric", month: "short", year: "numeric" }).format(new Date(`${value}T12:00:00`)); }
export function ProjectsWorkspace({ projects, count, active, completed, overdue, error, filters }: { projects: Project[]; count: number; active: number; completed: number; overdue: number; error: string | null; filters: ProjectFilters }) {
  const router = useRouter();
  const [editor, setEditor] = useState<Project | null | undefined>(undefined);
  const [deleteTarget, setDeleteTarget] = useState<Project | null>(null);
  const [deleteError, setDeleteError] = useState("");
  const [deletePending, startDeleteTransition] = useTransition();
  const deleteLock = useRef(false);
  const [notice, setNotice] = useState("");
  const [pending, startTransition] = useTransition();
  const filtered = Boolean(filters.search || filters.status !== "all");
  const totalPages = Math.max(1, Math.ceil(count / projectPageSize));
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); const form = new FormData(event.currentTarget);
    const params = Object.fromEntries(form.entries()) as Record<string, string>;
    startTransition(() => router.push(projectQuery(parseProjectFilters(params))));
  }
  function confirmDelete() {
    if (!deleteTarget || deleteLock.current) return;
    deleteLock.current = true;
    setDeleteError("");
    startDeleteTransition(async () => {
      try {
        const result = await deleteProject(deleteTarget.id, deleteTarget.updated_at);
        if (result.ok) {
          setDeleteTarget(null);
          setNotice(result.message);
          router.refresh();
        } else setDeleteError(result.message);
      } catch { setDeleteError("เชื่อมต่อไม่สำเร็จ กรุณาลองอีกครั้ง"); }
      finally { deleteLock.current = false; }
    });
  }
  return <div className="mx-auto w-full max-w-[1320px] px-4 py-5 sm:px-6 lg:px-8 xl:py-8">
    <div className="mb-7 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between"><div><p className="text-sm font-semibold tracking-wider text-[#8f6447]">PROJECTS</p><h1 className="mt-2 text-3xl font-bold tracking-tight sm:text-4xl">โปรเจกต์</h1><p className="mt-2 text-base text-[#705c4d]">กำหนดเป้าหมาย ติดตามความคืบหน้า และเชื่อมงานเข้าด้วยกัน</p></div><button type="button" disabled={Boolean(error)} onClick={() => { setNotice(""); setEditor(null); }} className="inline-flex min-h-12 w-fit items-center gap-2 rounded-xl bg-[#8f6447] px-5 text-base font-semibold text-white disabled:opacity-50"><Plus className="h-5 w-5" />สร้างโปรเจกต์</button></div>
    {notice && <p role="status" className="mb-5 rounded-xl bg-[#e5eee6] p-4 text-sm text-[#385640]">{notice}</p>}
    {error ? <section role="alert" className="rounded-[24px] border border-[#e8ddd2] bg-[#fffdfa] p-6"><h2 className="text-lg font-bold">ยังโหลดโปรเจกต์ไม่ได้</h2><p className="mt-2 text-base text-[#705c4d]">{error}</p><button type="button" onClick={() => router.refresh()} className="mt-4 min-h-12 rounded-xl bg-[#8f6447] px-5 font-semibold text-white">ลองอีกครั้ง</button></section> : <>
      <div className="mb-6 grid gap-3 sm:grid-cols-3"><Summary label="กำลังดำเนินการ" value={active} /><Summary label="เลยวันเป้าหมาย" value={overdue} /><Summary label="เสร็จแล้ว" value={completed} /></div>
      <form key={projectQuery(filters)} onSubmit={submit} aria-label="ค้นหาและกรองโปรเจกต์" className="mb-6 flex flex-col gap-3 rounded-[24px] border border-[#e8ddd2] bg-[#fffdfa] p-4 sm:flex-row sm:items-end sm:p-5"><div className="min-w-0 flex-1"><label htmlFor="project-search" className="mb-2 block text-sm font-semibold">ค้นหาชื่อโปรเจกต์</label><div className="relative"><Search className="pointer-events-none absolute left-3 top-3.5 h-5 w-5 text-[#8c7564]" /><input id="project-search" name="search" type="search" maxLength={200} defaultValue={filters.search} className={`${field} pl-10`} placeholder="พิมพ์ชื่อโปรเจกต์" /></div></div><div className="sm:w-52"><label htmlFor="project-status" className="mb-2 block text-sm font-semibold">สถานะ</label><select id="project-status" name="status" defaultValue={filters.status} className={field}><option value="all">ทุกสถานะ</option>{projectStatuses.map((value) => <option key={value} value={value}>{statusLabels[value]}</option>)}</select></div><button type="submit" disabled={pending} className="min-h-12 rounded-xl bg-[#f4eadf] px-5 text-sm font-semibold text-[#604a3b]">ค้นหา</button>{filtered && <Link href="/protected/projects" className="inline-flex min-h-12 items-center gap-2 rounded-xl px-3 text-sm font-semibold text-[#705c4d]"><RotateCcw className="h-4 w-4" />ล้างตัวกรอง</Link>}</form>
      <div className="mb-4 flex items-center justify-between"><h2 className="text-lg font-bold">{filtered ? "ผลการค้นหา" : "โปรเจกต์ทั้งหมด"}</h2><span className="text-sm text-[#705c4d]">{count.toLocaleString("th-TH")} โปรเจกต์</span></div>
      {projects.length === 0 ? <section className="rounded-[24px] border border-[#e8ddd2] bg-[#fffdfa] px-5 py-12 text-center"><FolderKanban className="mx-auto h-10 w-10 text-[#8f6447]" /><h3 className="mt-4 text-lg font-bold">{filtered ? "ไม่พบโปรเจกต์ตามเงื่อนไข" : "เริ่มสร้างโปรเจกต์แรกของคุณ"}</h3><p className="mt-2 text-base text-[#705c4d]">{filtered ? "ลองเปลี่ยนคำค้นหาหรือล้างตัวกรอง" : "เพิ่มเป้าหมายและวันส่ง แล้วค่อยเชื่อมงานจากหน้า Tasks"}</p></section> : <div className="grid gap-4 md:grid-cols-2">{projects.map((project) => <article key={project.id} className="flex min-w-0 flex-col rounded-[24px] border border-[#e8ddd2] bg-[#fffdfa] p-5 premium-shadow"><div className="flex flex-wrap items-start justify-between gap-3"><div className="min-w-0 flex-1"><div className="flex flex-wrap gap-2 text-sm"><span className="rounded-full bg-[#f4eadf] px-3 py-1 font-semibold text-[#8f6447]">{statusLabels[project.status]}</span><span className="rounded-full bg-[#f7f1e9] px-3 py-1 text-[#705c4d]">สำคัญ{priorityLabels[project.priority]}</span><span className="rounded-full bg-[#f7f1e9] px-3 py-1 text-[#705c4d]">{riskLabels[project.risk_level]}</span></div><h3 className="mt-3 break-words text-xl font-bold leading-7">{project.name}</h3>{project.goal && <p className="mt-2 line-clamp-2 whitespace-pre-wrap break-words text-sm leading-6 text-[#705c4d]">{project.goal}</p>}</div><div className="flex shrink-0"><button type="button" disabled={deletePending} onClick={() => { setNotice(""); setEditor(project); }} aria-label={`แก้ไข: ${project.name}`} className="flex h-12 w-12 items-center justify-center rounded-xl text-[#8f6447] hover:bg-[#f4eadf] disabled:opacity-50"><Pencil className="h-5 w-5" /></button><button type="button" disabled={deletePending} onClick={() => { setDeleteError(""); setDeleteTarget(project); }} aria-label={`ลบโปรเจกต์: ${project.name}`} className="flex h-12 w-12 items-center justify-center rounded-xl text-[#933f30] hover:bg-[#fde5dd] disabled:opacity-50"><Trash2 className="h-5 w-5" /></button></div></div><div className="mt-auto pt-6"><div className="mb-2 flex justify-between text-sm"><span className="font-semibold text-[#705c4d]">ความคืบหน้า</span><span className="font-bold">{project.progress_percent}%</span></div><div role="progressbar" aria-label={`ความคืบหน้า ${project.name}`} aria-valuenow={project.progress_percent} aria-valuemin={0} aria-valuemax={100} className="h-2 overflow-hidden rounded-full bg-[#eadfd4]"><div className="h-full rounded-full bg-[#8f6447]" style={{ width: `${project.progress_percent}%` }} /></div><div className="mt-5 flex flex-wrap items-center justify-between gap-2 border-t border-[#eee4db] pt-4 text-sm"><span className="inline-flex items-center gap-2 text-[#705c4d]"><CalendarDays className="h-4 w-4" />{project.target_date ? `เป้าหมาย ${dateLabel(project.target_date)}` : "ยังไม่กำหนดวันเป้าหมาย"}</span><Link href={`/protected/projects/view?id=${encodeURIComponent(project.id)}`} className="inline-flex min-h-11 items-center gap-1 font-semibold text-[#8f6447]">เปิดโปรเจกต์<ArrowUpRight className="h-4 w-4" /></Link></div></div></article>)}</div>}
      {totalPages > 1 && <nav aria-label="หน้ารายการโปรเจกต์" className="mt-5 flex items-center justify-between gap-3 text-sm">{filters.page > 1 ? <Link href={projectQuery(filters, filters.page - 1)} className="inline-flex min-h-12 items-center rounded-xl border border-[#dfd0c2] bg-white px-4">ก่อนหน้า</Link> : <span />}<span>หน้า {filters.page} จาก {totalPages}</span>{filters.page < totalPages ? <Link href={projectQuery(filters, filters.page + 1)} className="inline-flex min-h-12 items-center rounded-xl border border-[#dfd0c2] bg-white px-4">ถัดไป</Link> : <span />}</nav>}
    </>}
    {editor !== undefined && <ProjectEditor project={editor} onClose={() => setEditor(undefined)} onSaved={(message) => { setEditor(undefined); setNotice(message); router.refresh(); }} />}
    {deleteTarget && <DeleteConfirmation title={`ลบโปรเจกต์ “${deleteTarget.name}”?`} description="โปรเจกต์และ Milestones ในโปรเจกต์จะถูกลบถาวร งานที่เคยเชื่อมไว้ยังอยู่ แต่จะไม่มีโปรเจกต์กำกับ การดำเนินการนี้ย้อนกลับไม่ได้" pending={deletePending} error={deleteError} onConfirm={confirmDelete} onClose={() => { setDeleteTarget(null); setDeleteError(""); }} />}
  </div>;
}
function Summary({ label, value }: { label: string; value: number }) { return <div className="rounded-2xl border border-[#e8ddd2] bg-[#fffdfa] p-4"><p className="text-sm font-semibold text-[#705c4d]">{label}</p><p className="mt-2 text-3xl font-bold text-[#2f241e]">{value.toLocaleString("th-TH")}</p></div>; }
