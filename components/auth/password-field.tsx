"use client";
import { useState } from "react";
import { Eye, EyeOff, LockKeyhole } from "lucide-react";
export function PasswordField({
  id,
  value,
  onChange,
  autoComplete = "current-password",
  minLength,
}: {
  id: string;
  value: string;
  onChange: (value: string) => void;
  autoComplete?: string;
  minLength?: number;
}) {
  const [visible, setVisible] = useState(false);
  return (
    <div className="auth-input-wrap">
      <LockKeyhole aria-hidden="true" />
      <input
        id={id}
        name={id}
        type={visible ? "text" : "password"}
        required
        minLength={minLength}
        autoComplete={autoComplete}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="กรอกรหัสผ่าน"
        className="auth-input password-input"
      />
      <button
        type="button"
        aria-label={visible ? "ซ่อนรหัสผ่าน" : "แสดงรหัสผ่าน"}
        aria-pressed={visible}
        onClick={() => setVisible(!visible)}
        className="password-toggle"
      >
        {visible ? <EyeOff aria-hidden="true" /> : <Eye aria-hidden="true" />}
      </button>
    </div>
  );
}
