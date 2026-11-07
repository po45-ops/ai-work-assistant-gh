"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { getStoredUser } from "@/lib/gas/client";

export default function Home() {
  const router = useRouter();
  useEffect(() => {
    const user = getStoredUser();
    router.replace(user ? "/protected" : "/auth/login");
  }, [router]);

  return (
    <div className="flex min-h-screen items-center justify-center px-4 text-base text-[#705c4d]">
      กำลังเปิด Po · AI Work Assistant…
    </div>
  );
}
