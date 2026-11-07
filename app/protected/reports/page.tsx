import { Suspense } from "react";
import Link from "next/link";
import {
  BarChart3,
  CheckCircle2,
  Clock3,
  FolderKanban,
  ListTodo,
} from "lucide-react";
import { loadReport } from "@/lib/reports/data";
export default function ReportsPage() {
  return (
    <Suspense
      fallback={
        <div role="status" className="px-4 py-8 text-base text-[#705c4d]">
          กำลังคำนวณรายงาน…
        </div>
      }
    >
      <Content />
    </Suspense>
  );
}
async function Content() {
  const report = await loadReport();
  const max = Math.max(1, ...report.daily.map((item) => item.count));
  return (
    <div className="mx-auto w-full max-w-[1320px] px-4 py-5 sm:px-6 lg:px-8 xl:py-8">
      <div className="mb-7">
        <p className="text-sm font-semibold tracking-wider text-[#8f6447]">
          REPORTS
        </p>
        <h1 className="mt-2 text-3xl font-bold tracking-tight sm:text-4xl">
          รายงาน
        </h1>
        <p className="mt-2 text-base text-[#705c4d]">
          ภาพรวมงานและโปรเจกต์จากข้อมูลของคุณในช่วง 7 วันที่ผ่านมา
        </p>
      </div>
      {report.error ? (
        <section
          role="alert"
          className="rounded-[24px] border border-[#e8ddd2] bg-[#fffdfa] p-6"
        >
          <h2 className="text-lg font-bold">ยังแสดงรายงานไม่ได้</h2>
          <p className="mt-2 text-base text-[#705c4d]">{report.error}</p>
        </section>
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-3">
            <Stat
              icon={<CheckCircle2 className="h-5 w-5" />}
              label="งานที่เสร็จใน 7 วัน"
              value={report.completed}
            />
            <Stat
              icon={<ListTodo className="h-5 w-5" />}
              label="งานที่ยังเปิดอยู่"
              value={report.open}
            />
            <Stat
              icon={<Clock3 className="h-5 w-5" />}
              label="งานที่เลยกำหนด"
              value={report.overdue}
            />
          </div>
          <div className="mt-6 grid gap-5 lg:grid-cols-[minmax(0,1.3fr)_minmax(280px,.7fr)]">
            <section className="rounded-[24px] border border-[#e8ddd2] bg-[#fffdfa] p-5 premium-shadow sm:p-6">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <h2 className="text-xl font-bold">งานที่เสร็จในแต่ละวัน</h2>
                  <p className="mt-1 text-sm text-[#705c4d]">
                    นับตามวันที่ทำเสร็จ เวลาไทย
                  </p>
                </div>
                <BarChart3 className="h-5 w-5 text-[#8f6447]" />
              </div>
              <div className="mt-8 grid h-60 grid-cols-7 items-end gap-2 border-b border-[#eadfd4] pb-1 sm:gap-4">
                {report.daily.map((item) => (
                  <div
                    key={item.date}
                    className="flex h-full min-w-0 flex-col items-center justify-end"
                  >
                    <span className="mb-2 text-sm font-semibold text-[#604a3b]">
                      {item.count}
                    </span>
                    <div
                      className="w-full max-w-12 rounded-t-xl bg-[#a97756]"
                      style={{
                        height: item.count
                          ? `${Math.max(8, (item.count / max) * 100)}%`
                          : "4px",
                      }}
                    />
                    <span className="mt-2 text-xs font-semibold text-[#705c4d]">
                      {new Intl.DateTimeFormat("th-TH", {
                        weekday: "short",
                      }).format(new Date(`${item.date}T12:00:00Z`))}
                    </span>
                  </div>
                ))}
              </div>
              {report.completed === 0 && (
                <p className="mt-5 text-sm text-[#705c4d]">
                  ยังไม่มีงานที่ทำเสร็จในช่วงนี้
                </p>
              )}
            </section>
            <section className="rounded-[24px] border border-[#e8ddd2] bg-[#fffdfa] p-5 premium-shadow sm:p-6">
              <div className="flex items-center gap-3">
                <FolderKanban className="h-5 w-5 text-[#8f6447]" />
                <h2 className="text-xl font-bold">โปรเจกต์</h2>
              </div>
              <dl className="mt-6 space-y-4">
                <div className="flex items-center justify-between border-b border-[#eee4db] pb-4">
                  <dt className="text-base text-[#705c4d]">กำลังดำเนินการ</dt>
                  <dd className="text-xl font-bold">
                    {report.projectsActive.toLocaleString("th-TH")}
                  </dd>
                </div>
                <div className="flex items-center justify-between">
                  <dt className="text-base text-[#705c4d]">เสร็จแล้ว</dt>
                  <dd className="text-xl font-bold">
                    {report.projectsCompleted.toLocaleString("th-TH")}
                  </dd>
                </div>
              </dl>
              <Link
                href="/protected/projects"
                className="mt-6 inline-flex min-h-12 items-center rounded-xl bg-[#f4eadf] px-4 text-sm font-semibold text-[#8f6447]"
              >
                ดูโปรเจกต์ทั้งหมด
              </Link>
            </section>
          </div>
          <p className="mt-5 text-sm leading-6 text-[#705c4d]">
            รายงานนี้นับจากสถานะและวันที่ทำเสร็จจริงในระบบ
            ยังไม่มีการติดตามเวลาโฟกัสหรือการวิเคราะห์ด้วย AI
          </p>
        </>
      )}
    </div>
  );
}
function Stat({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: number;
}) {
  return (
    <div className="rounded-[24px] border border-[#e8ddd2] bg-[#fffdfa] p-5 premium-shadow">
      <div className="dim-icon tone-sage">{icon}</div>
      <p className="mt-4 text-sm font-semibold text-[#705c4d]">{label}</p>
      <p className="mt-2 text-3xl font-bold">{value.toLocaleString("th-TH")}</p>
    </div>
  );
}
