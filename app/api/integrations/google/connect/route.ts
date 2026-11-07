import { randomBytes } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  if (!data.user) return NextResponse.redirect(new URL("/auth/login?next=%2Fprotected%2Fsettings", request.url));
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const redirectUri = process.env.GOOGLE_REDIRECT_URI;
  if (!clientId || !redirectUri) return NextResponse.redirect(new URL("/protected/settings?integration=google_not_configured", request.url));

  const state = randomBytes(24).toString("base64url");
  const response = NextResponse.redirect("https://accounts.google.com/o/oauth2/v2/auth?" + new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: "code",
    scope: "openid email https://www.googleapis.com/auth/calendar.events.owned",
    access_type: "offline",
    prompt: "consent",
    state,
    include_granted_scopes: "true",
  }).toString());
  response.cookies.set("google_oauth_state", state + ":" + data.user.id, {
    httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", path: "/api/integrations/google/callback", maxAge: 600,
  });
  return response;
}
