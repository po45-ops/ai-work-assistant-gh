import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/integrations/admin";
import { encryptSecret } from "@/lib/integrations/security";

export async function GET(request: NextRequest) {
  const url = new URL("/protected/settings", request.url);
  const savedState = request.cookies.get("google_oauth_state")?.value ?? "";
  const incomingState = request.nextUrl.searchParams.get("state") ?? "";
  const [expectedState, userId] = savedState.split(":");
  const code = request.nextUrl.searchParams.get("code");
  if (!expectedState || expectedState !== incomingState || !userId || !code) {
    url.searchParams.set("integration", request.nextUrl.searchParams.has("error") ? "google_cancelled" : "google_error");
    const response = NextResponse.redirect(url);
    response.cookies.set("google_oauth_state", "", { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", path: "/api/integrations/google/callback", maxAge: 0 });
    return response;
  }
  try {
    const clientId = process.env.GOOGLE_CLIENT_ID;
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
    const redirectUri = process.env.GOOGLE_REDIRECT_URI;
    if (!clientId || !clientSecret || !redirectUri) throw new Error("Google OAuth is not configured");
    const tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ code, client_id: clientId, client_secret: clientSecret, redirect_uri: redirectUri, grant_type: "authorization_code" }),
      cache: "no-store",
    });
    if (!tokenResponse.ok) throw new Error("Google token exchange failed");
    const token = await tokenResponse.json() as { access_token?: string; refresh_token?: string };
    if (!token.access_token) throw new Error("Google did not return an access token");
    const admin = createAdminClient();
    const { data: previous } = await admin.from("integration_connections").select("google_refresh_token_ciphertext").eq("user_id", userId).maybeSingle();
    const refreshToken = token.refresh_token ? encryptSecret(token.refresh_token) : previous?.google_refresh_token_ciphertext;
    if (!refreshToken) throw new Error("Google did not return offline access credentials");
    const profileResponse = await fetch("https://openidconnect.googleapis.com/v1/userinfo", { headers: { authorization: "Bearer " + token.access_token }, cache: "no-store" });
    const profile = profileResponse.ok ? await profileResponse.json() as { email?: string } : {};
    const { error } = await admin.from("integration_connections").upsert({
      user_id: userId,
      google_refresh_token_ciphertext: refreshToken,
      google_calendar_id: "primary",
      google_email: profile.email ?? null,
      google_connected_at: new Date().toISOString(),
    }, { onConflict: "user_id" });
    if (error) throw new Error("Google connection could not be saved");
    url.searchParams.set("integration", "google_connected");
  } catch {
    url.searchParams.set("integration", "google_error");
  }
  const response = NextResponse.redirect(url);
  response.cookies.set("google_oauth_state", "", { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", path: "/api/integrations/google/callback", maxAge: 0 });
  return response;
}
