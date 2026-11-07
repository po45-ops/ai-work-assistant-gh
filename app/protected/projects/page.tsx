"use client";

import { Suspense, useCallback, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { ProjectsWorkspace } from "@/components/projects/projects-workspace";
import { callGasApi } from "@/lib/gas/client";
import { parseProjectFilters } from "@/lib/projects/validation";
import type { Project } from "@/lib/projects/types";

type ProjectsResult = {
  projects: Project[];
  count: number;
  active: number;
  completed: number;
  overdue: number;
  error: string | null;
};

export default function ProjectsPage() {
  return (
    <Suspense fallback={<div role="status" className="px-4 py-8 text-base text-[#705c4d]">กำลังโหลดโปรเจกต์ของคุณ…</div>}>
      <Content />
    </Suspense>
  );
}

function Content() {
  const searchParams = useSearchParams();
  const [result, setResult] = useState<ProjectsResult | null>(null);
  const queryKey = searchParams.toString();
  const filters = parseProjectFilters(Object.fromEntries(new URLSearchParams(queryKey)));

  const fetchProjects = useCallback(async () => {
    try {
      const res = await callGasApi<ProjectsResult>(
        "projects.list",
        parseProjectFilters(Object.fromEntries(new URLSearchParams(queryKey))),
      );
      if (res.ok && res.data) {
        setResult(res.data);
      } else {
        setResult({
          projects: [],
          count: 0,
          active: 0,
          completed: 0,
          overdue: 0,
          error: res.message || "โหลดข้อมูลโปรเจกต์ไม่สำเร็จ",
        });
      }
    } catch {
      setResult({
        projects: [],
        count: 0,
        active: 0,
        completed: 0,
        overdue: 0,
        error: "เชื่อมต่อ Google Apps Script ไม่สำเร็จ",
      });
    }
  }, [queryKey]);

  useEffect(() => {
    fetchProjects();
    window.addEventListener("po-data-updated", fetchProjects);
    return () => window.removeEventListener("po-data-updated", fetchProjects);
  }, [fetchProjects]);

  if (!result) {
    return <div role="status" className="px-4 py-8 text-base text-[#705c4d]">กำลังโหลดโปรเจกต์ของคุณ…</div>;
  }

  return <ProjectsWorkspace {...result} filters={filters} />;
}
