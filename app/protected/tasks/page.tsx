import { Suspense } from "react";
import { TasksWorkspace } from "@/components/tasks/tasks-workspace";
import { loadTasks } from "@/lib/tasks/data";
import { parseTaskFilters } from "@/lib/tasks/validation";
type SearchParams = Promise<Record<string, string | string[] | undefined>>;
export default function TasksPage({ searchParams }: { searchParams: SearchParams }) {
  return <Suspense fallback={<div role="status" className="px-4 py-8 text-base text-[#705c4d]">กำลังโหลดงานของคุณ…</div>}><TaskContent searchParams={searchParams} /></Suspense>;
}
async function TaskContent({ searchParams }: { searchParams: SearchParams }) {
  const filters = parseTaskFilters(await searchParams); const result = await loadTasks(filters);
  return <TasksWorkspace {...result} filters={filters} />;
}
