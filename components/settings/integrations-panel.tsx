"use client";

import { useState } from "react";
import { CalendarDays, Check, ExternalLink, Link2, LoaderCircle, MessageCircle, RefreshCw, Unlink } from "lucide-react";
import { callGasApi, notifyWorkspaceDataChanged } from "@/lib/gas/client";
import type { RecentLineMessage } from "@/lib/integrations/data";

type Integration = {
  googleConfigured: boolean;
  lineConfigured: boolean;
  dataReady: boolean;
  googleConnected: boolean;
  googleEmail: string | null;
  lineConnected: boolean;
  lineDisplayName: string | null;
  lineDailyDigestEnabled: boolean;
  lineVoiceEnabled: boolean;
  lineVoiceAvailable: boolean;
  recentMessages: RecentLineMessage[];
  integrationNotice: string | null;
};

export function IntegrationsPanel({ integration }: { integration: Integration }) {
  const [pending, setPending] = useState<"google" | "line" | "digest" | "voice" | "history" | null>(null);
  const [notice, setNotice] = useState("");
  const [linkCode, setLinkCode] = useState<{ code: string; lineUrl: string | null } | null>(null);

  async function connectGoogle() {
    setPending("google");
    setNotice("");
    try {
      const result = await callGasApi("integrations.google.connect");
      if (!result.ok) throw new Error(result.message);
      setNotice("เชื่อม Google Calendar สำเร็จแล้ว");
      notifyWorkspaceDataChanged();
    } catch {
      setNotice("เชื่อม Google Calendar ไม่สำเร็จ กรุณาลองอีกครั้ง");
    } finally {
      setPending(null);
    }
  }

  async function disconnect(provider: "google" | "line") {
    setPending(provider);
    setNotice("");
    try {
      const result = await callGasApi(`integrations.${provider}.disconnect`);
      if (!result.ok) throw new Error();
      setNotice(provider === "google" ? "ยกเลิกการเชื่อม Google Calendar แล้ว" : "ยกเลิกการเชื่อม LINE แล้ว");
      setLinkCode(null);
      notifyWorkspaceDataChanged();
    } catch {
      setNotice("ทำรายการไม่สำเร็จ กรุณาลองอีกครั้ง");
    } finally {
      setPending(null);
    }
  }

  async function startLineLink() {
    setPending("line");
    setNotice("");
    try {
      const result = await callGasApi("integrations.line.link");
      if (!result.ok || !result.code) throw new Error(result.message);
      setLinkCode({ code: result.code, lineUrl: result.lineUrl ?? null });
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "สร้างรหัสเชื่อม LINE ไม่สำเร็จ");
    } finally {
      setPending(null);
    }
  }

  async function clearHistory() {
    if (!window.confirm("ลบประวัติสนทนา LINE ทั้งหมดของบัญชีนี้หรือไม่?")) return;
    setPending("history");
    setNotice("");
    try {
      const result = await callGasApi("integrations.line.clearHistory");
      if (!result.ok) throw new Error();
      setNotice("ลบประวัติสนทนา LINE แล้ว");
      notifyWorkspaceDataChanged();
    } catch {
      setNotice("ลบประวัติไม่สำเร็จ กรุณาลองอีกครั้ง");
    } finally {
      setPending(null);
    }
  }

  async function setDailyDigest(enabled: boolean) {
    setPending("digest");
    setNotice("");
    try {
      const result = await callGasApi("integrations.line.digest", { enabled });
      if (!result.ok) throw new Error();
      setNotice(enabled ? "เปิดสรุปงานทาง LINE ทุกวันแล้ว" : "ปิดสรุปงานทาง LINE แล้ว");
      notifyWorkspaceDataChanged();
    } catch {
      setNotice("ตั้งค่าสรุปงานรายวันไม่สำเร็จ กรุณาลองอีกครั้ง");
    } finally {
      setPending(null);
    }
  }

  async function setVoiceProcessing(enabled: boolean) {
    if (enabled && !window.confirm("เมื่อเปิดใช้ ข้อความเสียงที่คุณส่งหา LINE ของโปจะถูกส่งไปยัง Google Gemini เพื่อถอดความและช่วยตอบหรือบันทึกงาน ระบบจะเก็บเฉพาะข้อความถอดความไว้ในประวัติแชท ไม่เก็บไฟล์เสียง เปิดใช้หรือไม่?")) return;
    setPending("voice");
    setNotice("");
    try {
      const result = await callGasApi("integrations.line.voice", { enabled, consent: enabled });
      if (!result.ok) throw new Error();
      setNotice(enabled ? "เปิดรับข้อความเสียงแล้ว" : "ปิดรับข้อความเสียงแล้ว");
      notifyWorkspaceDataChanged();
    } catch {
      setNotice("ตั้งค่าข้อความเสียงไม่สำเร็จ กรุณาลองอีกครั้ง");
    } finally {
      setPending(null);
    }
  }

  return <section className="mb-5 rounded-[24px] border border-[#e8ddd2] bg-[#fffdfa] p-5 premium-shadow sm:p-6">
    <div className="mb-5"><p className="text-sm font-semibold tracking-wider text-[#8f6447]">CONNECTED SERVICES</p><h2 className="mt-1 text-xl font-bold">เชื่อมต่อบริการ (Apps Script)</h2><p className="mt-1 text-sm leading-6 text-[#705c4d]">เชื่อมปฏิทินและคุยกับผู้ช่วยผ่าน LINE ได้จากที่เดียว</p></div>
    <div className="grid gap-4 lg:grid-cols-2">
      <article className="rounded-2xl border border-[#eee4db] bg-[#fffaf5] p-4">
        <div className="flex items-start gap-3"><span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#e9f0e8] text-[#47644c]"><CalendarDays className="h-5 w-5" /></span><div className="min-w-0 flex-1"><h3 className="font-bold">Google Calendar</h3><p className="mt-1 text-sm leading-6 text-[#705c4d]">{integration.googleConnected ? "เชื่อมแล้ว" + (integration.googleEmail ? " · " + integration.googleEmail : "") + " กำหนดการจะแสดงในหน้า Calendar และงานที่สร้างหรือแก้ไขจะมีกิจกรรมในปฏิทิน" : "แสดงนัดหมายใน Calendar และซิงก์วันครบกำหนดของงานผ่าน Apps Script CalendarApp"}</p></div></div>
        <div className="mt-4">{integration.googleConnected ? <button type="button" onClick={() => disconnect("google")} disabled={pending !== null} className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-[#dfd0c2] bg-white px-4 text-sm font-semibold text-[#604a3b] disabled:opacity-50">{pending === "google" ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Unlink className="h-4 w-4" />}ยกเลิกการเชื่อม</button> : <button type="button" onClick={connectGoogle} disabled={pending !== null} className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-[#8f6447] px-4 text-sm font-semibold text-white">{pending === "google" ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <CalendarDays className="h-4 w-4" />}เปิดซิงก์ Google Calendar</button>}</div>
      </article>
      <article className="rounded-2xl border border-[#eee4db] bg-[#fffaf5] p-4">
        <div className="flex items-start gap-3"><span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#e7f2ec] text-[#28734f]"><MessageCircle className="h-5 w-5" /></span><div className="min-w-0 flex-1"><h3 className="font-bold">LINE AI</h3><p className="mt-1 text-sm leading-6 text-[#705c4d]">{integration.lineConnected ? "เชื่อม LINE แล้ว พูดคุยและสั่งเพิ่มงานได้" : "คุยกับ AI เพื่อบันทึกงาน ถามความคืบหน้า และสร้างนัดหมาย"}</p></div></div>
        <div className="mt-4 flex flex-wrap gap-2">{integration.lineConnected ? <button type="button" onClick={() => disconnect("line")} disabled={pending !== null} className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-[#dfd0c2] bg-white px-4 text-sm font-semibold text-[#604a3b] disabled:opacity-50">{pending === "line" ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Unlink className="h-4 w-4" />}ยกเลิกการเชื่อม</button> : <button type="button" onClick={startLineLink} disabled={pending !== null} className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-[#28734f] px-4 text-sm font-semibold text-white disabled:opacity-50">{pending === "line" ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Link2 className="h-4 w-4" />}สร้างรหัสเชื่อม LINE</button>}
          <button type="button" onClick={() => notifyWorkspaceDataChanged()} className="inline-flex min-h-11 items-center gap-2 rounded-xl px-3 text-sm font-semibold text-[#8f6447]"><RefreshCw className="h-4 w-4" />รีเฟรชสถานะ</button>
        </div>
        {linkCode && <div className="mt-4 rounded-xl border border-[#d4e6d8] bg-[#f1f8f2] p-4"><p className="text-sm font-semibold text-[#385640]">ส่งข้อความส่วนตัวนี้หา LINE Official Account ภายใน 10 นาที</p><p className="mt-2 font-mono text-lg font-bold tracking-wider text-[#28734f]">เชื่อม {linkCode.code}</p>{linkCode.lineUrl ? <a href={linkCode.lineUrl} target="_blank" rel="noreferrer" className="mt-3 inline-flex min-h-10 items-center gap-2 text-sm font-semibold text-[#28734f]">เปิด LINE <ExternalLink className="h-4 w-4" /></a> : <p className="mt-2 text-sm text-[#705c4d]">ค้นหา LINE Official Account ของระบบ แล้วส่งรหัสนี้ในแชท</p>}</div>}
        {integration.lineConnected && <div className="mt-4 flex items-center justify-between gap-4 rounded-xl border border-[#e8ddd2] bg-white p-3">
          <div><p className="text-sm font-semibold text-[#4b3b30]">สรุปงานทาง LINE ทุกวัน 18:00 (Time Trigger)</p><p className="mt-1 text-xs leading-5 text-[#705c4d]">ส่งเฉพาะวันที่มีงานค้างด้วย Google Apps Script Time-driven Trigger</p></div>
          <button type="button" role="switch" aria-checked={integration.lineDailyDigestEnabled} aria-label="สรุปงานทาง LINE ทุกวัน" onClick={() => setDailyDigest(!integration.lineDailyDigestEnabled)} disabled={pending !== null} className={`relative h-7 w-12 shrink-0 rounded-full transition-colors disabled:opacity-50 ${integration.lineDailyDigestEnabled ? "bg-[#28734f]" : "bg-[#d9cfc6]"}`}>
            <span className={`absolute top-1 h-5 w-5 rounded-full bg-white shadow transition-transform ${integration.lineDailyDigestEnabled ? "translate-x-6" : "translate-x-1"}`} />
          </button>
        </div>}
        {integration.lineConnected && <div className="mt-3 flex items-center justify-between gap-4 rounded-xl border border-[#e8ddd2] bg-white p-3">
          <div><p className="text-sm font-semibold text-[#4b3b30]">ส่งเสียงคุยกับโป</p><p className="mt-1 text-xs leading-5 text-[#705c4d]">เมื่อเปิด เสียงจะถูกส่งให้ Google Gemini แปลงเป็นข้อความ</p></div>
          <button type="button" role="switch" aria-checked={integration.lineVoiceEnabled} aria-label="ส่งเสียงคุยกับโป" onClick={() => setVoiceProcessing(!integration.lineVoiceEnabled)} disabled={pending !== null} className={`relative h-7 w-12 shrink-0 rounded-full transition-colors disabled:opacity-50 ${integration.lineVoiceEnabled ? "bg-[#28734f]" : "bg-[#d9cfc6]"}`}>
            <span className={`absolute top-1 h-5 w-5 rounded-full bg-white shadow transition-transform ${integration.lineVoiceEnabled ? "translate-x-6" : "translate-x-1"}`} />
          </button>
        </div>}
      </article>
    </div>
    {notice && <p role={notice.includes("ไม่สำเร็จ") ? "alert" : "status"} className={notice.includes("ไม่สำเร็จ") ? "mt-4 rounded-xl bg-[#fde5dd] p-3 text-sm text-[#933f30]" : "mt-4 rounded-xl bg-[#e5eee6] p-3 text-sm text-[#385640]"}>{notice}</p>}
    {integration.recentMessages.length > 0 && <details className="mt-4 rounded-xl border border-[#eee4db] bg-white">
      <summary className="flex min-h-12 cursor-pointer list-none items-center gap-2 px-4 text-sm font-semibold text-[#604a3b]"><Check className="h-4 w-4 text-[#8f6447]" />ประวัติสนทนา LINE ล่าสุด ({integration.recentMessages.length})</summary>
      <ol className="space-y-3 border-t border-[#eee4db] p-4">{integration.recentMessages.slice().reverse().map((message, index) => <li key={message.created_at + "-" + index} className="rounded-xl bg-[#fffaf5] p-3"><p className="text-xs font-semibold text-[#8f6447]">{message.role === "user" ? "คุณ" : "AI"} · {new Intl.DateTimeFormat("th-TH", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Bangkok" }).format(new Date(message.created_at))}</p><p className="mt-1 whitespace-pre-wrap break-words text-sm leading-6 text-[#4b3b30]">{message.content}</p></li>)}</ol>
      <div className="border-t border-[#eee4db] p-4"><button type="button" onClick={clearHistory} disabled={pending !== null} className="inline-flex min-h-10 items-center gap-2 rounded-xl px-3 text-sm font-semibold text-[#933f30] disabled:opacity-50">{pending === "history" ? <LoaderCircle className="h-4 w-4 animate-spin" /> : null}ลบประวัติสนทนาทั้งหมด</button></div>
    </details>}
  </section>;
}
