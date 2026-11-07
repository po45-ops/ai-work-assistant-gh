import Image from "next/image";
import Link from "next/link";
import { CalendarDays, Check, MessageCircle, ShieldCheck } from "lucide-react";
import { Brand } from "@/components/brand";
export function AuthShell({ children }: { children: React.ReactNode }) {
  return (
    <main className="auth-page">
      <div className="auth-layout">
        <section className="auth-story" aria-label="เกี่ยวกับผู้ช่วยจัดงาน">
          <Image
            src="/images/po-workspace.webp"
            alt="กระต่ายโปกับโต๊ะทำงาน ปฏิทิน และคอมพิวเตอร์ ในห้องแสงอบอุ่น"
            fill
            fetchPriority="high"
            sizes="(min-width: 1024px) 50vw, 100vw"
            className="auth-art"
          />
          <div className="auth-story-content">
            <Link href="/auth/login" aria-label="AI Work Assistant">
              <Brand />
            </Link>
            <div className="auth-copy">
              <p className="eyebrow">พื้นที่เล็ก ๆ สำหรับวันที่เป็นระเบียบ</p>
              <h1>
                จัดการงาน โปรเจกต์
                <br className="hidden sm:block" /> และเวลาของคุณ
                <br />
                <span>ให้เป็นระบบ</span>
              </h1>
              <p className="auth-intro">
                มีโปช่วยดูแลงานและนัดหมาย
                <br />
                เชื่อม Google Calendar และ LINE
                <br />
                ให้คุณมีเวลาทำสิ่งสำคัญได้มากขึ้น
              </p>
              <ul className="auth-benefits">
                {[
                  "จัดการงานและโปรเจกต์",
                  "เห็นกำหนดการในที่เดียว",
                  "จดไอเดียไว้ได้ทันที",
                ].map((text) => (
                  <li key={text}>
                    <Check aria-hidden="true" />
                    {text}
                  </li>
                ))}
              </ul>
            </div>
            <div className="auth-services">
              <div>
                <span className="dim-icon tone-sage">
                  <CalendarDays aria-hidden="true" />
                </span>
                <span>
                  <strong>Google Calendar</strong>
                  <small>งานและนัดหมายของคุณ</small>
                </span>
              </div>
              <div>
                <span className="dim-icon tone-sage">
                  <MessageCircle aria-hidden="true" />
                </span>
                <span>
                  <strong>LINE AI</strong>
                  <small>คุยกับโปและติดตามงาน</small>
                </span>
              </div>
            </div>
          </div>
        </section>
        <section className="auth-form-area">
          <div className="auth-mobile-brand">
            <Brand />
            <span className="auth-mobile-art">
              <Image
                src="/images/po-workspace.webp"
                alt="โป ผู้ช่วยจัดงาน"
                fill
                sizes="72px"
              />
            </span>
          </div>
          <div className="auth-form-card">
            {children}
            <p className="auth-privacy">
              <ShieldCheck aria-hidden="true" />
              ข้อมูลส่วนตัว แยกตามบัญชีของคุณ
            </p>
          </div>
          <p className="auth-footer">
            จัดการงานได้ทุกที่ ทั้งคอมพิวเตอร์ แท็บเล็ต และมือถือ
          </p>
        </section>
      </div>
    </main>
  );
}
