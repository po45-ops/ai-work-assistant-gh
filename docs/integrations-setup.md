# ตั้งค่า Google Calendar และ LINE AI

โค้ดส่วนเชื่อมต่อพร้อมใช้งานหลังตั้งค่าบริการภายนอกและ Supabase ตามรายการนี้ ไม่มีคีย์หรือโทเคนจริงเก็บใน repository

## 1. เตรียม Supabase

1. เปิด SQL Editor ของ Supabase แล้วรันไฟล์ supabase/migrations/202609270001_integrations.sql
2. คัดลอก URL, publishable key และ service role key จาก Project Settings → API
3. สร้างคีย์เข้ารหัสด้วยคำสั่ง openssl rand -base64 32 เก็บผลลัพธ์เป็นความลับ คีย์นี้ใช้เข้ารหัส Google refresh token ในฐานข้อมูล

## 2. ตั้งค่า Google Calendar

1. ใน Google Cloud Console เลือกโปรเจกต์และเปิด Google Calendar API
2. ตั้ง OAuth consent screen และสร้าง OAuth Client ID ชนิด Web application
3. เพิ่ม Authorized redirect URI ให้ตรงกับ GOOGLE_REDIRECT_URI ทุกตัวอักษร เช่น https://your-domain.example/api/integrations/google/callback และ URL สำหรับ local development
4. ในหน้า consent เพิ่ม scope openid, email และ https://www.googleapis.com/auth/calendar.events.owned จากนั้นเพิ่มบัญชีผู้ทดสอบหาก consent screen ยังอยู่ในโหมดทดสอบ
5. ใส่ Client ID, Client secret และ redirect URI ใน environment variables ของ deployment

ระบบอ่านกิจกรรมรายเดือนจาก primary calendar และสร้าง/แก้ไขกิจกรรมตลอดวันจากงานที่สร้างหรือแก้หลังเชื่อมและมีวันครบกำหนด ส่วนกิจกรรมที่ผู้ใช้เพิ่มเองใน Google จะแสดงเป็นลิงก์เปิด Google Calendar

## 3. ตั้งค่า LINE AI

1. สร้าง LINE Official Account และ Messaging API channel แล้วเปิดใช้ webhook
2. ตั้ง Webhook URL เป็น https://your-domain.example/api/webhooks/line และเปิดการใช้ webhook
3. คัดลอก Channel secret, Channel access token และ Basic ID ของ Official Account ไปยัง environment variables
4. สร้าง Gemini API key แล้วตั้ง GEMINI_API_KEY; แชตทั่วไปใช้ `gemini-3.5-flash-lite` และสลับไป `gemini-3.1-flash-lite` หากติดโควตาหรือบริการขัดข้อง ส่วนข้อความที่ขอวิเคราะห์/วางแผนอย่างละเอียดจะใช้ `gemini-3.8-flash` ก่อน แล้วค่อยไล่ไปยังรุ่นสำรอง ค่าเหล่านี้เปลี่ยนได้ด้วย `GEMINI_PRIMARY_MODEL`, `GEMINI_FALLBACK_MODEL` และ `GEMINI_COMPLEX_MODEL` ตามลำดับ; ค่า `GEMINI_MODEL` เดิมจะไม่ถูกใช้แล้ว
5. เมื่อตั้งค่าและ deploy แล้ว เข้า Settings → สร้างรหัสเชื่อม LINE แล้วส่งข้อความ เชื่อม CODE ให้ Official Account ภายใน 10 นาที

Webhook ตรวจลายเซ็นจาก LINE ก่อนอ่านข้อความ บันทึกประวัติแยกตามบัญชี และส่งข้อความล่าสุดพร้อมสรุปงาน โปรเจกต์ Milestone และนัดหมาย 14 วันข้างหน้าที่เกี่ยวข้องให้ Gemini เพื่อช่วยตอบต่อ ผู้ใช้แต่ละคนต้องเชื่อม LINE และ Google ของตนเอง ข้อมูลงาน ปฏิทิน และประวัติแชทถูกอ่านด้วย user ID ของเจ้าของเท่านั้น

เพิ่ม migration `supabase/migrations/202609270003_line_voice_consent.sql` ก่อน deploy รุ่นที่รองรับเสียง ใน Settings ผู้ใช้แต่ละคนเปิด “ส่งเสียงคุยกับโป” ได้เอง ไฟล์เสียงจาก LINE จะถูกส่งให้ Gemini เพื่อถอดความ/ตอบคำถาม และเก็บเฉพาะข้อความถอดเสียงในประวัติแชท ไฟล์เสียงไม่ถูกเก็บในฐานข้อมูล ทุกคำสั่งเพิ่มหรือแก้งาน/นัดหมายยังถามยืนยันก่อนเสมอ

## 4. Environment variables

เพิ่มตัวแปรตามชื่อใน .env.example ให้กับ local environment และ deployment environment แล้ว redeploy ค่า SUPABASE_SERVICE_ROLE_KEY, encryption key และคีย์ผู้ให้บริการต้องเก็บฝั่ง server เท่านั้น ห้ามใช้ prefix NEXT_PUBLIC_ หรือ commit ค่าจริงลง Git

หลังตั้งค่า ให้ทดสอบจาก Settings: เชื่อม Google แล้วสร้าง/แก้งานที่มี due date จากหน้า Tasks; เชื่อม LINE แล้วทดลองสนทนา เพิ่มงาน และยืนยันการสร้างกิจกรรมใน Google Calendar
# LINE daily task digest

Apply migrations `202609270002_line_daily_digest.sql` and `202609270003_line_voice_consent.sql`, then add a random `CRON_SECRET` in the Vercel Production environment and redeploy. The scheduled endpoint sends one concise task digest per opted-in, linked LINE account, and skips accounts with no open tasks. On Sundays the 18:00 digest also previews work due in the next seven days and important work without a deadline. Users can enable or disable the digest in Settings → Connected services. On Vercel Hobby, a daily cron scheduled for 18:00 Bangkok can run at any point during the 18:00 hour.
