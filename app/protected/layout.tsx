import Link from "next/link";
import { Suspense } from "react";
import { Sparkles, UserRound, Search } from "lucide-react";
import { Brand } from "@/components/brand";
import { LogoutButton } from "@/components/logout-button";
import {
  DesktopWorkspaceNav,
  MobileWorkspaceNav,
  SettingsLink,
} from "@/components/workspace-nav";
import { getAuthenticatedUser } from "@/lib/supabase/auth-context";

export default function ProtectedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <Suspense
      fallback={
        <div
          role="status"
          className="flex min-h-screen items-center justify-center px-4 text-base text-[#705c4d]"
        >
          กำลังตรวจสอบการเข้าสู่ระบบ…
        </div>
      }
    >
      <ProtectedWorkspace>{children}</ProtectedWorkspace>
    </Suspense>
  );
}

async function ProtectedWorkspace({ children }: { children: React.ReactNode }) {
  await getAuthenticatedUser();

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
            <p className="mt-1 text-[11px] leading-5 text-[#9b8270]">
              พื้นที่ส่วนตัวสำหรับงานและไอเดียของคุณ
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
            <span>บัญชีของฉัน</span>
          </Link>
        </div>
        {children}
      </main>

      <MobileWorkspaceNav />
    </div>
  );
}
