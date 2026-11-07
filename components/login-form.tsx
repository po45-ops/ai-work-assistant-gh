"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { ArrowRight, LoaderCircle, Mail } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { PasswordField } from "@/components/auth/password-field";
import { authErrorMessage } from "@/components/auth/auth-error";
export function LoginForm() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (pending) return;
    setPending(true);
    setError("");
    try {
      const { error } = await createClient().auth.signInWithPassword({
        email,
        password,
      });
      if (error) throw error;
      const next = new URLSearchParams(window.location.search).get("next");
      const destination =
        next &&
        next.startsWith("/") &&
        !next.startsWith("//") &&
        !next.includes("\\")
          ? next
          : "/protected";
      router.push(destination);
      router.refresh();
    } catch (e) {
      setError(authErrorMessage(e));
    } finally {
      setPending(false);
    }
  }
  return (
    <>
      <p className="eyebrow">ยินดีต้อนรับกลับมา</p>
      <h2 className="auth-title">เข้าสู่ระบบ</h2>
      <p className="auth-description">
        เข้าบัญชีของคุณ แล้วมาจัดวันให้ง่ายขึ้นกัน
      </p>
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
            <PasswordField
              id="password"
              value={password}
              onChange={setPassword}
            />
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
      <Link href="/auth/sign-up" className="secondary-button auth-submit">
        สร้างบัญชีใหม่
      </Link>
    </>
  );
}
