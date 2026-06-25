"use client";
import { formatVND } from "@/lib/utils";
import type { Audience, ProductType } from "@/types";

const AUDIENCE_LABELS: Record<Audience, string> = {
  ADULT: "Người lớn",
  CHILD_OVER_140: "Trẻ ≥1.4m",
  CHILD_UNDER_140: "Trẻ <1.4m",
};
const PRODUCT_LABELS: Record<ProductType, string> = {
  SWIM_COURSE: "Khóa học bơi",
  PASS: "Vé thời hạn",
  PACKAGE: "Gói lượt",
};

export type Cell = { count: number; amount: number };
export type Matrix = Record<ProductType, Partial<Record<Audience | "ALL", Cell>>>;

import type { Order } from "@/types";
export function buildMatrix(orders: Order[]): Matrix {
  const m: Matrix = { SWIM_COURSE: {}, PASS: {}, PACKAGE: {} };
  for (const o of orders) {
    const t = o.productType as ProductType;
    const aud: Audience | "ALL" = t === "SWIM_COURSE" ? "ALL" : ((o.productSnapshot?.audience as Audience) ?? "ALL");
    const cur = m[t][aud] ?? { count: 0, amount: 0 };
    cur.count += 1;
    cur.amount += o.amountVND ?? 0;
    m[t][aud] = cur;
  }
  return m;
}

export function CrossTable({ matrix, hideTotal }: { matrix: Matrix; hideTotal?: boolean }) {
  const products: ProductType[] = ["SWIM_COURSE", "PASS", "PACKAGE"];
  const audiences: Audience[] = ["ADULT", "CHILD_OVER_140", "CHILD_UNDER_140"];
  const totalCount = products.reduce((s, p) =>
    s + Object.values(matrix[p]).reduce((a, c) => a + (c?.count ?? 0), 0), 0);
  const totalAmount = products.reduce((s, p) =>
    s + Object.values(matrix[p]).reduce((a, c) => a + (c?.amount ?? 0), 0), 0);

  if (totalCount === 0) {
    return (
      <div className="card p-5 text-center text-sm text-slate-400">
        Chưa có đơn nào được thanh toán trong kỳ này.
      </div>
    );
  }
  return (
    <div className="card overflow-x-auto p-0">
      <table className="w-full text-left text-sm">
        <thead className="bg-slate-50 text-xs uppercase tracking-wider text-slate-500">
          <tr>
            <th className="p-3">Loại sản phẩm</th>
            {audiences.map((a) => (
              <th key={a} className="p-3 text-right">{AUDIENCE_LABELS[a]}</th>
            ))}
            {!hideTotal && <th className="p-3 text-right">Tổng</th>}
          </tr>
        </thead>
        <tbody>
          {products.map((p) => {
            const rowAmount = Object.values(matrix[p]).reduce((a, c) => a + (c?.amount ?? 0), 0);
            const rowCount = Object.values(matrix[p]).reduce((a, c) => a + (c?.count ?? 0), 0);
            if (rowCount === 0) return null;
            return (
              <tr key={p} className="border-t">
                <td className="p-3 font-semibold text-slate-700">{PRODUCT_LABELS[p]}</td>
                {p === "SWIM_COURSE" ? (
                  <td
                    className="p-3 text-center text-slate-500"
                    colSpan={audiences.length}
                  >
                    <span className="text-[11px] italic text-slate-400">
                      (giá phẳng, không chia đối tượng)
                    </span>
                    {hideTotal && (
                      <span className="ml-2">
                        <CellView c={matrix.SWIM_COURSE.ALL} />
                      </span>
                    )}
                  </td>
                ) : (
                  audiences.map((a) => (
                    <td key={a} className="p-3 text-right tab-nums">
                      <CellView c={matrix[p][a]} />
                    </td>
                  ))
                )}
                {!hideTotal && (
                  <td className="p-3 text-right font-bold tab-nums text-brand-700">
                    {rowCount > 0 ? `${rowCount} · ${formatVND(rowAmount)}` : "—"}
                  </td>
                )}
              </tr>
            );
          })}
          {!hideTotal && (
            <tr className="border-t bg-brand-50/50">
              <td className="p-3 font-bold text-brand-800">TỔNG</td>
              <td
                className="p-3 text-right font-extrabold text-brand-800 tab-nums"
                colSpan={audiences.length + 1}
              >
                {totalCount} đơn · {formatVND(totalAmount)}
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

function CellView({ c }: { c?: Cell }) {
  if (!c || c.count === 0) return <span className="text-slate-300">—</span>;
  return (
    <span>
      <span className="font-semibold text-slate-700">{c.count}</span>
      <span className="ml-1 text-[11px] text-slate-500">· {formatVND(c.amount)}</span>
    </span>
  );
}
