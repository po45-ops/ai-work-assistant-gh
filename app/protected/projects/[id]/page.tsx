import { Suspense } from "react";
import { ProjectDetailClient } from "@/components/projects/project-detail-client";

export function generateStaticParams() {
  return [{ id: "view" }];
}

export default async function ProjectDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return (
    <Suspense fallback={<div role="status" className="px-4 py-8 text-base text-[#705c4d]">กำลังโหลดรายละเอียดโปรเจกต์…</div>}>
      <ProjectDetailClient fallbackId={id} />
    </Suspense>
  );
}
