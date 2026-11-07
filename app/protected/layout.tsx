"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Sparkles, UserRound, Search } from "lucide-react";
import { Brand } from "@/components/brand";
import { LogoutButton } from "@/components/logout-button";
import {
  DesktopWorkspaceNav,
  MobileWorkspaceNav,
  SettingsLink,
} from "@/components/workspace-nav";
import { getStoredUser, type GoogleAuthUser } from "@/lib/gas/client";

export default function ProtectedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const [user, setUser] = useState<GoogleAuthUser | null>(null);
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    const syncAuth = () => {
      const current = getStoredUser();
      if (!current) {
        router.replace("/auth/login");
      } else {
        setUser(current);
      }
      setChecked(true);
    };
    syncAuth();
    window.addEventListener("po-auth-changed", syncAuth);
    return () => window.removeEventListener("po-auth-changed", syncAuth);
  }, [router]);

  if (!checked || !user) {
    return (
      <div
        role="status"
        className="flex min-h-screen items-center justify-center px-4 text-base text-[#705c4d]"
      >
        กำลังตรวจสอบการเข้าสู่ระบบด้วย Google…
      </div>
    );
  }

  return (
    <div className="workspace-shell min-h-screen bg-transparent text-[#2f241e]">
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-[248px] border-r border-[#e8ddd2] bg-[#f4eadf]/95 backdrop-blur-xl xl:flex xl:flex-col">
        <Link href="/protected" className="flex h-[88px] items-center px-6">
          <Brand />
        </Link>

        <div className="px-4">
          <div className="h-px bg-[#e7d9cb]" />
        </div>

        <DesktopWorkspaceNav />

        <div className="px-4 pb-4">
          <SettingsLink />
          <div className="rounded-2xl border border-[#e3d6ca] bg-white/55 p-3">
            <p className="text-xs font-bold text-[#604a3b]">Workspace</p>
            <p className="mt-1 truncate text-[11px] leading-5 text-[#9b8270]">
              {user.email}
            </p>
          </div>
          <div className="mt-3">
            <LogoutButton />
          </div>
        </div>
      </aside>

      <header className="sticky top-0 z-30 flex h-[68px] items-center justify-between border-b border-[#eadfd4] bg-[#fffaf4]/90 px-4 backdrop-blur-xl sm:px-6 xl:hidden">
        <Link href="/protected" className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#8f6447] text-white">
            <Sparkles className="h-4 w-4" strokeWidth={1.9} />
          </div>
          <div>
            <p className="text-sm font-extrabold tracking-[-0.02em] text-[#2f241e]">
              AI Work Assistant
            </p>
            <p className="text-[10px] font-medium text-[#9b8270]">
              ผู้ช่วยจัดงานส่วนตัว
            </p>
          </div>
        </Link>
        <LogoutButton />
      </header>

      <main className="min-h-screen pb-24 xl:ml-[248px] xl:pb-0">
        <div className="workspace-topbar">
          <form
            action="/protected/tasks"
            className="workspace-search"
            role="search"
          >
            <label className="sr-only" htmlFor="workspace-search">
              ค้นหางานของฉัน
            </label>
            <Search aria-hidden="true" />
            <input
              id="workspace-search"
              name="search"
              type="search"
              maxLength={200}
              placeholder="ค้นหางานของฉัน…"
            />
          </form>
          <Link href="/protected/settings" className="workspace-account">
            <UserRound aria-hidden="true" />
            <span>{user.name || "บัญชีของฉัน"}</span>
          </Link>
        </div>
        {children}
      </main>

      <MobileWorkspaceNav />
    </div>
  );
}
