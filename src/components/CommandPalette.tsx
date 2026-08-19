"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuthUser } from "@/lib/hooks/useAuthUser";

type Cmd = {
  label: string;         // Tên hiển thị
  desc?: string;         // Mô tả ngắn
  keywords: string[];    // Từ khoá (không dấu)
  href: string;          // Đường tới
  emoji: string;
  ownerOnly?: boolean;
};

// Bảng chức năng — bổ sung thêm khi có màn mới
const COMMANDS: Cmd[] = [
  { label: "Dashboard", desc: "Trang tổng quan hôm nay", keywords: ["dashboard", "trang chu", "tong quan", "home"], href: "/admin", emoji: "🏠" },

  // Bán / gia hạn
  { label: "Bán vé / lớp tại quầy", desc: "Bán vé lượt, vé thời hạn, khoá học", keywords: ["ban ve", "ban lop", "ban hang", "tao don", "counter"], href: "/admin/counter-sale", emoji: "💳" },
  { label: "Gia hạn vé / khoá học", desc: "Bán mới cho khách cũ = gia hạn", keywords: ["gia han", "renew", "mua them", "bo sung", "ban tiep"], href: "/admin/counter-sale", emoji: "🔄" },
  { label: "Mua thêm vé cho khách", desc: "Từ trang bán tại quầy chọn khách", keywords: ["mua them", "them ve", "them lop"], href: "/admin/counter-sale", emoji: "➕" },

  // Điểm danh
  { label: "QR vé lượt tại cổng", desc: "Máy quét check-in vé lượt", keywords: ["qr", "cong", "check in", "checkin", "quet ma", "diem danh ve"], href: "/admin/qr-gate", emoji: "🚪" },
  { label: "QR điểm danh khoá học", desc: "Quét mã HLV để điểm danh buổi học", keywords: ["qr khoa hoc", "diem danh khoa", "diem danh lop", "checkin course"], href: "/admin/course-qr", emoji: "🏊" },
  { label: "Điểm danh hộ", desc: "Lễ tân điểm danh khi máy khách hết pin/không có app", keywords: ["diem danh ho", "assist", "checkin thay", "diem danh giup"], href: "/admin/checkin-assist", emoji: "📷" },
  { label: "Hoàn 1 buổi vé lượt", desc: "Trả lại lượt cho khách không xuống hồ", keywords: ["hoan ve", "hoan luot", "hoan buoi", "refund visit"], href: "/admin/checkin-assist", emoji: "↩️" },
  { label: "Hoàn 1 buổi khoá học", desc: "Huỷ buổi điểm danh khoá học đã ghi nhầm", keywords: ["hoan khoa hoc", "hoan buoi hoc", "huy diem danh khoa"], href: "/admin/checkin-assist", emoji: "↩️" },

  // Khách hàng
  { label: "Khách hàng", desc: "Tìm/sửa/xoá khách theo SĐT", keywords: ["khach hang", "customer", "tim khach", "sdt", "so dien thoai"], href: "/admin/customers", emoji: "👥" },
  { label: "Đặt lại mật khẩu khách về 123456", desc: "Vào hồ sơ khách rồi bấm nút Reset", keywords: ["reset mat khau", "dat lai mat khau", "quen mat khau", "password", "123456"], href: "/admin/customers", emoji: "🔑" },
  { label: "Đổi ảnh vé khách", desc: "Trong hồ sơ khách, sửa ảnh vé thời hạn", keywords: ["doi anh", "sua anh", "anh ve", "photo ve"], href: "/admin/customers", emoji: "🖼️" },

  // Đơn hàng
  { label: "Đơn hàng", desc: "Danh sách đơn theo ngày, lọc trạng thái", keywords: ["don hang", "order", "hoa don", "invoice"], href: "/admin/orders", emoji: "📋" },

  // Quản lý
  { label: "Huấn luyện viên", desc: "Thêm/sửa/xoá HLV, lịch dạy", keywords: ["hlv", "huan luyen vien", "coach", "thay giao", "co giao"], href: "/admin/coaches", emoji: "🏊", ownerOnly: true },
  { label: "Xoá HLV", desc: "Trên trang HLV, mỗi dòng có nút Xoá", keywords: ["xoa hlv", "xoa coach", "delete coach", "go hlv"], href: "/admin/coaches", emoji: "🗑️", ownerOnly: true },
  { label: "Nhân viên & Phân quyền", desc: "Gán/gỡ quyền Chủ, Lễ tân, HLV", keywords: ["nhan vien", "phan quyen", "role", "staff", "gan quyen", "quyen han"], href: "/admin/staff", emoji: "⚙️", ownerOnly: true },
  { label: "Sản phẩm & Giá", desc: "Bảng giá vé, gói lượt, khoá học", keywords: ["san pham", "gia", "price", "ve", "goi luot"], href: "/admin/products", emoji: "📦", ownerOnly: true },
  { label: "Khuyến mãi", desc: "Gửi khuyến mãi cho khách", keywords: ["khuyen mai", "promotion", "giam gia", "voucher", "marketing"], href: "/admin/promotions", emoji: "📣", ownerOnly: true },

  // Phân tích
  { label: "Báo cáo", desc: "Doanh thu theo ngày/tháng, theo loại", keywords: ["bao cao", "report", "doanh thu", "thong ke", "analytics"], href: "/admin/reports", emoji: "📊" },
  { label: "Chi tiêu của hồ", desc: "Ghi và xem chi phí hằng ngày", keywords: ["chi tieu", "chi phi", "expense", "tien dien", "tien nuoc", "luong"], href: "/admin/expenses", emoji: "💸" },
];

