"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BarChart3,
  CalendarDays,
  CheckSquare2,
  FolderKanban,
  Inbox,
  LayoutDashboard,
  MoreHorizontal,
  Settings,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

const settingsItem = { href: "/protected/settings", label: "ตั้งค่า", icon: Settings };

const items = [
  { href: "/protected", label: "หน้าหลัก", icon: LayoutDashboard },
  { href: "/protected/tasks", label: "งานของฉัน", icon: CheckSquare2 },
  { href: "/protected/calendar", label: "ปฏิทิน", icon: CalendarDays },
  { href: "/protected/projects", label: "โปรเจกต์", icon: FolderKanban },
  { href: "/protected/inbox", label: "Inbox", icon: Inbox },
  { href: "/protected/reports", label: "รายงาน", icon: BarChart3 },
];

function isActive(pathname: string, href: string) {
  if (href === "/protected") return pathname === href;
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function DesktopWorkspaceNav() {
  const pathname = usePathname();

  return (
    <nav aria-label="เมนูหลัก" className="flex-1 space-y-1 px-4 py-5">
      {items.map(({ href, label, icon: Icon }) => {
        const active = isActive(pathname, href);
        return (
          <Link
            key={href}
            href={href}
            aria-current={active ? "page" : undefined}
            className={
              active
                ? "flex h-11 items-center gap-3 rounded-xl bg-[#946a4d] px-3.5 text-[14px] font-bold text-white shadow-sm"
                : "flex h-11 items-center gap-3 rounded-xl px-3.5 text-[14px] font-semibold text-[#705c4d] transition hover:bg-white/60 hover:text-[#3f3026]"
            }
          >
            <Icon className="h-[18px] w-[18px]" strokeWidth={1.9} />
            {label}
          </Link>
        );
      })}
    </nav>
  );
}

export function MobileWorkspaceNav() {
  const pathname = usePathname();
  const mobileItems = items.slice(0, 4);
  const moreItems = [...items.slice(4), settingsItem];
  const activeMoreItem = moreItems.find(({ href }) => isActive(pathname, href));

  return (
    <nav aria-label="เมนูหลักบนมือถือ" className="fixed inset-x-0 bottom-0 z-40 grid grid-cols-5 border-t border-[#e8ddd2] bg-[#fffaf4]/95 px-2 pb-[max(.5rem,env(safe-area-inset-bottom))] pt-2 backdrop-blur-xl xl:hidden">
      {mobileItems.map(({ href, label, icon: Icon }) => {
        const active = isActive(pathname, href);
        return (
          <Link
            key={href}
            href={href}
            aria-current={active ? "page" : undefined}
            className={
              active
                ? "flex min-h-12 min-w-0 flex-col items-center justify-center gap-1 rounded-xl bg-[#f4eadf] py-1.5 text-xs font-bold text-[#8f6447]"
                : "flex min-h-12 min-w-0 flex-col items-center justify-center gap-1 rounded-xl py-1.5 text-xs font-semibold text-[#705c4d]"
            }
          >
            <Icon className="h-[19px] w-[19px]" strokeWidth={1.9} />
            <span className="max-w-full truncate">{label}</span>
          </Link>
        );
      })}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            aria-label={activeMoreItem ? `เมนูเพิ่มเติม: ${activeMoreItem.label}` : "เมนูเพิ่มเติม"}
            className={`flex min-h-12 min-w-0 flex-col items-center justify-center gap-1 rounded-xl py-1.5 text-xs font-semibold focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#8f6447] ${activeMoreItem ? "bg-[#f4eadf] text-[#8f6447]" : "text-[#705c4d]"}`}
          >
            <MoreHorizontal className="h-[19px] w-[19px]" strokeWidth={1.9} />
            <span>{activeMoreItem?.label ?? "เพิ่มเติม"}</span>
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent side="top" align="end" sideOffset={12} className="w-52 rounded-2xl border-[#e8ddd2] bg-[#fffdfa] p-2">
          {moreItems.map(({ href, label, icon: Icon }) => (
            <DropdownMenuItem key={href} asChild>
              <Link href={href} aria-current={isActive(pathname, href) ? "page" : undefined} className={`min-h-12 rounded-xl px-3 text-sm ${isActive(pathname, href) ? "bg-[#f4eadf] font-bold text-[#8f6447]" : "text-[#705c4d]"}`}>
                <Icon aria-hidden="true" />
                {label}
              </Link>
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
    </nav>
  );
}

export function SettingsLink() {
  const pathname = usePathname();
  const active = isActive(pathname, settingsItem.href);

  return (
    <Link
      href="/protected/settings"
      aria-current={active ? "page" : undefined}
      className={
        active
          ? "mb-3 flex h-11 items-center gap-3 rounded-xl bg-[#946a4d] px-3.5 text-[14px] font-bold text-white shadow-sm"
          : "mb-3 flex h-11 items-center gap-3 rounded-xl px-3.5 text-[14px] font-semibold text-[#705c4d] transition hover:bg-white/60 hover:text-[#3f3026]"
      }
    >
      <Settings className="h-[18px] w-[18px]" strokeWidth={1.9} />
      ตั้งค่า
    </Link>
  );
}
