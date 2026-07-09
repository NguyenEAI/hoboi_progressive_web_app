"use client";

import { useEffect, useMemo, useState } from "react";
import { collection, getDocs } from "firebase/firestore";
import { db } from "@/lib/firebase/client";
import { searchCustomerByPhone, createCustomerByPhone, createCounterSale } from "@/lib/callable";
import { usePricing } from "@/lib/hooks/usePricing";
import { formatVND } from "@/lib/utils";
import { AUDIENCES, PACKAGE_SIZES, PASS_DURATIONS, SLOT_START_HOURS, SWIM_STYLES, WEEKDAY_LABELS } from "@/lib/constants";
import type { Audience, Coach, PackageSize, PassDuration, ProductType, SwimStyle } from "@/types";
import { Search, UserPlus, WalletCards, Waves, GraduationCap, Ticket, X } from "lucide-react";

type CustomerHit = {
  id: string;
  fullName?: string;
  phone?: string;
  role?: string;
  autoCreated?: boolean;
};

type SaleItem = {
  id: string;
  productType: ProductType;
  title: string;
  subtitle: string;
  amountVND: number;
  audience?: Audience;
  duration?: PassDuration;
  packageSize?: PackageSize;
  swimStyle?: SwimStyle;
};

export default function CounterSalePage() {
  const { pricing } = usePricing();
  const [phone, setPhone] = useState("");
  const [customer, setCustomer] = useState<CustomerHit | null>(null);
  const [searching, setSearching] = useState(false);
  const [message, setMessage] = useState<string>();
  const [error, setError] = useState<string>();
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState("");
  const [creating, setCreating] = useState(false);
  const [items, setItems] = useState<SaleItem[]>([]);
  const [coaches, setCoaches] = useState<Coach[]>([]);
  const [coachId, setCoachId] = useState("");
  const [startHour, setStartHour] = useState<number>(7);
  const [method, setMethod] = useState<"CASH" | "BANK_TRANSFER">("CASH");
  const [paying, setPaying] = useState(false);

  const total = useMemo(() => items.reduce((sum, item) => sum + item.amountVND, 0), [items]);
  const hasCourse = items.some((item) => item.productType === "SWIM_COURSE");

  useEffect(() => {
    getDocs(collection(db, "coaches"))
      .then((s) => setCoaches(s.docs.map((d) => ({ id: d.id, ...d.data() } as Coach)).filter((c) => c.active)))
      .catch(() => setCoaches([]));
  }, []);

  async function findCustomer() {
    const raw = phone.trim();
    if (!raw) return;
    setSearching(true);
    setError(undefined);
    setMessage(undefined);
    setCustomer(null);
    try {
      const found = await searchCustomerByPhone({ phone: raw });
      setCustomer(found);
      setShowCreate(false);
      setMessage(found.autoCreated ? "Đã tạo hồ sơ tạm cho khách. Có thể bổ sung tên ngay tại quầy." : "Đã tìm thấy khách.");
    } catch (e) {
      const text = (e as Error).message;
      if (text.toLowerCase().includes("not-found")) {
        setError(undefined);
        setShowCreate(true);
        setMessage("Chưa có khách này. Nhập tên để tạo nhanh và bán tiếp.");
      } else {
        setError(text);
      }
    } finally {
      setSearching(false);
    }
  }

  async function createCustomer() {
    if (!phone.trim() || !newName.trim()) return;
    setCreating(true);
    setError(undefined);
    try {
      const result = await createCustomerByPhone({ phone: phone.trim(), fullName: newName.trim() });
      setCustomer({ id: result.uid, phone: phone.trim(), fullName: newName.trim(), role: "CUSTOMER" });
      setShowCreate(false);
      setMessage(result.alreadyExists ? "Khách đã có trong hệ thống, đã cập nhật tên." : "Đã tạo khách mới. Có thể bán vé/lớp ngay.");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setCreating(false);
    }
  }

  function addPass(duration: PassDuration, audience: Audience) {
    const price = pricing.pass[audience][duration];
    setItems((cur) => [
      ...cur,
      {
        id: crypto.randomUUID(),
        productType: "PASS",
        title: passLabel(duration),
        subtitle: audienceLabel(audience),
        amountVND: price,
        duration,
        audience,
      },
    ]);
  }

  function addPackage(packageSize: PackageSize, audience: Audience) {
    const price = pricing.package[audience][packageSize];
    setItems((cur) => [
      ...cur,
      {
        id: crypto.randomUUID(),
        productType: "PACKAGE",
        title: packageLabel(packageSize),
        subtitle: audienceLabel(audience),
        amountVND: price,
        packageSize,
        audience,
      },
    ]);
  }

  function addCourse(swimStyle: SwimStyle) {
    setItems((cur) => [
      ...cur,
      {
        id: crypto.randomUUID(),
        productType: "SWIM_COURSE",
        title: styleLabel(swimStyle),
        subtitle: "15 buổi · chọn HLV/ca ở bước thu tiền",
        amountVND: pricing.swimCourse,
        swimStyle,
      },
    ]);
  }

  function removeItem(id: string) {
    setItems((cur) => cur.filter((item) => item.id !== id));
  }

  async function payAndActivate() {
    if (!customer || !items.length) return;
    if (hasCourse && !coachId) {
      setError("Chọn HLV cho khóa học trước khi thu tiền.");
      return;
    }
    setPaying(true);
    setError(undefined);
    setMessage(undefined);
    try {
      const codes: string[] = [];
      for (const item of items) {
        const r = await createCounterSale({
          customerId: customer.id,
          beneficiaryKind: "USER",
          beneficiaryId: customer.id,
          beneficiaryName: customer.fullName || displayPhone(customer.phone || phone),
          productType: item.productType,
          duration: item.duration,
          packageSize: item.packageSize,
          swimStyle: item.swimStyle,
          audience: item.audience,
          coachId: item.productType === "SWIM_COURSE" ? coachId : undefined,
          startHour: item.productType === "SWIM_COURSE" ? startHour : undefined,
          method,
        });
        codes.push(`MS${r.memberCode}`);
      }
      setItems([]);
      setMessage(`Đã thu ${formatVND(total)} và kích hoạt ${codes.join(", ")}.`);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setPaying(false);
    }
  }

  return (
    <div className="min-h-[calc(100vh-3rem)]">
      <header className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <div className="text-xs font-black uppercase tracking-[0.2em] text-brand-700">Quầy lễ tân</div>
          <h1 className="mt-1 text-3xl font-extrabold tracking-tight text-brand-900">Bán vé/lớp</h1>
          <p className="mt-1 text-sm text-slate-500">Nhập SĐT, chọn vé/lớp, nhìn tổng tiền rõ ràng. Thu xong là khách dùng được.</p>
        </div>
        <div className="rounded-2xl bg-white px-4 py-3 text-sm shadow-sm ring-1 ring-slate-100">
          <div className="text-xs font-semibold uppercase text-slate-400">Tổng tạm tính</div>
          <div className="text-2xl font-extrabold text-brand-800">{formatVND(total)}</div>
        </div>
      </header>

      <div className="mt-6 grid gap-5 xl:grid-cols-[1.15fr_0.85fr]">
        <main className="space-y-5">
          <section className="rounded-[2rem] border border-white/80 bg-white/85 p-5 shadow-[0_24px_80px_rgba(15,118,110,0.10)] backdrop-blur">
            <label className="text-sm font-bold text-slate-600">Tìm khách bằng SĐT</label>
            <div className="mt-3 flex flex-col gap-3 sm:flex-row">
              <input
                value={phone}
                onChange={(e) => setPhone(e.target.value.replace(/[^0-9+]/g, "").slice(0, 13))}
                onKeyDown={(e) => { if (e.key === "Enter") void findCustomer(); }}
                placeholder="0905 123 456"
                className="min-w-0 flex-1 rounded-2xl border-2 border-brand-100 bg-white px-5 py-4 text-2xl font-extrabold tracking-wide text-brand-950 outline-none focus:border-brand-500 focus:ring-4 focus:ring-brand-100"
              />
              <button
                onClick={findCustomer}
                disabled={searching || !phone.trim()}
                className="inline-flex items-center justify-center gap-2 rounded-2xl bg-brand-600 px-7 font-bold text-white shadow-lg shadow-brand-600/20 disabled:opacity-50"
              >
                <Search className="size-4" /> {searching ? "Đang tìm…" : "Tìm"}
              </button>
            </div>

            {message && <div className="mt-4 rounded-2xl bg-brand-50 px-4 py-3 text-sm font-medium text-brand-800">{message}</div>}
            {error && <div className="mt-4 rounded-2xl bg-red-50 px-4 py-3 text-sm font-medium text-red-700">{error}</div>}

            {showCreate && (
              <div className="mt-4 rounded-3xl border border-dashed border-brand-300 bg-brand-50/60 p-4">
                <div className="flex items-center gap-2 font-bold text-brand-900"><UserPlus className="size-4" /> Tạo khách nhanh</div>
                <div className="mt-3 flex flex-col gap-3 sm:flex-row">
                  <input
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    placeholder="Tên khách"
                    className="min-w-0 flex-1 rounded-2xl border-2 border-white bg-white px-4 py-3 font-semibold outline-none focus:border-brand-400"
                  />
                  <button
                    onClick={createCustomer}
                    disabled={creating || !newName.trim() || !phone.trim()}
                    className="rounded-2xl bg-brand-700 px-5 py-3 text-sm font-bold text-white disabled:opacity-50"
                  >
                    {creating ? "Đang tạo…" : "Tạo và bán tiếp"}
                  </button>
                </div>
              </div>
            )}

            {customer && (
              <div className="mt-4 rounded-3xl border border-brand-100 bg-brand-50/80 p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <div className="text-xs font-bold uppercase tracking-wider text-brand-700">Khách đang chọn</div>
                    <div className="mt-1 text-2xl font-extrabold text-brand-950">{customer.fullName || "(chưa đặt tên)"}</div>
                    <div className="mt-1 text-sm text-slate-500">{displayPhone(customer.phone || phone)} · {customer.role === "PARENT" ? "Phụ huynh" : "Khách"}</div>
                  </div>
                  <span className="rounded-full bg-white px-4 py-2 text-sm font-bold text-brand-700 shadow-sm">Sẵn sàng bán</span>
                </div>
              </div>
            )}
          </section>

          <section className="rounded-[2rem] border border-white/80 bg-white/85 p-5 shadow-[0_24px_80px_rgba(15,118,110,0.10)] backdrop-blur">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h2 className="text-xl font-extrabold text-brand-950">Chọn vé/lớp muốn bán</h2>
                <p className="mt-1 text-sm text-slate-500">Các món hay bán đặt ngay trước mắt để lễ tân bấm nhanh.</p>
              </div>
              <span className="hidden rounded-full bg-slate-100 px-4 py-2 text-xs font-bold text-slate-500 md:block">Giá đang dùng hôm nay</span>
            </div>

            <div className="mt-5 space-y-5">
              <ServiceGroup icon={<GraduationCap className="size-5" />} title="Khóa học bơi" subtitle="1.800.000đ · 15 buổi · 1 kiểu bơi">
                <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                  {SWIM_STYLES.map((style) => (
                    <ServiceButton key={style.id} title={style.label} price={pricing.swimCourse} onClick={() => addCourse(style.id)} />
                  ))}
                </div>
              </ServiceGroup>

              <ServiceGroup icon={<WalletCards className="size-5" />} title="Vé tháng/quý/năm" subtitle="Không giới hạn lượt trong thời hạn">
                <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                  {PASS_DURATIONS.map((duration) => (
                    <ServiceButton key={duration.id} title={duration.label} price={pricing.pass.ADULT[duration.id]} note="Giá người lớn" onClick={() => addPass(duration.id, "ADULT")} />
                  ))}
                </div>
              </ServiceGroup>

              <ServiceGroup icon={<Ticket className="size-5" />} title="Vé 15/30 lượt" subtitle="Dùng dần, phù hợp khách quen/gia đình">
                <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                  {PACKAGE_SIZES.map((size) => (
                    <ServiceButton key={size.id} title={size.label} price={pricing.package.ADULT[size.id]} note="Giá người lớn" onClick={() => addPackage(size.id, "ADULT")} />
                  ))}
                </div>
              </ServiceGroup>
            </div>
          </section>
        </main>

        <aside className="sticky top-6 h-fit rounded-[2rem] border border-white/80 bg-white/90 p-5 shadow-[0_24px_80px_rgba(15,118,110,0.12)] backdrop-blur">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-extrabold text-brand-950">Hóa đơn tạm</h2>
            <span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-bold text-amber-700">Chưa thu</span>
          </div>

          <div className="mt-4 rounded-3xl bg-slate-50 p-4">
            <div className="text-sm font-bold text-slate-500">Khách</div>
            <div className="mt-1 font-extrabold text-slate-900">{customer?.fullName || "Chưa chọn khách"}</div>
            <div className="text-xs text-slate-500">{customer ? displayPhone(customer.phone || phone) : "Nhập SĐT để bắt đầu"}</div>
          </div>

          <div className="mt-4 space-y-3">
            {items.map((item) => (
              <div key={item.id} className="rounded-3xl border border-brand-100 bg-white p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="font-extrabold text-slate-900">{item.title}</div>
                    <div className="mt-1 text-sm text-slate-500">{item.subtitle}</div>
                  </div>
                  <button onClick={() => removeItem(item.id)} className="rounded-full p-1 text-slate-400 hover:bg-red-50 hover:text-red-600"><X className="size-4" /></button>
                </div>
                <div className="mt-3 text-right font-extrabold text-brand-700">{formatVND(item.amountVND)}</div>
              </div>
            ))}
            {!items.length && (
              <div className="rounded-3xl border border-dashed border-slate-200 bg-slate-50 p-6 text-center text-sm text-slate-400">
                Chưa chọn vé/lớp nào.
              </div>
            )}
          </div>

          {hasCourse && (
            <div className="mt-4 rounded-3xl border border-sky-100 bg-sky-50/70 p-4">
              <div className="font-extrabold text-sky-900">Thông tin khóa học</div>
              <label className="mt-3 block text-xs font-bold uppercase text-sky-700">HLV</label>
              <select
                value={coachId}
                onChange={(e) => setCoachId(e.target.value)}
                className="mt-1 w-full rounded-2xl border-2 border-white bg-white px-3 py-2 text-sm font-semibold outline-none focus:border-sky-300"
              >
                <option value="">Chọn HLV</option>
                {coaches.map((coach) => (
                  <option key={coach.id} value={coach.id}>
                    {coach.fullName} · {coach.weekdays.map((w) => WEEKDAY_LABELS[w]).join(" / ")}
                  </option>
                ))}
              </select>
              <label className="mt-3 block text-xs font-bold uppercase text-sky-700">Giờ học</label>
              <select
                value={startHour}
                onChange={(e) => setStartHour(Number(e.target.value))}
                className="mt-1 w-full rounded-2xl border-2 border-white bg-white px-3 py-2 text-sm font-semibold outline-none focus:border-sky-300"
              >
                {SLOT_START_HOURS.map((hour) => (
                  <option key={hour} value={hour}>{hour}:00</option>
                ))}
              </select>
            </div>
          )}

          <div className="mt-5 border-t border-slate-200 pt-5">
            <div className="flex items-center justify-between text-sm text-slate-500"><span>Tổng tiền</span><span>{items.length} dịch vụ</span></div>
            <div className="mt-1 flex items-end justify-between"><span className="text-slate-500">Cần thu</span><span className="text-3xl font-extrabold text-brand-800">{formatVND(total)}</span></div>
          </div>

          <div className="mt-5 grid grid-cols-2 gap-3">
            <button
              onClick={() => setMethod("CASH")}
              className={`rounded-2xl border-2 py-3 text-sm font-bold ${method === "CASH" ? "border-brand-100 bg-white text-brand-700" : "border-slate-100 bg-white text-slate-500"}`}
            >
              Tiền mặt
            </button>
            <button
              onClick={() => setMethod("BANK_TRANSFER")}
              className={`rounded-2xl border-2 py-3 text-sm font-bold ${method === "BANK_TRANSFER" ? "border-brand-100 bg-white text-brand-700" : "border-slate-100 bg-white text-slate-500"}`}
            >
              Chuyển khoản
            </button>
          </div>

          <button
            onClick={payAndActivate}
            disabled={!customer || !items.length || paying || (hasCourse && !coachId)}
            className="mt-4 w-full rounded-3xl bg-gradient-to-r from-brand-700 to-teal-600 py-4 text-lg font-extrabold text-white shadow-xl shadow-brand-700/25 disabled:from-slate-300 disabled:to-slate-400 disabled:shadow-none"
          >
            {paying ? "Đang kích hoạt…" : "Đã thu tiền · Kích hoạt ngay"}
          </button>
          <p className="mt-3 text-center text-xs text-slate-500">Thu xong, vé/lớp sẽ hiện trong hệ thống ngay.</p>
        </aside>
      </div>
    </div>
  );
}

