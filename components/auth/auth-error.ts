export function authErrorMessage(error: unknown) {
  const message = error instanceof Error ? error.message : "";
  if (/invalid login/i.test(message))
    return "อีเมลหรือรหัสผ่านไม่ถูกต้อง ลองตรวจสอบอีกครั้งนะ";
  if (/email not confirmed/i.test(message))
    return "กรุณายืนยันอีเมลจากลิงก์ที่ส่งให้ ก่อนเข้าสู่ระบบ";
  if (/already registered/i.test(message))
    return "อีเมลนี้มีบัญชีแล้ว ลองเข้าสู่ระบบหรือขอตั้งรหัสผ่านใหม่";
  if (/rate limit|too many/i.test(message))
    return "มีการทำรายการหลายครั้ง กรุณารอสักครู่แล้วลองใหม่";
  if (/password/i.test(message))
    return "รหัสผ่านไม่ตรงตามข้อกำหนด กรุณาใช้รหัสผ่านที่ยาวและคาดเดายากขึ้น";
  return "เชื่อมต่อไม่สำเร็จ กรุณาลองอีกครั้ง";
}
