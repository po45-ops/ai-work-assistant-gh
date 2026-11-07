"use client";

import { Suspense, useCallback, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { TasksWorkspace } from "@/components/tasks/tasks-workspace";
import { callGasApi } from "@/lib/gas/client";
import { parseTaskFilters } from "@/lib/tasks/validation";
import type { ProjectOption, Task } from "@/lib/tasks/types";

type TasksResult = {
  tasks: Task[];
  projects: ProjectOption[];
  count: number;
  today: string;
  error: string | null;
};

export default function TasksPage() {
  return (
    <Suspense fallback={<div role="status" className="px-4 py-8 text-base text-[#705c4d]">กำลังโหลดงานของคุณ…</div>}>
      <TaskContent />
    </Suspense>
  );
}

function TaskContent() {
  const searchParams = useSearchParams();
  const [result, setResult] = useState<TasksResult | null>(null);

  const rawParams: Record<string, string> = {};
  searchParams.forEach((value, key) => {
    rawParams[key] = value;
  });
  const filters = parseTaskFilters(rawParams);
  const queryKey = searchParams.toString();

  const fetchTasks = useCallback(async () => {
    try {
      const res = await callGasApi<TasksResult>("tasks.list", parseTaskFilters(Object.fromEntries(new URLSearchParams(queryKey))));
      if (res.ok && res.data) {
        setResult(res.data);
      } else {
        setResult({
          tasks: [],
          projects: [],
          count: 0,
          today: new Date().toISOString().slice(0, 10),
          error: res.message || "โหลดข้อมูลงานไม่สำเร็จ",
        });
      }
    } catch {
      setResult({
        tasks: [],
        projects: [],
        count: 0,
        today: new Date().toISOString().slice(0, 10),
        error: "เชื่อมต่อ Google Apps Script ไม่สำเร็จ",
      });
    }
  }, [queryKey]);

  useEffect(() => {
    fetchTasks();
    window.addEventListener("po-data-updated", fetchTasks);
    return () => window.removeEventListener("po-data-updated", fetchTasks);
  }, [fetchTasks]);

  if (!result) {
    return <div role="status" className="px-4 py-8 text-base text-[#705c4d]">กำลังโหลดงานของคุณ…</div>;
  }

  return <TasksWorkspace {...result} filters={filters} />;
}
