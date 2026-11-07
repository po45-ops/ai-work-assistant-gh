"use client";
import Link from "next/link";
import { useState } from "react";
import { Mail, Send, MailCheck, LoaderCircle } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { authErrorMessage } from "@/components/auth/auth-error";
export function ForgotPasswordForm() {
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);
  const [success, setSuccess] = useState(false);
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (pending) return;
    setPending(true);
    setError("");
    try {
      const { error } = await createClient().auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/auth/update-password`,
      });
      if (error) throw error;
      setSuccess(true);
    } catch (e) {
      setError(authErrorMessage(e));
    } finally {
      setPending(false);
    }
  }
  return (
    <>
      <span className="dim-icon tone-sage">
        {success ? <MailCheck /> : <Mail />}
      </span>
      <h2 className="auth-title mt-5">
        {success ? "ตรวจสอบอีเมลของคุณ" : "ลืมรหัสผ่าน?"}
      </h2>
      <p className="auth-description">
        {success
          ? "หากอีเมลนี้มีบัญชีอยู่ คุณจะได้รับลิงก์สำหรับตั้งรหัสผ่านใหม่ กรุณาตรวจสอบกล่องจดหมายและสแปม"
          : "กรอกอีเมลที่ใช้สมัคร เราจะส่งลิงก์ให้คุณตั้งรหัสผ่านใหม่"}
      </p>
      {!success && (
        <form onSubmit={submit} className="auth-form">
          <fieldset disabled={pending}>
            <div>
              <label htmlFor="email">อีเมล</label>
              <div className="auth-input-wrap">
                <Mail />
                <input
                  id="email"
                  type="email"
                  autoComplete="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="auth-input"
                  placeholder="you@example.com"
                />
              </div>
            </div>
            {error && (
              <p className="form-error" role="alert">
                {error}
              </p>
            )}
            <button type="submit" className="primary-button auth-submit">
              {pending ? <LoaderCircle className="animate-spin" /> : <Send />}
              {pending ? "กำลังส่ง…" : "ส่งลิงก์ตั้งรหัสผ่านใหม่"}
            </button>
          </fieldset>
        </form>
      )}
      <p className="auth-switch">
        <Link href="/auth/login">กลับไปเข้าสู่ระบบ</Link>
      </p>
    </>
  );
}
