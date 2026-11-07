import { Suspense } from "react";
import { SettingsWorkspace } from "@/components/settings/settings-workspace";
import { loadSettings } from "@/lib/settings/data";
import { getAuthenticatedUser } from "@/lib/supabase/auth-context";
import { loadIntegrationStatus } from "@/lib/integrations/data";
type SearchParams = Promise<Record<string, string | string[] | undefined>>;
export default function SettingsPage({ searchParams }: { searchParams: SearchParams }) { return <Suspense fallback={<div role="status" className="px-4 py-8 text-base text-[#705c4d]">กำลังโหลดการตั้งค่าของคุณ…</div>}><Content searchParams={searchParams} /></Suspense>; }
async function Content({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;
  const notice = typeof params.integration === "string" ? params.integration : undefined;
  const [result, user] = await Promise.all([loadSettings(), getAuthenticatedUser()]);
  const integration = await loadIntegrationStatus(user.userId, notice);
  return <SettingsWorkspace {...result} integration={integration} />;
}
