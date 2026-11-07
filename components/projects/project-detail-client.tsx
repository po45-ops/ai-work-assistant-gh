"use client";

import { useCallback, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { ProjectDetail } from "@/components/projects/project-detail";
import { callGasApi } from "@/lib/gas/client";
import type { LinkedTask, Milestone, Project } from "@/lib/projects/types";

type DetailResult = {
  project: Project | null;
  milestones: Milestone[];
  tasks: LinkedTask[];
  error: string | null;
};

export function ProjectDetailClient({ fallbackId }: { fallbackId: string }) {
  const searchParams = useSearchParams();
  const id = searchParams.get("id") || (fallbackId !== "view" ? fallbackId : "");
  const [result, setResult] = useState<DetailResult | null>(null);

  const fetchDetail = useCallback(async () => {
    if (!id) {
      setResult({ project: null, milestones: [], tasks: [], error: "ไม่พบรหัสโปรเจกต์" });
      return;
    }
    try {
      const res = await callGasApi<DetailResult>("projects.detail", { id });
      if (res.ok && res.data) {
        setResult(res.data);
      } else {
        setResult({ project: null, milestones: [], tasks: [], error: res.message || "โหลดโปรเจกต์ไม่สำเร็จ" });
      }
    } catch {
      setResult({ project: null, milestones: [], tasks: [], error: "เชื่อมต่อ Google Apps Script ไม่สำเร็จ" });
    }
  }, [id]);

  useEffect(() => {
    fetchDetail();
    window.addEventListener("po-data-updated", fetchDetail);
    return () => window.removeEventListener("po-data-updated", fetchDetail);
  }, [fetchDetail]);

  if (!result) {
    return <div role="status" className="px-4 py-8 text-base text-[#705c4d]">กำลังโหลดรายละเอียดโปรเจกต์…</div>;
  }

  return <ProjectDetail {...result} />;
}
