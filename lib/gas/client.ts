"use client";

export type GoogleAuthUser = {
  email: string;
  name: string;
  picture?: string;
  exp?: number;
};

const ID_TOKEN_KEY = "po_gis_id_token";
const USER_KEY = "po_gis_user";
const GAS_URL_OVERRIDE_KEY = "po_gas_webapp_url";
const GOOGLE_CLIENT_ID_OVERRIDE_KEY = "po_google_client_id";

export function getGasWebAppUrl(): string {
  if (typeof window !== "undefined") {
    const override = window.localStorage.getItem(GAS_URL_OVERRIDE_KEY)?.trim();
    if (override) return override;
  }
  return (process.env.NEXT_PUBLIC_GAS_WEBAPP_URL ?? "").trim();
}

export function setGasWebAppUrlOverride(url: string) {
  if (typeof window === "undefined") return;
  const trimmed = url.trim();
  if (trimmed) window.localStorage.setItem(GAS_URL_OVERRIDE_KEY, trimmed);
  else window.localStorage.removeItem(GAS_URL_OVERRIDE_KEY);
}

export function getGoogleClientId(): string {
  if (typeof window !== "undefined") {
    const override = window.localStorage.getItem(GOOGLE_CLIENT_ID_OVERRIDE_KEY)?.trim();
    if (override) return override;
  }
  return (process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID ?? "").trim();
}

export function setGoogleClientIdOverride(clientId: string) {
  if (typeof window === "undefined") return;
  const trimmed = clientId.trim();
  if (trimmed) window.localStorage.setItem(GOOGLE_CLIENT_ID_OVERRIDE_KEY, trimmed);
  else window.localStorage.removeItem(GOOGLE_CLIENT_ID_OVERRIDE_KEY);
}

export function decodeJwtPayload(token: string): GoogleAuthUser | null {
  try {
    const parts = token.split(".");
    if (parts.length !== 3) return null;
    const base64 = parts[1].replace(/-/g, "+").replace(/_/g, "/");
    const padded = base64 + "=".repeat((4 - (base64.length % 4)) % 4);
    const json = decodeURIComponent(
      Array.prototype.map
        .call(atob(padded), (c: string) => "%" + ("00" + c.charCodeAt(0).toString(16)).slice(-2))
        .join(""),
    );
    const payload = JSON.parse(json) as {
      email?: string;
      name?: string;
      picture?: string;
      exp?: number;
    };
    if (!payload.email) return null;
    if (payload.exp && payload.exp * 1000 < Date.now()) return null;
    return {
      email: payload.email.toLowerCase(),
      name: payload.name || payload.email,
      picture: payload.picture,
      exp: payload.exp,
    };
  } catch {
    return null;
  }
}

export function getStoredIdToken(): string | null {
  if (typeof window === "undefined") return null;
  const token = window.localStorage.getItem(ID_TOKEN_KEY);
  if (!token) return null;
  const decoded = decodeJwtPayload(token);
  if (!decoded) {
    clearGoogleSession();
    return null;
  }
  return token;
}

export function getStoredUser(): GoogleAuthUser | null {
  if (typeof window === "undefined") return null;
  const token = getStoredIdToken();
  if (!token) return null;
  const decoded = decodeJwtPayload(token);
  if (decoded) return decoded;
  try {
    const raw = window.localStorage.getItem(USER_KEY);
    return raw ? (JSON.parse(raw) as GoogleAuthUser) : null;
  } catch {
    return null;
  }
}

export function saveGoogleSession(idToken: string): GoogleAuthUser | null {
  const user = decodeJwtPayload(idToken);
  if (!user || typeof window === "undefined") return null;
  window.localStorage.setItem(ID_TOKEN_KEY, idToken);
  window.localStorage.setItem(USER_KEY, JSON.stringify(user));
  window.dispatchEvent(new CustomEvent("po-auth-changed", { detail: user }));
  return user;
}

export function clearGoogleSession() {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(ID_TOKEN_KEY);
  window.localStorage.removeItem(USER_KEY);
  window.dispatchEvent(new CustomEvent("po-auth-changed", { detail: null }));
}

export function notifyWorkspaceDataChanged() {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent("po-data-updated"));
  }
}

export async function callGasApi<T = unknown>(
  action: string,
  payload: Record<string, unknown> = {},
): Promise<{ ok: boolean; data?: T; message?: string; id?: string; code?: string; lineUrl?: string | null; error?: string }> {
  const webAppUrl = getGasWebAppUrl();
  if (!webAppUrl) {
    return {
      ok: false,
      message: "ยังไม่ได้ตั้งค่า URL ของ Google Apps Script Web App (NEXT_PUBLIC_GAS_WEBAPP_URL)",
    };
  }
  const idToken = getStoredIdToken();
  if (!idToken) {
    return {
      ok: false,
      error: "UNAUTHORIZED",
      message: "เซสชันหมดอายุ กรุณาเข้าสู่ระบบด้วย Google อีกครั้ง",
    };
  }

  const response = await fetch(webAppUrl, {
    method: "POST",
    // ใช้ text/plain เพื่อหลีกเลี่ยง CORS Preflight (OPTIONS) บน Google Apps Script Web App
    headers: { "Content-Type": "text/plain;charset=utf-8" },
    body: JSON.stringify({
      action,
      idToken,
      payload,
    }),
  });

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`);
  }
  const result = (await response.json()) as {
    ok: boolean;
    data?: T;
    message?: string;
    id?: string;
    code?: string;
    lineUrl?: string | null;
    error?: string;
  };
  if (result.error === "UNAUTHORIZED") {
    clearGoogleSession();
  }
  return result;
}

export async function callGasPublic<T = unknown>(
  action: string,
  payload: Record<string, unknown> = {},
): Promise<{ ok: boolean; data?: T; message?: string }> {
  const webAppUrl = getGasWebAppUrl();
  if (!webAppUrl) {
    return { ok: false, message: "ยังไม่ได้ตั้งค่า URL ของระบบหลังบ้าน (NEXT_PUBLIC_GAS_WEBAPP_URL)" };
  }
  try {
    const response = await fetch(webAppUrl, {
      method: "POST",
      headers: { "Content-Type": "text/plain;charset=utf-8" },
      body: JSON.stringify({ action, payload }),
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return (await response.json()) as { ok: boolean; data?: T; message?: string };
  } catch {
    return { ok: false, message: "เชื่อมต่อระบบหลังบ้านไม่สำเร็จ กรุณาลองอีกครั้ง" };
  }
}