function ServiceGroup({ icon, title, subtitle, children }: { icon: React.ReactNode; title: string; subtitle: string; children: React.ReactNode }) {
  return (
    <section>
      <div className="mb-3 flex items-center gap-2">
        <span className="flex size-9 items-center justify-center rounded-2xl bg-brand-50 text-brand-700">{icon}</span>
        <div>
          <div className="font-extrabold text-slate-900">{title}</div>
          <div className="text-xs text-slate-500">{subtitle}</div>
        </div>
      </div>
      {children}
    </section>
  );
}

function ServiceButton({ title, price, note, onClick }: { title: string; price: number; note?: string; onClick: () => void }) {
  return (
    <button onClick={onClick} className="rounded-3xl border border-slate-100 bg-white p-4 text-left shadow-sm transition hover:-translate-y-0.5 hover:border-brand-200 hover:shadow-xl hover:shadow-brand-600/10">
      <div className="flex items-center gap-2 text-brand-700"><Waves className="size-4" /><span className="text-xs font-bold uppercase tracking-wide">Dịch vụ</span></div>
      <div className="mt-3 font-extrabold text-slate-900">{title}</div>
      {note && <div className="mt-1 text-xs text-slate-500">{note}</div>}
      <div className="mt-4 text-lg font-extrabold text-brand-700">{formatVND(price)}</div>
    </button>
  );
}

function displayPhone(phone?: string) {
  if (!phone) return "—";
  return phone.startsWith("+84") ? "0" + phone.slice(3) : phone;
}

function passLabel(duration: PassDuration) {
  return PASS_DURATIONS.find((d) => d.id === duration)?.label ?? "Vé thời hạn";
}

function packageLabel(size: PackageSize) {
  return PACKAGE_SIZES.find((p) => p.id === size)?.label ?? "Vé lượt";
}

function styleLabel(style: SwimStyle) {
  return SWIM_STYLES.find((s) => s.id === style)?.label ?? "Khóa học bơi";
}

function audienceLabel(audience: Audience) {
  if (audience === "ADULT") return "Người lớn";
  if (audience === "CHILD_OVER_140") return "Trẻ em trên 1.4m";
  return "Trẻ em dưới 1.4m";
}
