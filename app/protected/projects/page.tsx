import { Suspense } from "react";
import { ProjectsWorkspace } from "@/components/projects/projects-workspace";
import { loadProjects } from "@/lib/projects/data";
import { parseProjectFilters } from "@/lib/projects/validation";
type SearchParams = Promise<Record<string, string | string[] | undefined>>;
export default function ProjectsPage({ searchParams }: { searchParams: SearchParams }) {
  return <Suspense fallback={<div role="status" className="px-4 py-8 text-base text-[#705c4d]">กำลังโหลดโปรเจกต์ของคุณ…</div>}><Content searchParams={searchParams} /></Suspense>;
}
async function Content({ searchParams }: { searchParams: SearchParams }) {
  const filters = parseProjectFilters(await searchParams);
  const result = await loadProjects(filters);
  return <ProjectsWorkspace {...result} filters={filters} />;
}
