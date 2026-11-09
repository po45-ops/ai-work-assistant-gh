"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Mail, Send, MailCheck, LoaderCircle, Check } from "lucide-react";
import { PasswordField } from "@/components/auth/password-field";
import { callGasPublic, saveGoogleSession } from "@/lib/gas/client";

export function ForgotPasswordForm() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [password, setPassword] = useState("");
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);

  async function requestCode(e: React.FormEvent) {
    e.preventDefault();
    if (pending) return;
    setPending(true);
    setError("");
    const result = await callGasPublic("auth.forgot", { email });
    setPending(false);
    if (!result.ok) {
      setError(result.message || "ส่งรหัสไม่สำเร็จ กรุณาลองอีกครั้ง");
      return;
    }
    setSent(true);
  }

  async function resetPassword(e: React.FormEvent) {
    e.preventDefault();
    if (pending) return;
    setPending(true);
    setError("");
    const result = await callGasPublic<{ idToken?: string }>("auth.reset", { email, code, password });
    setPending(false);
    if (!result.ok || !result.data?.idToken) {
      setError(result.message || "ตั้งรหัสผ่านใหม่ไม่สำเร็จ");
      return;
    }
    saveGoogleSession(result.data.idToken);
    router.push("/protected");
  }

  return (
    <>
      <span className="dim-icon tone-sage">{sent ? <MailCheck /> : <Mail />}</span>
      <h2 className="auth-title mt-5">{sent ? "ตั้งรหัสผ่านใหม่" : "ลืมรหัสผ่าน?"}</h2>
      <p className="auth-description">
        {sent
          ? "หากอีเมลนี้มีบัญชีอยู่ จะได้รับรหัส 6 หลักทางอีเมล (ตรวจสอบสแปมด้วย) ใส่รหัสและรหัสผ่านใหม่ด้านล่าง"
          : "กรอกอีเมลที่ใช้สมัคร เราจะส่งรหัส 6 หลักให้คุณตั้งรหัสผ่านใหม่"}
      </p>
      {!sent ? (
        <form onSubmit={requestCode} className="auth-form">
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
              {pending ? "กำลังส่ง…" : "ส่งรหัสทางอีเมล"}
            </button>
          </fieldset>
        </form>
      ) : (
        <form onSubmit={resetPassword} className="auth-form">
          <fieldset disabled={pending}>
            <div>
              <label htmlFor="code">รหัส 6 หลักจากอีเมล</label>
              <div className="auth-input-wrap">
                <Check aria-hidden="true" />
                <input
                  id="code"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  required
                  maxLength={6}
                  value={code}
                  onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
                  className="auth-input"
                  placeholder="123456"
                />
              </div>
            </div>
            <div>
              <label htmlFor="new-password">รหัสผ่านใหม่</label>
              <PasswordField id="new-password" value={password} onChange={setPassword} autoComplete="new-password" minLength={8} />
            </div>
            {error && (
              <p className="form-error" role="alert">
                {error}
              </p>
            )}
            <button type="submit" className="primary-button auth-submit">
              {pending ? <LoaderCircle className="animate-spin" /> : <Check />}
              {pending ? "กำลังบันทึก…" : "ตั้งรหัสผ่านใหม่และเข้าสู่ระบบ"}
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
