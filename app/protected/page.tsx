import { Suspense } from "react";
import Link from "next/link";
import Image from "next/image";
import {
  ArrowRight,
  CalendarDays,
  CheckSquare2,
  FolderKanban,
  Inbox,
  ListTodo,
  MessageSquareText,
  Target,
} from "lucide-react";
import { loadDashboard } from "@/lib/dashboard/data";
export default function DashboardPage() {
  return (
    <Suspense
      fallback={
        <div role="status" className="px-4 py-8 text-base text-[#705c4d]">
          กำลังโหลดภาพรวมของคุณ…
        </div>
      }
    >
      <Content />
    </Suspense>
  );
}
async function Content() {
  const data = await loadDashboard();
  const todayLabel = new Intl.DateTimeFormat("th-TH", {
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(new Date(`${data.today}T12:00:00Z`));
  return (
    <div className="mx-auto w-full max-w-[1320px] px-4 py-5 sm:px-6 lg:px-8 xl:py-8">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-sm font-semibold tracking-wider text-[#8f6447]">
            TODAY WORKSPACE
          </p>
          <h1 className="mt-2 text-3xl font-bold tracking-tight sm:text-4xl">
            ภาพรวมวันนี้
          </h1>
          <p className="mt-2 text-base text-[#705c4d]">
            สิ่งที่ควรเห็นก่อนเริ่มทำงาน รายละเอียดอยู่ในแต่ละหน้า
          </p>
        </div>
        <time
          dateTime={data.today}
          className="rounded-full border border-[#dfd0c2] bg-white/70 px-4 py-2 text-sm font-semibold text-[#76563f]"
        >
          {todayLabel}
        </time>
      </div>
      {data.error ? (
        <section
          role="alert"
          className="rounded-[24px] border border-[#e8ddd2] bg-[#fffdfa] p-6"
        >
          <h2 className="text-lg font-bold">ยังโหลดภาพรวมไม่ได้</h2>
          <p className="mt-2 text-base text-[#705c4d]">{data.error}</p>
        </section>
      ) : (
        <>
          <section className="dashboard-hero rounded-[28px] border border-[#e5d7ca] bg-gradient-to-br from-[#f6e9dd] via-[#fbf5ef] to-[#f0dfd0] p-5 premium-shadow sm:p-7">
            <div className="dashboard-hero-top">
              <div>
                <p className="text-sm font-semibold text-[#8f6447]">
                  โปช่วยให้วันนี้เป็นระเบียบขึ้น
                </p>
                <h2 className="mt-2 text-3xl font-bold text-[#3a2b22]">
                  {data.todayTasks.toLocaleString("th-TH")} งานครบกำหนดวันนี้
                </h2>
                <p className="mt-2 text-base text-[#705c4d]">
                  {data.overdue
                    ? `มี ${data.overdue.toLocaleString("th-TH")} งานเลยกำหนด`
                    : "ไม่มีงานค้างเกินกำหนด"}
                </p>
              </div>
              <Link
                href="/protected/tasks"
                className="inline-flex min-h-12 items-center gap-2 rounded-xl bg-[#8f6447] px-5 text-sm font-semibold text-white"
              >
                เปิดงานของฉัน
                <ArrowRight className="h-4 w-4" />
              </Link>
              <div className="dashboard-illustration">
                <Image
                  src="/images/po-workspace.webp"
                  alt="กระต่ายโปผู้ช่วยจัดงาน"
                  fill
                  sizes="240px"
                  fetchPriority="high"
                  className="object-cover object-bottom"
                />
              </div>
            </div>
            <div className="dashboard-metrics mt-6 grid grid-cols-3 gap-3">
              <Metric
                icon={<CheckSquare2 className="h-5 w-5" />}
                value={data.todayTasks}
                label="งานวันนี้"
              />
              <Metric
                icon={<Target className="h-5 w-5" />}
                value={data.important}
                label="งานสำคัญที่ยังเปิดอยู่"
              />
              <Metric
                icon={<FolderKanban className="h-5 w-5" />}
                value={data.activeProjects}
                label="โปรเจกต์ที่กำลังทำ"
              />
            </div>
          </section>
          <div className="mt-6 grid gap-5 lg:grid-cols-[minmax(0,1.3fr)_minmax(300px,.7fr)]">
            <div className="space-y-5">
              <section className="rounded-[24px] border border-[#e8ddd2] bg-[#fffdfa] premium-shadow">
                <div className="flex items-center justify-between border-b border-[#eee4db] p-5">
                  <div>
                    <h2 className="text-lg font-bold">งานที่ควรดูต่อ</h2>
                    <p className="mt-1 text-sm text-[#705c4d]">
                      งานที่ยังเปิดอยู่ เรียงตามวันครบกำหนด
                    </p>
                  </div>
                  <Link
                    href="/protected/tasks"
                    className="text-sm font-semibold text-[#8f6447]"
                  >
                    ดูทั้งหมด
                  </Link>
                </div>
                {data.tasks.length ? (
                  <ul className="divide-y divide-[#eee4db]">
                    {data.tasks.map((task) => (
                      <li key={task.id} className="p-5">
                        <Link
                          href={`/protected/tasks?search=${encodeURIComponent(task.title)}`}
                          className="flex min-h-11 items-center justify-between gap-3"
                        >
                          <span className="min-w-0 break-words text-base font-semibold">
                            {task.title}
                          </span>
                          <ArrowRight className="h-4 w-4 shrink-0 text-[#8f6447]" />
                        </Link>
                        <p className="mt-1 text-sm text-[#705c4d]">
                          {task.priority === "high" ? "สำคัญสูง" : "งานทั่วไป"}{" "}
                          ·{" "}
                          {task.due_date
                            ? new Intl.DateTimeFormat("th-TH", {
                                day: "numeric",
                                month: "short",
                                year: "numeric",
                              }).format(new Date(`${task.due_date}T12:00:00Z`))
                            : "ยังไม่กำหนดวันส่ง"}
                        </p>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="p-5 text-base text-[#705c4d]">
                    ยังไม่มีงานที่เปิดอยู่
                  </p>
                )}
              </section>
              <section className="rounded-[24px] border border-[#e8ddd2] bg-[#fffdfa] premium-shadow">
                <div className="flex items-center justify-between border-b border-[#eee4db] p-5">
                  <h2 className="text-lg font-bold">โปรเจกต์ที่ติดตาม</h2>
                  <Link
                    href="/protected/projects"
                    className="text-sm font-semibold text-[#8f6447]"
                  >
                    ดูทั้งหมด
                  </Link>
                </div>
                {data.projects.length ? (
                  <div className="grid gap-3 p-4 sm:grid-cols-2">
                    {data.projects.map((project) => (
                      <Link
                        key={project.id}
                        href={`/protected/projects/${project.id}`}
                        className="rounded-xl bg-[#f7f1e9] p-4"
                      >
                        <p className="break-words text-base font-semibold">
                          {project.name}
                        </p>
                        <div className="mt-4 h-2 overflow-hidden rounded-full bg-[#e7dbd0]">
                          <div
                            className="h-full rounded-full bg-[#8f6447]"
                            style={{ width: `${project.progress_percent}%` }}
                          />
                        </div>
                        <p className="mt-2 text-sm text-[#705c4d]">
                          {project.progress_percent}% ·{" "}
                          {project.status === "active"
                            ? "กำลังดำเนินการ"
                            : "วางแผน"}
                        </p>
                      </Link>
                    ))}
                  </div>
                ) : (
                  <p className="p-5 text-base text-[#705c4d]">
                    ยังไม่มีโปรเจกต์ที่เปิดอยู่
                  </p>
                )}
              </section>
            </div>
            <aside className="space-y-3">
              <QuickLink
                href="/protected/calendar"
                icon={<CalendarDays className="h-5 w-5" />}
                title="ปฏิทิน"
                detail="ดูวันครบกำหนดทั้งหมด"
              />
              <QuickLink
                href="/protected/inbox"
                icon={<Inbox className="h-5 w-5" />}
                title="Inbox"
                detail={`${data.pendingInbox.toLocaleString("th-TH")} ข้อความรอดำเนินการ`}
              />
              <QuickLink
                href="/protected/reports"
                icon={<ListTodo className="h-5 w-5" />}
                title="รายงาน"
                detail="ดูผลงานย้อนหลัง 7 วัน"
              />
              <QuickLink
                href="/protected/inbox"
                icon={<MessageSquareText className="h-5 w-5" />}
                title="บอกงานที่นึกขึ้นได้"
                detail="บันทึกข้อความไว้ใน Inbox ก่อน ระบบ AI จะเพิ่มภายหลัง"
              />
            </aside>
          </div>
        </>
      )}
    </div>
  );
}
function Metric({
  icon,
  value,
  label,
}: {
  icon: React.ReactNode;
  value: number;
  label: string;
}) {
  return (
    <div className="dashboard-metric rounded-2xl border border-[#dfcdbf] bg-white/60 p-4">
      <div className="dim-icon">{icon}</div>
      <p className="mt-3 text-2xl font-bold">{value.toLocaleString("th-TH")}</p>
      <p className="mt-1 text-sm text-[#705c4d]">{label}</p>
    </div>
  );
}
function QuickLink({
  href,
  icon,
  title,
  detail,
}: {
  href: string;
  icon: React.ReactNode;
  title: string;
  detail: string;
}) {
  return (
    <Link
      href={href}
      className="flex min-h-20 items-center gap-3 rounded-[20px] border border-[#e8ddd2] bg-[#fffdfa] p-4 premium-shadow"
    >
      <span className="dim-icon">{icon}</span>
      <span className="min-w-0 flex-1">
        <span className="block text-base font-semibold">{title}</span>
        <span className="mt-1 block text-sm leading-5 text-[#705c4d]">
          {detail}
        </span>
      </span>
      <ArrowRight className="h-4 w-4 shrink-0 text-[#8f6447]" />
    </Link>
  );
}
