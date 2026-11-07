import Link from "next/link";
import { CircleAlert } from "lucide-react";
import { AuthShell } from "@/components/auth/auth-shell";
export default function Page() {
  return (
    <AuthShell>
      <span className="dim-icon tone-rose">
        <CircleAlert />
      </span>
      <h2 className="auth-title mt-6">ยังเข้าใช้งานไม่ได้</h2>
      <p className="auth-description">
        ลิงก์อาจหมดอายุ หรือการยืนยันไม่สำเร็จ ลองเข้าสู่ระบบอีกครั้ง
        หรือขอลิงก์ตั้งรหัสผ่านใหม่
      </p>
      <Link className="primary-button auth-submit mt-8" href="/auth/login">
        กลับไปเข้าสู่ระบบ
      </Link>
      <Link
        className="secondary-button auth-submit mt-3"
        href="/auth/forgot-password"
      >
        ขอลิงก์ใหม่
      </Link>
    </AuthShell>
  );
}
