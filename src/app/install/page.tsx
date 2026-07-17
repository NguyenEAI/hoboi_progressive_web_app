import { InstallAppCard } from "@/components/InstallAppCard";
import { Logo } from "@/components/Logo";
import Link from "next/link";

export default function InstallPage() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col bg-gradient-to-b from-brand-50 via-white to-slate-50 px-5 py-8">
      <div className="flex flex-col items-center text-center">
        <Logo size={72} glow />
        <p className="mt-4 text-xs font-black uppercase tracking-[0.2em] text-brand-600">Hồ Bơi Prosper Plaza</p>
        <h1 className="mt-2 text-3xl font-black leading-tight text-brand-900">
          Cài app vào điện thoại
        </h1>
        <p className="mt-3 text-sm leading-relaxed text-slate-500">
          Bấm nút bên dưới. Nếu điện thoại cho phép, chỉ cần xác nhận là app nằm ngoài màn hình chính.
        </p>
      </div>

      <div className="mt-7">
        <InstallAppCard forceShow />
      </div>

      <div className="mt-5 rounded-3xl bg-white/80 p-4 text-sm leading-relaxed text-slate-600 shadow-sm ring-1 ring-slate-100">
        <div className="font-extrabold text-slate-800">Lưu ý nhỏ</div>
        <p className="mt-1">
          Máy Android thường hiện hộp xác nhận ngay. Máy Apple sẽ cần bấm nút Chia sẻ rồi chọn thêm vào màn hình chính.
        </p>
      </div>

      <Link
        href="/signin"
        className="mt-auto inline-flex justify-center rounded-2xl bg-slate-900 px-5 py-3 text-sm font-extrabold text-white shadow-sm active:scale-[0.98]"
      >
        Vào app
      </Link>
    </main>
  );
}
