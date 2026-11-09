"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { ArrowRight, LoaderCircle, Mail, Check } from "lucide-react";
import { PasswordField } from "@/components/auth/password-field";
import { callGasPublic, saveGoogleSession } from "@/lib/gas/client";

export function SignUpForm() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [repeat, setRepeat] = useState("");
  const [code, setCode] = useState("");
  const [needCode, setNeedCode] = useState(false);
  const [info, setInfo] = useState("");
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
    const result = await callGasPublic<{ idToken?: string; needCode?: boolean }>("auth.register", {
      email,
      password,
      code: needCode ? code : undefined,
    });
    setPending(false);
    if (!result.ok) {
      setError(result.message || "สร้างบัญชีไม่สำเร็จ กรุณาลองอีกครั้ง");
      return;
    }
    if (result.data?.needCode) {
      setNeedCode(true);
      setInfo(result.message || "ส่งรหัสยืนยันไปที่อีเมลแล้ว");
      return;
    }
    if (result.data?.idToken) {
      saveGoogleSession(result.data.idToken);
      router.push("/protected");
    }
  }

  return (
    <>
      <p className="eyebrow">เริ่มต้นวันใหม่อย่างเป็นระเบียบ</p>
      <h2 className="auth-title">สร้างบัญชี</h2>
      <p className="auth-description">พื้นที่ส่วนตัวสำหรับงานและโปรเจกต์ของคุณ</p>
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
                readOnly={needCode}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="auth-input"
                placeholder="you@example.com"
              />
            </div>
          </div>
          <div>
            <label htmlFor="password">รหัสผ่าน</label>
            <PasswordField id="password" value={password} onChange={setPassword} autoComplete="new-password" minLength={8} />
          </div>
          <div>
            <label htmlFor="repeat-password">ยืนยันรหัสผ่าน</label>
            <PasswordField id="repeat-password" value={repeat} onChange={setRepeat} autoComplete="new-password" minLength={8} />
          </div>
          {needCode && (
            <div>
              <label htmlFor="code">รหัสยืนยัน 6 หลักจากอีเมล</label>
              <div className="auth-input-wrap">
                <Check aria-hidden="true" />
                <input
                  id="code"
                  name="code"
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
          )}
          <p className="password-hint">
            <Check aria-hidden="true" />
            ใช้รหัสผ่านอย่างน้อย 8 ตัวอักษร
          </p>
          {info && !error && <p className="password-hint">{info}</p>}
          {error && (
            <p role="alert" className="form-error">
              {error}
            </p>
          )}
          <button className="primary-button auth-submit" type="submit">
            {pending ? <LoaderCircle className="animate-spin" /> : <ArrowRight aria-hidden="true" />}
            {pending ? "กำลังดำเนินการ…" : needCode ? "ยืนยันและสร้างบัญชี" : "ส่งรหัสยืนยันทางอีเมล"}
          </button>
        </fieldset>
      </form>
      <p className="auth-switch">
        มีบัญชีอยู่แล้ว? <Link href="/auth/login">เข้าสู่ระบบ</Link>
      </p>
    </>
  );
}
