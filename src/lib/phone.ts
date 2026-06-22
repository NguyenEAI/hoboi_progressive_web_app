// Chuẩn hóa SĐT Việt Nam → E.164 (+84xxxxxxxxx)
// Chấp nhận: "0947010978", "947010978", "+84947010978", "84947010978",
// có dấu cách / gạch ngang.
export function normalizeVNPhone(input: string): string {
  const digits = input.replace(/[\s\-().]/g, "");
  if (/^\+84\d{9}$/.test(digits)) return digits;
  if (/^84\d{9}$/.test(digits)) return "+" + digits;
  if (/^0\d{9}$/.test(digits)) return "+84" + digits.slice(1);
  if (/^\d{9}$/.test(digits)) return "+84" + digits;
  throw new Error("Số điện thoại không hợp lệ (cần 10 số bắt đầu bằng 0)");
}

// Kiểm tra dạng 10 số nội địa (0xxxxxxxxx) — dùng cho validate UI
export function isValidVNPhone10(input: string): boolean {
  const digits = input.replace(/\D/g, "");
  return /^0\d{9}$/.test(digits);
}

// Hiển thị E.164 (+84...) hoặc 10 số → "0947 010 978" cho dễ đọc
export function displayVNPhone(value: string): string {
  if (!value) return "";
  let digits = value.replace(/\D/g, "");
  if (digits.startsWith("84") && digits.length === 11) digits = "0" + digits.slice(2);
  if (digits.length !== 10) return value;
  return `${digits.slice(0, 4)} ${digits.slice(4, 7)} ${digits.slice(7)}`;
}
