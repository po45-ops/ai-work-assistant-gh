"use client";

import Link from "next/link";
import Script from "next/script";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { ArrowRight, LoaderCircle, Mail } from "lucide-react";
import { PasswordField } from "@/components/auth/password-field";
import {
  callGasApi,
  callGasPublic,
  getGasWebAppUrl,
  getGoogleClientId,
  getStoredUser,
  saveGoogleSession,
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
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [clientId, setClientId] = useState("");

  useEffect(() => {
    setClientId(getGoogleClientId());
    if (getStoredUser()) router.replace("/protected");
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
        if (!user) throw new Error("รูปแบบ Google ID Token ไม่ถูกต้อง");
        if (getGasWebAppUrl()) {
          const check = await callGasApi("auth.me");
          if (!check.ok) throw new Error(check.message || "ระบบปฏิเสธการเข้าสู่ระบบ");
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
    const id = clientId.trim();
    if (!scriptReady || !id || !buttonContainerRef.current || !window.google?.accounts?.id) return;
    try {
      window.google.accounts.id.initialize({ client_id: id, callback: handleCredentialResponse });
      buttonContainerRef.current.innerHTML = "";
      window.google.accounts.id.renderButton(buttonContainerRef.current, {
        theme: "outline",
        size: "large",
        text: "signin_with",
        shape: "pill",
        width: 300,
        locale: "th",
      });
    } catch {
      /* ปุ่ม Google เป็นทางเลือกเสริม ไม่ต้องแจ้ง error */
    }
  }, [scriptReady, clientId, handleCredentialResponse]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (pending) return;
    setPending(true);
    setError("");
    const result = await callGasPublic<{ idToken: string }>("auth.login", { email, password });
    if (!result.ok || !result.data?.idToken) {
      setError(result.message || "เข้าสู่ระบบไม่สำเร็จ กรุณาลองอีกครั้ง");
      setPending(false);
      return;
    }
    saveGoogleSession(result.data.idToken);
    router.push("/protected");
  }

  return (
    <>
      <Script
        src="https://accounts.google.com/gsi/client"
        strategy="afterInteractive"
        onLoad={() => setScriptReady(true)}
      />
      <p className="eyebrow">ยินดีต้อนรับกลับมา</p>
      <h2 className="auth-title">เข้าสู่ระบบ</h2>
      <p className="auth-description">เข้าบัญชีของคุณ แล้วมาจัดวันให้ง่ายขึ้นกัน</p>
      <form onSubmit={submit} className="auth-form">
        <fieldset disabled={pending}>
          <div>
            <label htmlFor="email">อีเมล</label>
            <div className="auth-input-wrap">
              <Mail aria-hidden="true" />
              <input
                className="auth-input"
                id="email"
                name="email"
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
              />
            </div>
          </div>
          <div>
            <label htmlFor="password">รหัสผ่าน</label>
            <PasswordField id="password" value={password} onChange={setPassword} />
          </div>
          <div className="auth-form-links">
            <span>เข้าใช้งานด้วยบัญชีของคุณ</span>
            <Link href="/auth/forgot-password">ลืมรหัสผ่าน?</Link>
          </div>
          {error && (
            <p role="alert" className="form-error">
              {error}
            </p>
          )}
          <button className="primary-button auth-submit" type="submit">
            {pending ? <LoaderCircle className="animate-spin" /> : null}
            {pending ? "กำลังเข้าสู่ระบบ…" : "เข้าสู่ระบบ"}
            {!pending && <ArrowRight aria-hidden="true" />}
          </button>
        </fieldset>
      </form>
      <div className="auth-divider">
        <span>หรือ</span>
      </div>
      {clientId && (
        <div ref={buttonContainerRef} className="mb-3 flex min-h-[44px] items-center justify-center" />
      )}
      <Link href="/auth/sign-up" className="secondary-button auth-submit">
        สร้างบัญชีใหม่
      </Link>
    </>
  );
}
