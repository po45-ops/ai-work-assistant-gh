"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useRef, useState, useTransition, type FormEvent } from "react";
import { CalendarDays, Check, CheckSquare2, Clock3, FolderKanban, LoaderCircle, Pencil, Plus, RotateCcw, Search, SlidersHorizontal, Trash2 } from "lucide-react";
import { changeTaskStatus, deleteTask } from "@/app/protected/tasks/actions";
import { DeleteConfirmation } from "@/components/delete-confirmation";
import { TaskEditor } from "./task-editor";
import { parseTaskFilters, taskQuery } from "@/lib/tasks/validation";
import { pageSize, statusLabels, priorityLabels, taskStatuses, taskPriorities, type Task, type ProjectOption, type TaskFilters } from "@/lib/tasks/types";
const fieldClass = "min-h-12 min-w-0 w-full rounded-xl border border-[#dfd0c2] bg-white px-3 text-base text-[#2f241e] outline-none focus:ring-2 focus:ring-[#8f6447]/40";
function dateLabel(date: string) {
  return new Intl.DateTimeFormat("th-TH", { day: "numeric", month: "short", year: "numeric" }).format(new Date(`${date}T12:00:00`));
}
function minutesLabel(minutes: number) {
  const hours = Math.floor(minutes / 60); const rest = minutes % 60;
  return hours ? `${hours} ชม.${rest ? ` ${rest} นาที` : ""}` : `${minutes} นาที`;
}
export function TasksWorkspace({ tasks, projects, count, today, error, filters }: { tasks: Task[]; projects: ProjectOption[]; count: number; today: string; error: string | null; filters: TaskFilters }) {
  const router = useRouter();
  const [editor, setEditor] = useState<{ task: Task | null } | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Task | null>(null);
  const [deleteError, setDeleteError] = useState("");
  const [deletePending, startDeleteTransition] = useTransition();
  const deleteLock = useRef(false);
  const [notice, setNotice] = useState<{ error: boolean; message: string } | null>(null);
  const [pending, startTransition] = useTransition();
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [showFilters, setShowFilters] = useState(false);
  const mutationLock = useRef(false);
  function filterSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const params: Record<string, string> = {};
    for (const [key, value] of form.entries()) if (typeof value === "string") params[key] = value;
    startTransition(() => router.push(taskQuery(parseTaskFilters(params))));
  }
  function toggleComplete(task: Task) {
    if (mutationLock.current) return;
    mutationLock.current = true; setPendingId(task.id); setNotice(null);
    startTransition(async () => {
      try {
        const result = await changeTaskStatus(task.id, task.status === "done" ? "not_started" : "done", task.updated_at);
        setNotice({ error: !result.ok, message: result.message });
        if (result.ok) router.refresh();
      } catch { setNotice({ error: true, message: "เชื่อมต่อไม่สำเร็จ กรุณาลองอีกครั้ง" }); }
      finally { mutationLock.current = false; setPendingId(null); }
    });
  }
  function confirmDelete() {
    if (!deleteTarget || deleteLock.current) return;
    deleteLock.current = true;
    setDeleteError("");
    startDeleteTransition(async () => {
      try {
        const result = await deleteTask(deleteTarget.id, deleteTarget.updated_at);
        if (result.ok) {
          setDeleteTarget(null);
          setNotice({ error: false, message: result.message });
          router.refresh();
        } else setDeleteError(result.message);
      } catch { setDeleteError("เชื่อมต่อไม่สำเร็จ กรุณาลองอีกครั้ง"); }
      finally { deleteLock.current = false; }
    });
  }
  const projectNames = new Map(projects.map((project) => [project.id, project.name]));
  const totalPages = Math.max(1, Math.ceil(count / pageSize));
  const hasFilters = Boolean(filters.search || filters.status !== "all" || filters.priority !== "all" || filters.project || filters.due !== "all");
  return <div className="mx-auto w-full max-w-[1320px] px-4 py-5 sm:px-6 lg:px-8 xl:py-8">
    <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div><p className="text-sm font-semibold tracking-wider text-[#8f6447]">TASKS</p><h1 className="mt-2 text-3xl font-bold tracking-tight sm:text-4xl">งานของฉัน</h1><p className="mt-2 text-base text-[#705c4d]">งานและโปรเจกต์ของคุณในที่เดียว</p></div>
      <button type="button" onClick={() => { setNotice(null); setEditor({ task: null }); }} disabled={Boolean(error) || pending} className="inline-flex min-h-12 w-fit items-center gap-2 rounded-xl bg-[#8f6447] px-5 text-base font-semibold text-white disabled:opacity-50"><Plus className="h-5 w-5" />เพิ่มงาน</button>
    </div>
    {notice && <div role={notice.error ? "alert" : "status"} className={`mb-5 flex items-center justify-between gap-3 rounded-xl p-4 text-sm ${notice.error ? "bg-[#fde5dd] text-[#933f30]" : "bg-[#e5eee6] text-[#385640]"}`}><p>{notice.message}</p>{notice.error && <button onClick={() => router.refresh()} className="min-h-11 shrink-0 rounded-lg px-3 font-bold underline">โหลดใหม่</button>}</div>}
    {error ? <section role="alert" className="rounded-[24px] border border-[#e8ddd2] bg-[#fffdfa] p-6"><h2 className="text-lg font-bold">ยังโหลดข้อมูลงานไม่ได้</h2><p className="mt-2 text-base text-[#705c4d]">{error}</p><button onClick={() => router.refresh()} className="mt-4 min-h-12 rounded-xl bg-[#8f6447] px-5 font-semibold text-white">ลองอีกครั้ง</button></section> : <>
      <form key={taskQuery(filters)} onSubmit={filterSubmit} aria-label="ค้นหาและกรองงาน" className="mb-5 space-y-4 rounded-[24px] border border-[#e8ddd2] bg-[#fffdfa] p-4 sm:p-5">
        <div><label htmlFor="task-search" className="mb-2 block text-sm font-semibold">ค้นหาชื่องาน</label><div className="relative"><Search className="pointer-events-none absolute left-3 top-3.5 h-5 w-5 text-[#8c7564]" /><input id="task-search" name="search" type="search" maxLength={200} defaultValue={filters.search} className={`${fieldClass} pl-10`} placeholder="พิมพ์ชื่องานที่ต้องการค้นหา" /></div></div>
        <div id="task-filter-options" className={`${showFilters ? "grid" : "hidden lg:grid"} gap-3 sm:grid-cols-2 lg:grid-cols-4`}>
          <div><label htmlFor="task-status" className="mb-2 block text-sm font-semibold">สถานะ</label><select id="task-status" name="status" defaultValue={filters.status} className={fieldClass}><option value="all">ทุกสถานะ</option>{taskStatuses.map((status) => <option key={status} value={status}>{statusLabels[status]}</option>)}</select></div>
          <div><label htmlFor="task-priority" className="mb-2 block text-sm font-semibold">ความสำคัญ</label><select id="task-priority" name="priority" defaultValue={filters.priority} className={fieldClass}><option value="all">ทุกระดับ</option>{taskPriorities.map((priority) => <option key={priority} value={priority}>{priorityLabels[priority]}</option>)}</select></div>
          <div><label htmlFor="task-project" className="mb-2 block text-sm font-semibold">โปรเจกต์</label><select id="task-project" name="project" defaultValue={filters.project} className={fieldClass}><option value="">ทุกโปรเจกต์</option>{projects.map((project) => <option key={project.id} value={project.id}>{project.name}</option>)}</select></div>
          <div><label htmlFor="task-due" className="mb-2 block text-sm font-semibold">กำหนดส่ง</label><select id="task-due" name="due" defaultValue={filters.due} className={fieldClass}><option value="all">ทุกวัน</option><option value="today">วันนี้ (เวลาไทย)</option><option value="overdue">เลยกำหนดและยังไม่เสร็จ</option></select></div>
        </div>
        <div className="flex flex-wrap items-center gap-2"><button type="button" aria-expanded={showFilters} aria-controls="task-filter-options" onClick={() => setShowFilters(!showFilters)} className="inline-flex min-h-12 items-center gap-2 rounded-xl border border-[#dfd0c2] px-3 text-sm font-semibold lg:hidden"><SlidersHorizontal className="h-4 w-4" />{showFilters ? "ซ่อนตัวกรอง" : "ตัวกรอง"}</button><button type="submit" disabled={pending} className="inline-flex min-h-12 items-center gap-2 rounded-xl bg-[#f4eadf] px-4 font-semibold text-[#604a3b] disabled:opacity-50">{pending && <LoaderCircle className="h-4 w-4 animate-spin" />}ค้นหางาน</button>{hasFilters && <Link href="/protected/tasks" className="inline-flex min-h-12 items-center gap-2 rounded-xl px-3 text-sm font-semibold text-[#705c4d]"><RotateCcw className="h-4 w-4" />ล้างตัวกรอง</Link>}</div>
      </form>
      <section aria-label="รายการงาน" aria-busy={pending} className="overflow-hidden rounded-[24px] border border-[#e8ddd2] bg-[#fffdfa] premium-shadow">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#e8ddd2] px-4 py-4 sm:px-5"><h2 className="text-lg font-bold">{hasFilters ? "ผลการค้นหา" : "งานทั้งหมด"}</h2><span className="text-sm text-[#705c4d]">{count.toLocaleString("th-TH")} งาน</span></div>
        {tasks.length === 0 ? <div className="px-5 py-12 text-center"><CheckSquare2 className="mx-auto h-10 w-10 text-[#8f6447]" /><h3 className="mt-4 text-lg font-bold">{hasFilters ? "ไม่พบงานตามเงื่อนไข" : "เริ่มต้นงานแรกของคุณ"}</h3><p className="mt-2 text-base text-[#705c4d]">{hasFilters ? "ลองเปลี่ยนคำค้นหาหรือล้างตัวกรอง" : "เพิ่มงาน กำหนดวันส่ง และติดตามความคืบหน้าได้ที่นี่"}</p></div> : <ul className="divide-y divide-[#eee4db]">
          {tasks.map((task) => {
            const done = task.status === "done";
            const overdue = task.due_date && task.due_date < today && !done && task.status !== "cancelled";
            return <li key={task.id} className="p-4 sm:p-5"><div className="flex items-start gap-3 sm:gap-4">
              <button type="button" role="checkbox" aria-checked={done} aria-label={`${done ? "นำกลับมาทำ" : "ทำเครื่องหมายเสร็จ"}: ${task.title}`} disabled={pending} onClick={() => toggleComplete(task)} className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border disabled:opacity-50 ${done ? "border-[#78927c] bg-[#e5eee6] text-[#385640]" : "border-[#cfbbaa] bg-white text-[#8f6447]"}`}>{pendingId === task.id ? <LoaderCircle className="h-5 w-5 animate-spin" /> : done ? <Check className="h-5 w-5" /> : <span className="h-5 w-5 rounded-md border-2 border-[#cfbbaa]" />}</button>
              <div className="min-w-0 flex-1"><div className="flex flex-col gap-2 lg:flex-row lg:items-center lg:justify-between"><h3 className={`break-words text-base font-semibold leading-7 ${done ? "text-[#705c4d] line-through" : "text-[#2f241e]"}`}>{task.title}</h3><div className="flex flex-wrap gap-2 text-sm"><span className={`rounded-full px-3 py-1 ${task.priority === "high" ? "bg-[#fde5dd] text-[#933f30]" : "bg-[#f4eadf] text-[#604a3b]"}`}>ความสำคัญ{priorityLabels[task.priority]}</span><span className={`rounded-full px-3 py-1 ${done ? "bg-[#e5eee6] text-[#385640]" : "bg-[#eee9e3] text-[#604a3b]"}`}>{statusLabels[task.status]}</span></div></div>
                {task.description && <p className="mt-2 line-clamp-2 whitespace-pre-wrap break-words text-sm leading-6 text-[#705c4d]">{task.description}</p>}
                <div className="mt-3 flex flex-col gap-2 text-sm text-[#705c4d] sm:flex-row sm:flex-wrap sm:gap-x-5"><span className="inline-flex items-start gap-2"><FolderKanban className="mt-0.5 h-4 w-4 shrink-0" /><span className="break-words">{task.project_id ? projectNames.get(task.project_id) ?? "โปรเจกต์ไม่พร้อมแสดง" : "ไม่อยู่ในโปรเจกต์"}</span></span><span className={`inline-flex items-center gap-2 ${overdue ? "font-semibold text-[#933f30]" : ""}`}><CalendarDays className="h-4 w-4 shrink-0" />{task.due_date ? `${overdue ? "เลยกำหนด · " : "ครบกำหนด "}${dateLabel(task.due_date)}` : "ยังไม่กำหนดวันส่ง"}</span><span className="inline-flex items-center gap-2"><Clock3 className="h-4 w-4 shrink-0" />{task.estimated_minutes === null ? "ยังไม่ประเมินเวลา" : minutesLabel(task.estimated_minutes)}</span></div>
                <div className="mt-3 flex flex-wrap gap-2"><button type="button" disabled={pending || deletePending} onClick={() => { setNotice(null); setEditor({ task }); }} aria-label={`แก้ไข: ${task.title}`} className="inline-flex min-h-11 items-center gap-2 rounded-xl px-3 text-sm font-semibold text-[#8f6447] hover:bg-[#f4eadf] disabled:opacity-50"><Pencil className="h-4 w-4" />แก้ไขงาน</button><button type="button" disabled={pending || deletePending} onClick={() => { setDeleteError(""); setDeleteTarget(task); }} aria-label={`ลบงาน: ${task.title}`} className="inline-flex min-h-11 items-center gap-2 rounded-xl px-3 text-sm font-semibold text-[#933f30] hover:bg-[#fde5dd] disabled:opacity-50"><Trash2 className="h-4 w-4" />ลบงาน</button></div>
              </div>
            </div></li>;
          })}
        </ul>}
      </section>
      {totalPages > 1 && <nav aria-label="หน้ารายการงาน" className="mt-5 flex flex-wrap items-center justify-between gap-3 text-sm">{filters.page > 1 ? <Link href={taskQuery(filters, filters.page - 1)} className="inline-flex min-h-12 items-center rounded-xl border border-[#dfd0c2] bg-white px-4">ก่อนหน้า</Link> : <span />}<span>หน้า {filters.page} จาก {totalPages}</span>{filters.page < totalPages ? <Link href={taskQuery(filters, filters.page + 1)} className="inline-flex min-h-12 items-center rounded-xl border border-[#dfd0c2] bg-white px-4">ถัดไป</Link> : <span />}</nav>}
      <p className="mt-5 text-sm leading-6 text-[#705c4d]">งานที่ทำเสร็จยังเก็บประวัติไว้ตามนโยบายของบัญชี โดยค่าเริ่มต้นคือ 30 วัน</p>
    </>}
    {editor && <TaskEditor task={editor.task} projects={projects} onClose={() => setEditor(null)} onSaved={(message) => { setEditor(null); setNotice({ error: false, message }); router.refresh(); }} />}
    {deleteTarget && <DeleteConfirmation title={`ลบงาน “${deleteTarget.title}”?`} description="งานนี้จะถูกลบถาวร และระบบจะลบกิจกรรมที่เชื่อมไว้ใน Google Calendar หากมี การดำเนินการนี้ย้อนกลับไม่ได้" pending={deletePending} error={deleteError} onConfirm={confirmDelete} onClose={() => { setDeleteTarget(null); setDeleteError(""); }} />}
  </div>;
}
