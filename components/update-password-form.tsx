"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { LoaderCircle, LockKeyhole } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { PasswordField } from "@/components/auth/password-field";
import { authErrorMessage } from "@/components/auth/auth-error";
export function UpdatePasswordForm() {
  const router = useRouter();
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
      const { error } = await createClient().auth.updateUser({ password });
      if (error) throw error;
      router.push("/protected");
      router.refresh();
    } catch (e) {
      setError(authErrorMessage(e));
    } finally {
      setPending(false);
    }
  }
  return (
    <>
      <p className="eyebrow">กลับมาใช้งานได้อีกครั้ง</p>
      <h2 className="auth-title">ตั้งรหัสผ่านใหม่</h2>
      <p className="auth-description">
        ใช้รหัสผ่านอย่างน้อย 8 ตัวอักษรที่คุณยังไม่เคยใช้
      </p>
      <form className="auth-form" onSubmit={submit}>
        <fieldset disabled={pending}>
          <div>
            <label htmlFor="password">รหัสผ่านใหม่</label>
            <PasswordField
              id="password"
              value={password}
              onChange={setPassword}
              autoComplete="new-password"
              minLength={8}
            />
          </div>
          <div>
            <label htmlFor="repeat-password">ยืนยันรหัสผ่านใหม่</label>
            <PasswordField
              id="repeat-password"
              value={repeat}
              onChange={setRepeat}
              autoComplete="new-password"
              minLength={8}
            />
          </div>
          {error && (
            <p role="alert" className="form-error">
              {error}
            </p>
          )}
          <button className="primary-button auth-submit" type="submit">
            {pending ? (
              <LoaderCircle className="animate-spin" />
            ) : (
              <LockKeyhole />
            )}
            {pending ? "กำลังบันทึก…" : "บันทึกรหัสผ่านใหม่"}
          </button>
        </fieldset>
      </form>
    </>
  );
}
