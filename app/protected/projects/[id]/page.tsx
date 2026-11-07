import { Suspense } from "react";
import { ProjectDetail } from "@/components/projects/project-detail";
import { loadProjectDetail } from "@/lib/projects/data";
export default async function ProjectDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <Suspense fallback={<div role="status" className="px-4 py-8 text-base text-[#705c4d]">กำลังโหลดรายละเอียดโปรเจกต์…</div>}><Content id={id} /></Suspense>;
}
async function Content({ id }: { id: string }) {
  const result = await loadProjectDetail(id);
  return <ProjectDetail {...result} />;
}
