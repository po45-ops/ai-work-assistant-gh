import Link from "next/link";
import { MailCheck } from "lucide-react";
import { AuthShell } from "@/components/auth/auth-shell";
export default function Page() {
  return (
    <AuthShell>
      <span className="dim-icon tone-sage">
        <MailCheck />
      </span>
      <h2 className="auth-title mt-6">สร้างบัญชีแล้ว</h2>
      <p className="auth-description">
        เปิดอีเมลแล้วกดลิงก์ยืนยันบัญชีก่อนเข้าสู่ระบบ หากยังไม่พบอีเมล
        ลองตรวจสอบในกล่องสแปม
      </p>
      <Link className="primary-button auth-submit mt-8" href="/auth/login">
        ไปหน้าเข้าสู่ระบบ
      </Link>
    </AuthShell>
  );
}
