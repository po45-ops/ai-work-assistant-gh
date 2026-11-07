"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { ArrowRight, LoaderCircle, Mail, Check } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { PasswordField } from "@/components/auth/password-field";
import { authErrorMessage } from "@/components/auth/auth-error";
export function SignUpForm() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [repeat, setRepeat] = useState("");
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (pending) return;
    setError("");
    if (password !== repeat) {
      setError("รหัสผ่านทั้งสองช่องไม่ตรงกัน");
      return;
    }
    setPending(true);
    try {
      const { error } = await createClient().auth.signUp({
        email,
        password,
        options: { emailRedirectTo: `${window.location.origin}/protected` },
      });
      if (error) throw error;
      router.push("/auth/sign-up-success");
    } catch (e) {
      setError(authErrorMessage(e));
    } finally {
      setPending(false);
    }
  }
  return (
    <>
      <p className="eyebrow">เริ่มต้นวันใหม่อย่างเป็นระเบียบ</p>
      <h2 className="auth-title">สร้างบัญชี</h2>
      <p className="auth-description">
        พื้นที่ส่วนตัวสำหรับงานและโปรเจกต์ของคุณ
      </p>
      <form onSubmit={submit} className="auth-form">
        <fieldset disabled={pending}>
          <div>
            <label htmlFor="email">อีเมล</label>
            <div className="auth-input-wrap">
              <Mail aria-hidden="true" />
              <input
                id="email"
                name="email"
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
          <div>
            <label htmlFor="password">รหัสผ่าน</label>
            <PasswordField
              id="password"
              value={password}
              onChange={setPassword}
              autoComplete="new-password"
              minLength={8}
            />
          </div>
          <div>
            <label htmlFor="repeat-password">ยืนยันรหัสผ่าน</label>
            <PasswordField
              id="repeat-password"
              value={repeat}
              onChange={setRepeat}
              autoComplete="new-password"
              minLength={8}
            />
          </div>
          <p className="password-hint">
            <Check aria-hidden="true" />
            ใช้รหัสผ่านอย่างน้อย 8 ตัวอักษร
          </p>
          {error && (
            <p role="alert" className="form-error">
              {error}
            </p>
          )}
          <button className="primary-button auth-submit" type="submit">
            {pending ? (
              <LoaderCircle className="animate-spin" />
            ) : (
              <ArrowRight aria-hidden="true" />
            )}
            {pending ? "กำลังสร้างบัญชี…" : "สร้างบัญชี"}
          </button>
        </fieldset>
      </form>
      <p className="auth-switch">
        มีบัญชีอยู่แล้ว? <Link href="/auth/login">เข้าสู่ระบบ</Link>
      </p>
    </>
  );
}
