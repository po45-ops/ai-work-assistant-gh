"use client";

import { Suspense, useCallback, useEffect, useState } from "react";
import { SettingsWorkspace } from "@/components/settings/settings-workspace";
import { callGasApi, getStoredUser } from "@/lib/gas/client";
import { defaultWorkSettings, type WorkSettings } from "@/lib/settings/data";
import type { loadIntegrationStatus } from "@/lib/integrations/data";

type IntegrationStatus = Awaited<ReturnType<typeof loadIntegrationStatus>>;
type SettingsPagePayload = {
  email: string;
  settings: WorkSettings;
  error: string | null;
  integration: IntegrationStatus;
};

export default function SettingsPage() {
  return (
    <Suspense fallback={<div role="status" className="px-4 py-8 text-base text-[#705c4d]">กำลังโหลดการตั้งค่าของคุณ…</div>}>
      <Content />
    </Suspense>
  );
}

function Content() {
  const [data, setData] = useState<SettingsPagePayload | null>(null);

  const fetchSettings = useCallback(async () => {
    const user = getStoredUser();
    try {
      const res = await callGasApi<SettingsPagePayload>("settings.get");
      if (res.ok && res.data) {
        setData(res.data);
      } else {
        setData({
          email: user?.email || "",
          settings: defaultWorkSettings,
          error: res.message || "โหลดการตั้งค่าไม่สำเร็จ",
          integration: {
            googleConfigured: true,
            lineConfigured: false,
            dataReady: false,
            googleConnected: false,
            googleEmail: null,
            lineConnected: false,
            lineDisplayName: null,
            lineDailyDigestEnabled: false,
            lineVoiceEnabled: false,
            lineVoiceAvailable: false,
            recentMessages: [],
            integrationNotice: null,
          },
        });
      }
    } catch {
      setData({
        email: user?.email || "",
        settings: defaultWorkSettings,
        error: "เชื่อมต่อ Google Apps Script ไม่สำเร็จ",
        integration: {
          googleConfigured: true,
          lineConfigured: false,
          dataReady: false,
          googleConnected: false,
          googleEmail: null,
          lineConnected: false,
          lineDisplayName: null,
          lineDailyDigestEnabled: false,
          lineVoiceEnabled: false,
          lineVoiceAvailable: false,
          recentMessages: [],
          integrationNotice: null,
        },
      });
    }
  }, []);

  useEffect(() => {
    fetchSettings();
    window.addEventListener("po-data-updated", fetchSettings);
    return () => window.removeEventListener("po-data-updated", fetchSettings);
  }, [fetchSettings]);

  if (!data) {
    return <div role="status" className="px-4 py-8 text-base text-[#705c4d]">กำลังโหลดการตั้งค่าของคุณ…</div>;
  }

  return <SettingsWorkspace {...data} />;
}
