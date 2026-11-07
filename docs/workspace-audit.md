# AI Personal Work Assistant — สถานะงานพัฒนาระบบ

วันที่ 27 กันยายน 2026 · repository `po45-ops/ai-personal-work-assistant` · branch `main`.

## สิ่งที่เชื่อมกับข้อมูลจริงแล้ว

- **Dashboard:** งานวันนี้ งานสำคัญ งานเลยกำหนด โปรเจกต์ที่กำลังทำ ข้อความ Inbox ที่รอ และรายการงาน/โปรเจกต์ที่ควรดูต่อ.
- **Tasks:** อ่าน ค้นหา กรอง แบ่งหน้า เพิ่ม แก้ไข ทำเสร็จ และนำกลับมาทำ. งานเสร็จใช้ trigger และระยะเก็บข้อมูลเดิมของบัญชี.
- **Projects:** อ่าน ค้นหา กรอง สร้าง แก้ไข เปลี่ยนสถานะ และเปิดรายละเอียดโปรเจกต์. เพิ่ม/แก้ไข Milestone และดู Tasks ที่เชื่อมอยู่ได้.
- **Calendar:** แสดงวันครบกำหนดของ Tasks และ Milestones รวมถึงวันเป้าหมายของ Projects. เลือกเดือนได้และเปิดรายการตามวันที่.
- **Inbox:** บันทึกข้อความ ค้นหา กรองสถานะ และดูสรุป/คำถามเพิ่มเติมที่ตัวประมวลผลอาจบันทึกไว้.
- **Reports:** นับงานที่เสร็จในแต่ละวันย้อนหลัง 7 วัน งานที่เปิด/เลยกำหนด และจำนวน Projects ตามสถานะ.
- **Settings:** แสดงบัญชีและบันทึกเวลาทำงาน ความจุต่อวัน ช่วงโฟกัส/พัก จำนวนงานสำคัญ และการรวมวันหยุด; แสดงระยะเก็บงานเสร็จของบัญชี.

ทั้ง 7 routes ยังคงแยกกันจริง ใช้ Supabase Auth เดิม และจำกัดข้อมูลด้วย `user_id`/RLS ที่ตรวจในฐานข้อมูล. ไม่มีการเพิ่มตารางหรือ schema migration.

## การเชื่อมต่อที่ยังไม่มี

- Inbox ยังบันทึกข้อความเป็น `pending`; ไม่มี AI parser ที่แปลงข้อความเป็น Tasks อัตโนมัติ.
- Calendar แสดง deadline ของข้อมูลที่มี; ยังไม่มีการจัดช่วงเวลาอัตโนมัติหรือซิงก์ Google Calendar.
- Reports ยังไม่มี focus-time tracking หรือ AI insights.
- Settings บันทึกค่าที่เก็บไว้เพื่อการวางแผนในอนาคต; planner ยังไม่ได้ใช้ค่าดังกล่าวจัดตาราง.

## ฐานข้อมูลและความปลอดภัย

- ใช้ตารางเดิม `tasks`, `projects`, `milestones`, `inbox`, `settings` และ policies ของผู้ใช้แต่ละคน.
- ทุก server action ตรวจ session; actions ตรวจ ownership และใช้ `updated_at` ป้องกันการเขียนทับค่าที่เปลี่ยนไปแล้ว.
- ไม่มีการเปลี่ยน Auth, keys, RLS หรือ triggers. งานเสร็จเก็บตามค่า `retention_completed_days` เดิม (ค่าเริ่มต้น 30 วัน).
- บันทึก schema contract แต่ละโมดูลไว้ใน `docs/*-data-contract.md`.

## ตรวจการทำงานและเผยแพร่

- `npm run build`: ผ่านหลังการเปลี่ยนแปลงทุกโมดูล รวม TypeScript และ protected routes.
- `npm run lint`: ผ่าน.
- browser จริงที่เข้าสู่ระบบแล้ว: ทดสอบเพิ่ม/แก้ไขโปรเจกต์, เพิ่ม/แก้ไข Milestone, เชื่อม Task กับ Project, ดูกำหนดการใน Calendar, บันทึก Inbox และอ่าน Reports.
- Settings บันทึกค่าเริ่มต้นได้; ตรวจฐานข้อมูลพบ 1 แถว และค่า retention ยังคง 30 วัน.
- push ล่าสุดขึ้น `main`: `0325804 Connect dashboard summaries to Supabase data`.
- Vercel production deployment จาก commit ล่าสุดเป็น `Ready`: [เปิดเว็บ](https://ai-personal-work-assistant-nine.vercel.app) · [หน้า Dashboard](https://ai-personal-work-assistant-nine.vercel.app/protected).

## ข้อมูลที่ใช้ตรวจบน production

มีข้อมูลทดสอบที่สร้างระหว่างตรวจการทำงานอยู่ในบัญชี production: โปรเจกต์ `ทดสอบ Projects Codex 20260927`, Milestone `ร่างแผนทดสอบ`, ข้อความ Inbox `ทดสอบ Inbox Codex 20260927: ติดตามแผนทดสอบก่อน 5 ตุลาคม`, และ Task `ทดสอบ Tasks Codex 20260927 50%_` ที่เชื่อมกับโปรเจกต์. ไม่ได้ลบข้อมูลเหล่านี้.

## Addendum: Google Calendar และ LINE AI

หลังการตรวจข้างต้น เพิ่มโค้ดเชื่อมต่อ Google Calendar และ LINE AI ใน branch feat/google-line-integrations แล้ว:

- Google OAuth ใช้ scope `calendar.events.owned`; เก็บ refresh token แบบเข้ารหัส, แสดงกิจกรรมใน Calendar และซิงก์วันครบกำหนดจากงานที่สร้างหรือแก้หลังเชื่อม
- LINE webhook ตรวจลายเซ็น, ผูกบัญชีด้วยรหัสใช้ครั้งเดียว, เก็บประวัติแชท และส่งบริบทงาน/โปรเจกต์/Milestone/Google Calendar ของผู้ใช้คนนั้นให้ Gemini
- LINE AI ช่วยตอบคำถาม เพิ่มงาน เลื่อนงาน ทำเครื่องหมายงานเสร็จ และสร้างกิจกรรมใน Google Calendar; ทุกการเปลี่ยนข้อมูลต้องยืนยันก่อน
- เพิ่ม migration `supabase/migrations/202609270001_integrations.sql` และคู่มือตั้งค่าที่ `docs/integrations-setup.md`

โค้ดผ่าน `npm run build`, `npm run lint` และ `npm test` ใน checkout ของ branch นี้แล้ว การเชื่อมบัญชีจริงยังต้องใช้ migration และ credentials ของเจ้าของบริการจาก Supabase, Google Cloud, LINE Developers และ Gemini ก่อน deploy; สถานะ production ในส่วนก่อนหน้านี้จึงยังเป็นข้อมูลจากการตรวจครั้งเดิม.
