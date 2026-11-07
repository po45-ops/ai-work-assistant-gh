export type RecentLineMessage = { role: "user" | "assistant"; content: string; created_at: string };

export async function loadIntegrationStatus(_userId?: string, notice?: string) {
  return {
    googleConfigured: true,
    lineConfigured: true,
    dataReady: true,
    googleConnected: false,
    googleEmail: null as string | null,
    lineConnected: false,
    lineDisplayName: null as string | null,
    lineDailyDigestEnabled: false,
    lineVoiceEnabled: false,
    lineVoiceAvailable: true,
    recentMessages: [] as RecentLineMessage[],
    integrationNotice: notice ?? null,
  };
}