// Bỏ dấu tiếng Việt để so khớp
function noAccent(s: string): string {
  return s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/đ/g, "d");
}

function score(q: string, c: Cmd): number {
  const nq = noAccent(q).trim();
  if (!nq) return 0;
  const label = noAccent(c.label);
  const desc = noAccent(c.desc ?? "");
  let s = 0;
  if (label === nq) s += 100;
  if (label.startsWith(nq)) s += 40;
  if (label.includes(nq)) s += 20;
  if (desc.includes(nq)) s += 8;
  for (const k of c.keywords) {
    const nk = noAccent(k);
    if (nk === nq) s += 30;
    else if (nk.startsWith(nq)) s += 12;
    else if (nk.includes(nq)) s += 6;
  }
  // Từng từ trong query cũng phải xuất hiện đâu đó
  const words = nq.split(/\s+/).filter(Boolean);
  if (words.length > 1) {
    const hay = label + " " + desc + " " + c.keywords.map(noAccent).join(" ");
    if (words.every((w) => hay.includes(w))) s += 15;
    else s -= 10;
  }
  return s;
}

export function CommandPalette() {
  const router = useRouter();
  const { profile } = useAuthUser();
  const isOwner = profile?.role === "OWNER";
  const isStaff = profile?.role === "OWNER" || profile?.role === "RECEPTIONIST";
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [active, setActive] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  // Ctrl+K hoặc Cmd+K để mở
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && (e.key === "k" || e.key === "K")) {
        e.preventDefault();
        setOpen(true);
      }
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 20);
    else { setQ(""); setActive(0); }
  }, [open]);

  const results = useMemo(() => {
    const available = COMMANDS.filter((c) => !c.ownerOnly || isOwner);
    if (!q.trim()) return available.slice(0, 8);
    return available
      .map((c) => ({ c, s: score(q, c) }))
      .filter((x) => x.s > 0)
      .sort((a, b) => b.s - a.s)
      .slice(0, 10)
      .map((x) => x.c);
  }, [q, isOwner]);

  useEffect(() => { setActive(0); }, [q]);

  function go(c: Cmd) {
    setOpen(false);
    router.push(c.href);
  }

  if (!isStaff) return null;

  return (
    <>
      {/* Nút mở */}
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="hidden items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-sm text-slate-500 shadow-sm hover:bg-slate-50 md:inline-flex"
        aria-label="Tìm chức năng (Ctrl+K)"
      >
        🔎 <span>Tìm chức năng…</span>
        <span className="ml-2 rounded border border-slate-200 bg-slate-50 px-1.5 py-0.5 text-[10px] font-semibold text-slate-500">Ctrl K</span>
      </button>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center rounded-xl border border-slate-200 bg-white px-2.5 py-1.5 text-sm text-slate-600 md:hidden"
        aria-label="Tìm chức năng"
      >
        🔎
      </button>

      {/* Modal */}
      {open && (
        <div className="fixed inset-0 z-50 flex items-start justify-center bg-slate-900/60 p-4 pt-[10vh]" onClick={() => setOpen(false)}>
          <div
            className="w-full max-w-lg overflow-hidden rounded-2xl bg-white shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-2 border-b border-slate-100 px-4">
              <span className="text-slate-400">🔎</span>
              <input
                ref={inputRef}
                value={q}
                onChange={(e) => setQ(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "ArrowDown") { e.preventDefault(); setActive((a) => Math.min(a + 1, results.length - 1)); }
                  else if (e.key === "ArrowUp") { e.preventDefault(); setActive((a) => Math.max(a - 1, 0)); }
                  else if (e.key === "Enter") { e.preventDefault(); if (results[active]) go(results[active]); }
                }}
                placeholder="Gõ tên chức năng (VD: gia hạn, chi tiêu, hoàn buổi, HLV…)"
                className="flex-1 border-0 py-4 text-base outline-none placeholder:text-slate-400"
                autoFocus
              />
              <kbd className="hidden rounded border border-slate-200 bg-slate-50 px-1.5 py-0.5 text-[10px] font-semibold text-slate-500 md:inline">Esc</kbd>
            </div>
            <ul className="max-h-[60vh] overflow-y-auto py-1">
              {results.length === 0 && (
                <li className="px-4 py-6 text-center text-sm text-slate-400">
                  Không có chức năng nào khớp "{q}"
                </li>
              )}
              {results.map((c, i) => (
                <li key={c.href + c.label}>
                  <button
                    type="button"
                    onMouseEnter={() => setActive(i)}
                    onClick={() => go(c)}
                    className={`flex w-full items-start gap-3 px-4 py-2.5 text-left ${i === active ? "bg-brand-50" : "hover:bg-slate-50"}`}
                  >
                    <span className="mt-0.5 text-xl">{c.emoji}</span>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-bold text-slate-800">{c.label}</div>
                      {c.desc && <div className="text-xs text-slate-500 truncate">{c.desc}</div>}
                    </div>
                    <span className="mt-1 text-[10px] font-semibold uppercase tracking-wider text-slate-400">Mở →</span>
                  </button>
                </li>
              ))}
            </ul>
            <div className="border-t border-slate-100 bg-slate-50 px-4 py-2 text-[11px] text-slate-500">
              ↑ ↓ chọn · <b>Enter</b> mở · <b>Esc</b> đóng · Mẹo: gõ tiếng Việt không dấu cũng được
            </div>
          </div>
        </div>
      )}
    </>
  );
}
