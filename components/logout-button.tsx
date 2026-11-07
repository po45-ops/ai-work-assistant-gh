"use client";

import { LogOut } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";

export function LogoutButton() {
  const router = useRouter();

  const logout = async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/auth/login");
    router.refresh();
  };

  return (
    <button
      onClick={logout}
      aria-label="ออกจากระบบ"
      type="button"
      className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-[#dfd2c6] bg-white/70 px-3.5 text-sm font-bold text-[#765b48] transition hover:bg-white hover:text-[#4e3b30]"
    >
      <LogOut className="h-4 w-4" />
      <span className="hidden sm:inline">ออกจากระบบ</span>
    </button>
  );
}
