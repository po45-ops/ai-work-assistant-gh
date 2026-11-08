# คู่มือการตั้งค่า Po · AI Work Assistant (GitHub Pages + Google Sheets + Apps Script)

เอกสารนี้สรุปขั้นตอนการตั้งค่าระบบใหม่ทั้งหมดโดยไม่ต้องพึ่งพา Vercel และ Supabase

---

## 1. การตั้งค่า Google Sheet และ Google Apps Script

1. ไฟล์ **Google Sheet** ถูกสร้างและตั้งค่าครบทั้ง 9 แท็บให้เรียบร้อยแล้วที่:
   - **ชื่อไฟล์**: `Po AI Work Assistant DB`
   - **Spreadsheet ID**: `1x6ZIC-9yrrRWBCTj1LtHkQokvJvlaDIGZPMlOc1yfeQ`
   - **ลิงก์เปิดไฟล์**: https://docs.google.com/spreadsheets/d/1x6ZIC-9yrrRWBCTj1LtHkQokvJvlaDIGZPMlOc1yfeQ/edit
2. ที่เมนูด้านบนของ Google Sheet เลือก **Extensions (ส่วนขยาย) > Apps Script**
3. ในหน้าต่าง Apps Script:
   - เปิดการตั้งค่าโปรเจกต์ (ไอคอนฟันเฟือง **Project Settings** ด้านซ้าย) แล้วติ๊กเปิด **"Show 'appsscript.json' manifest file in editor"**
   - คัดลอกเนื้อหาจากไฟล์ [`apps-script/appsscript.json`](../apps-script/appsscript.json) ไปวางทับไฟล์ `appsscript.json` ใน Apps Script
   - คัดลอกเนื้อหาจากไฟล์ [`apps-script/Code.gs`](../apps-script/Code.gs) ไปวางทับไฟล์ `Code.gs` ใน Apps Script แล้วกด **Save (Ctrl+S / Cmd+S)**
4. ตั้งค่าคีย์ลับใน **Project Settings > Script Properties** (ห้ามใส่คีย์ในโค้ด):

| Property Name | คำอธิบาย |
|---|---|
| `ALLOWED_EMAILS` | อีเมล Google ที่อนุญาตให้เข้าใช้งาน (คั่นด้วยจุลภาค `,` หากมีหลายอีเมล) |
| `GOOGLE_CLIENT_ID` | OAuth 2.0 Client ID (ชนิด Web application) จาก Google Cloud Console |
| `GEMINI_API_KEY` | API Key จาก Google AI Studio สำหรับเรียก Gemini |
| `GEMINI_MODEL` | ชื่อโมเดล เช่น `gemini-2.5-flash` |
| `LINE_CHANNEL_ACCESS_TOKEN` | Channel Access Token (Long-lived) จาก LINE Developers Console |
| `LINE_CHANNEL_SECRET` | Channel Secret จาก LINE Developers Console |
| `LINE_DEFAULT_USER_ID` | LINE User ID (`U...`) สำหรับรับแจ้งเตือนสรุปงานประจำวัน |
| `GOOGLE_CALENDAR_ID` | `primary` หรือ Calendar ID ที่ต้องการซิงค์ |

5. สร้างตารางทั้ง 9 แท็บอัตโนมัติ:
   - กลับไปที่หน้า **Editor (`< >`)** ของ Apps Script
   - เลือกฟังก์ชัน `setupSheets` จากเมนูด้านบน แล้วกด **Run** (อนุญาตสิทธิ์เข้าถึง Google Sheet/Calendar/External Request ในครั้งแรก)
   - ตรวจสอบใน Google Sheet จะพบแท็บทั้ง 9 แท็บพร้อมหัวตาราง (`id, user_email, created_at, updated_at, ...`):
     1. `tasks`
     2. `projects`
     3. `milestones`
     4. `inbox`
     5. `inbox_attachments`
     6. `settings`
     7. `integration_connections`
     8. `line_messages`
     9. `line_daily_digest_deliveries`
6. ตั้งเวลาส่งสรุปงานประจำวัน (แทน Vercel Cron):
   - เลือกฟังก์ชัน `setupDailyDigestTrigger` จากเมนูด้านบน แล้วกด **Run**
   - ระบบจะสร้าง Time-driven trigger ให้รัน `runDailyLineDigest` ทุกวันช่วง 18:00 น. (`Asia/Bangkok`)
7. Deploy เป็น Web App:
   - กดปุ่ม **Deploy > New deployment**
   - เลือกชนิด **Web app**
   - ตั้งค่า **Execute as**: `Me (อีเมลของคุณ)`
   - ตั้งค่า **Who has access**: `Anyone` *(จำเป็นเพื่อให้รับ LINE Webhook และรับ CORS request จากหน้าเว็บ GitHub Pages ได้ โดยโค้ดจะตรวจ Google ID Token และ `ALLOWED_EMAILS` ก่อนเสมอ)*
   - คัดลอก **Web App URL** (`https://script.google.com/macros/s/.../exec`) เก็บไว้

---

## 2. การตั้งค่า Google Identity Services (Google Login)

1. ไปที่ **Google Cloud Console > APIs & Services > Credentials**
2. สร้างหรือแก้ไข **OAuth 2.0 Client ID** (ชนิด **Web application**)
3. ในช่อง **Authorized JavaScript origins** ให้เพิ่ม:
   - `https://po45-ops.github.io`
   - `http://localhost:3000` (สำหรับทดสอบในเครื่อง)
4. นำค่า **Client ID** (`...apps.googleusercontent.com`) ไปใส่ใน:
   - `Script Properties` ของ Apps Script (`GOOGLE_CLIENT_ID`)
   - GitHub Repository Variables/Secrets สำหรับตอน Build หน้าเว็บ (`NEXT_PUBLIC_GOOGLE_CLIENT_ID`)

---

## 3. การตั้งค่า GitHub Variables สำหรับ GitHub Pages

ใน GitHub Repository (`Settings > Secrets and variables > Actions > Variables` หรือ `Secrets`):

- `NEXT_PUBLIC_GAS_WEBAPP_URL` = URL ของ Apps Script Web App (`https://script.google.com/macros/s/.../exec`)
- `NEXT_PUBLIC_GOOGLE_CLIENT_ID` = OAuth 2.0 Client ID (`...apps.googleusercontent.com`)
- `NEXT_PUBLIC_BASE_PATH` = `/ai-work-assistant-gh` (หากโฮสต์ใต้ `https://po45-ops.github.io/ai-work-assistant-gh`)

---

## 4. การนำเข้าข้อมูลจาก Supabase (CSV / JSON) เข้า Google Sheet

เมื่อได้รับไฟล์ Export จาก Supabase (CSV หรือ JSON):

```bash
# 1. แปลงไฟล์ทั้งหมดให้อยู่ในรูปแบบมาตรฐาน 9 แท็บ (สร้างไฟล์ในโฟลเดอร์ ./import-ready)
node scripts/import-supabase-to-sheets.mjs \
  --input /path/to/supabase-export-folder \
  --email your-email@gmail.com

# 2. (ทางเลือก) ส่งข้อมูลเข้า Google Sheet โดยตรงผ่าน Apps Script Web App
node scripts/import-supabase-to-sheets.mjs \
  --input /path/to/supabase-export-folder \
  --email your-email@gmail.com \
  --webapp-url "https://script.google.com/macros/s/.../exec" \
  --id-token "YOUR_GOOGLE_ID_TOKEN"
```
