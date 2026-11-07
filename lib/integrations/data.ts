import "server-only";
import { createAdminClient } from "@/lib/integrations/admin";

export type RecentLineMessage = { role: "user" | "assistant"; content: string; created_at: string };

export async function loadIntegrationStatus(userId: string, notice?: string) {
  const configured = Boolean(
    process.env.SUPABASE_SERVICE_ROLE_KEY &&
    process.env.INTEGRATION_ENCRYPTION_KEY,
  );
  const googleConfigured = configured && Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET && process.env.GOOGLE_REDIRECT_URI);
  const lineConfigured = configured && Boolean(process.env.LINE_CHANNEL_SECRET && process.env.LINE_CHANNEL_ACCESS_TOKEN && process.env.GEMINI_API_KEY);
  try {
    const admin = createAdminClient();
    const [connectionResult, messageResult, voiceResult] = await Promise.all([
      admin.from("integration_connections").select("google_refresh_token_ciphertext,google_email,google_connected_at,line_user_id,line_display_name,line_daily_digest_enabled").eq("user_id", userId).maybeSingle(),
      admin.from("line_messages").select("role,content,created_at").eq("user_id", userId).order("created_at", { ascending: false }).limit(8),
      admin.from("integration_connections").select("line_voice_enabled").eq("user_id", userId).maybeSingle(),
    ]);
    if (connectionResult.error || messageResult.error) {
      return { googleConfigured, lineConfigured, dataReady: false, googleConnected: false, googleEmail: null, lineConnected: false, lineDisplayName: null, lineDailyDigestEnabled: false, lineVoiceEnabled: false, lineVoiceAvailable: false, recentMessages: [] as RecentLineMessage[], integrationNotice: notice ?? null };
    }
    return {
      googleConfigured,
      lineConfigured,
      dataReady: true,
      googleConnected: Boolean(connectionResult.data?.google_refresh_token_ciphertext),
      googleEmail: connectionResult.data?.google_email ?? null,
      lineConnected: Boolean(connectionResult.data?.line_user_id),
      lineDisplayName: connectionResult.data?.line_display_name ?? null,
      lineDailyDigestEnabled: Boolean(connectionResult.data?.line_daily_digest_enabled),
      lineVoiceEnabled: Boolean(voiceResult.data?.line_voice_enabled),
      lineVoiceAvailable: !voiceResult.error,
      recentMessages: (messageResult.data ?? []) as RecentLineMessage[],
      integrationNotice: notice ?? null,
    };
  } catch {
    return { googleConfigured, lineConfigured, dataReady: false, googleConnected: false, googleEmail: null, lineConnected: false, lineDisplayName: null, lineDailyDigestEnabled: false, lineVoiceEnabled: false, lineVoiceAvailable: false, recentMessages: [] as RecentLineMessage[], integrationNotice: notice ?? null };
  }
}
