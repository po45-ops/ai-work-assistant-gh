"use client";

import Script from "next/script";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { CheckCircle2, LoaderCircle, Settings2, ShieldCheck } from "lucide-react";
import {
  callGasApi,
  getGasWebAppUrl,
  getGoogleClientId,
  getStoredUser,
  saveGoogleSession,
  setGasWebAppUrlOverride,
  setGoogleClientIdOverride,
} from "@/lib/gas/client";

declare global {
  interface Window {
    google?: {
      accounts?: {
        id?: {
          initialize: (config: {
            client_id: string;
            callback: (response: { credential?: string }) => void;
            auto_select?: boolean;
          }) => void;
          renderButton: (
            parent: HTMLElement,
            options: {
              theme?: "outline" | "filled_blue" | "filled_black";
              size?: "large" | "medium" | "small";
              text?: string;
              shape?: "rectangular" | "pill";
              width?: number;
              locale?: string;
            },
          ) => void;
        };
      };
    };
  }
}

export function LoginForm() {
  const router = useRouter();
  const buttonContainerRef = useRef<HTMLDivElement>(null);
  const [scriptReady, setScriptReady] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [showConfig, setShowConfig] = useState(false);
  const [clientId, setClientId] = useState("");
  const [gasUrl, setGasUrl] = useState("");
  const [configSaved, setConfigSaved] = useState(false);

  useEffect(() => {
    setClientId(getGoogleClientId());
    setGasUrl(getGasWebAppUrl());
    const existing = getStoredUser();
    if (existing) {
      router.replace("/protected");
    }
  }, [router]);

  const handleCredentialResponse = useCallback(
    async (response: { credential?: string }) => {
      if (!response.credential) {
        setError("ไม่ได้รับข้อมูลยืนยันตัวตนจาก Google กรุณาลองอีกครั้ง");
        return;
      }
      setPending(true);
      setError("");
      try {
        const user = saveGoogleSession(response.credential);
        if (!user) {
          throw new Error("รูปแบบ Google ID Token ไม่ถูกต้อง");
        }
        // ถ้าตั้งค่า Apps Script URL แล้ว ให้ส่งไปให้ Apps Script ตรวจ ID Token ทันที
        if (getGasWebAppUrl()) {
          const check = await callGasApi("auth.me");
          if (!check.ok) {
            throw new Error(check.message || "Apps Script ปฏิเสธการเข้าสู่ระบบ");
          }
        }
        router.push("/protected");
      } catch (e) {
        setError(e instanceof Error ? e.message : "เข้าสู่ระบบไม่สำเร็จ กรุณาลองใหม่");
      } finally {
        setPending(false);
      }
    },
    [router],
  );

  useEffect(() => {
    const activeClientId = clientId.trim();
    if (!scriptReady || !activeClientId || !buttonContainerRef.current || !window.google?.accounts?.id) {
      return;
    }
    try {
      window.google.accounts.id.initialize({
        client_id: activeClientId,
        callback: handleCredentialResponse,
      });
      buttonContainerRef.current.innerHTML = "";
      window.google.accounts.id.renderButton(buttonContainerRef.current, {
        theme: "outline",
        size: "large",
        text: "signin_with",
        shape: "pill",
        width: 320,
        locale: "th",
      });
    } catch {
      setError("โหลดปุ่ม Google Sign-In ไม่สำเร็จ กรุณาตรวจสอบ Google Client ID");
    }
  }, [scriptReady, clientId, handleCredentialResponse]);

  function saveRuntimeConfig(e: React.FormEvent) {
    e.preventDefault();
    setGoogleClientIdOverride(clientId);
    setGasWebAppUrlOverride(gasUrl);
    setConfigSaved(true);
    setTimeout(() => setConfigSaved(false), 3000);
  }

  return (
    <>
      <Script
        src="https://accounts.google.com/gsi/client"
        strategy="afterInteractive"
        onLoad={() => setScriptReady(true)}
      />
      <p className="eyebrow">ยินดีต้อนรับกลับมา</p>
      <h2 className="auth-title">เข้าสู่ระบบด้วย Google</h2>
      <p className="auth-description">
        เข้าใช้งาน Po · AI Work Assistant ด้วยบัญชี Google ของคุณ ข้อมูลจะแยกตามอีเมลและตรวจสิทธิ์ผ่าน Google Apps Script
      </p>

      <div className="mt-6 flex flex-col items-center justify-center gap-4 rounded-2xl border border-[#e5d7ca] bg-[#fffaf5] p-6">
        {clientId ? (
          <div ref={buttonContainerRef} className="flex min-h-[44px] items-center justify-center" />
        ) : (
          <p className="text-center text-sm text-[#933f30]">
            ยังไม่ได้ระบุ <code>GOOGLE_CLIENT_ID</code> กรุณากดปุ่ม &ldquo;ตั้งค่าการเชื่อมต่อ&rdquo; ด้านล่าง
          </p>
        )}

        {pending && (
          <div className="flex items-center gap-2 text-sm font-semibold text-[#8f6447]">
            <LoaderCircle className="h-4 w-4 animate-spin" />
            <span>กำลังตรวจสอบ ID Token กับ Google Apps Script…</span>
          </div>
        )}

        <div className="flex items-center gap-2 text-xs text-[#705c4d]">
          <ShieldCheck className="h-4 w-4 shrink-0 text-[#47644c]" />
          <span>ปลอดภัยด้วย Google Identity Services (OAuth 2.0 ID Token)</span>
        </div>
      </div>

      {error && (
        <p role="alert" className="form-error mt-4">
          {error}
        </p>
      )}

      <div className="mt-6 border-t border-[#e8ddd2] pt-4">
        <button
          type="button"
          onClick={() => setShowConfig(!showConfig)}
          className="inline-flex items-center gap-2 text-xs font-semibold text-[#8f6447] hover:underline"
        >
          <Settings2 className="h-3.5 w-3.5" />
          {showConfig ? "ซ่อนการตั้งค่าการเชื่อมต่อ" : "ตั้งค่า Google Client ID / Apps Script URL"}
        </button>

        {showConfig && (
          <form onSubmit={saveRuntimeConfig} className="mt-3 space-y-3 rounded-2xl border border-[#e5d7ca] bg-white p-4 text-left">
            <div>
              <label htmlFor="gis-client-id" className="mb-1 block text-xs font-semibold text-[#604a3b]">
                Google OAuth Client ID
              </label>
              <input
                id="gis-client-id"
                type="text"
                value={clientId}
                onChange={(e) => setClientId(e.target.value)}
                placeholder="xxxx.apps.googleusercontent.com"
                className="min-h-10 w-full rounded-xl border border-[#dfd0c2] px-3 text-xs text-[#2f241e]"
              />
            </div>
            <div>
              <label htmlFor="gas-webapp-url" className="mb-1 block text-xs font-semibold text-[#604a3b]">
                Google Apps Script Web App URL (/exec)
              </label>
              <input
                id="gas-webapp-url"
                type="url"
                value={gasUrl}
                onChange={(e) => setGasUrl(e.target.value)}
                placeholder="https://script.google.com/macros/s/.../exec"
                className="min-h-10 w-full rounded-xl border border-[#dfd0c2] px-3 text-xs text-[#2f241e]"
              />
            </div>
            <div className="flex items-center justify-between gap-2 pt-1">
              {configSaved ? (
                <span className="inline-flex items-center gap-1 text-xs font-semibold text-[#385640]">
                  <CheckCircle2 className="h-3.5 w-3.5" /> บันทึกค่าในเบราว์เซอร์แล้ว
                </span>
              ) : (
                <span className="text-[11px] text-[#8c7564]">เก็บในเบราว์เซอร์เครื่องนี้</span>
              )}
              <button
                type="submit"
                className="rounded-xl bg-[#8f6447] px-4 py-2 text-xs font-semibold text-white"
              >
                บันทึกค่า
              </button>
            </div>
          </form>
        )}
      </div>
    </>
  );
}
