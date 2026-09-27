"use client";

// Client-side auth/data pages have no static content worth pre-rendering
// at build time, and doing so made the build depend on live Supabase
// config being valid at image-build time. Force per-request rendering.
export const dynamic = "force-dynamic";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { BottomNav } from "@/components/BottomNav";
import { LockCheck } from "@/components/LockCheck";
import { SkeletonList } from "@/components/Skeleton";
import { PieChart, TrendingUp } from "lucide-react";
import { formatCurrency, localDateISO, localMonthKey } from "@/lib/utils";
import type { Category, Transaction } from "@/lib/types";

interface MonthTotal {
  label: string;
  monthStart: string;
  total: number;
}

export default function TrendsPage() {
  const supabase = createClient();
  const [months, setMonths] = useState<MonthTotal[]>([]);
  const [categoryTotals, setCategoryTotals] = useState<{ category: Category; total: number; prevTotal: number }[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function load() {
    const now = new Date();
    const rangeStart = new Date(now.getFullYear(), now.getMonth() - 5, 1);

    const [{ data: txns }, { data: categories }] = await Promise.all([
      supabase
        .from("transactions")
        .select("*")
        .eq("is_income", false)
        .gte("txn_date", localDateISO(rangeStart)),
      supabase.from("categories").select("*").eq("is_income", false)
    ]);

    const categoryList = (categories ?? []) as Category[];
    const all = (txns ?? []) as Transaction[];

    const byMonth = new Map<string, number>();
    for (let i = 0; i < 6; i++) {
      const d = new Date(now.getFullYear(), now.getMonth() - (5 - i), 1);
      byMonth.set(localMonthKey(d), 0);
    }
    for (const t of all) {
      if (t.source === "transfer") continue; // never counts as spending
      const key = t.txn_date.slice(0, 7);
      if (byMonth.has(key)) byMonth.set(key, (byMonth.get(key) ?? 0) + Number(t.amount));
    }
    setMonths(
      Array.from(byMonth.entries()).map(([key, total]) => ({
        monthStart: key,
        label: new Date(`${key}-01`).toLocaleDateString("en-GB", { month: "short" }),
        total
      }))
    );

    const currentMonthKey = localMonthKey(now);
    const prevMonthKey = localMonthKey(new Date(now.getFullYear(), now.getMonth() - 1, 1));
    const byCategory = new Map<string, number>();
    const byCategoryPrev = new Map<string, number>();
    for (const t of all) {
      if (!t.category_id || t.source === "transfer") continue;
      const key = t.txn_date.slice(0, 7);
      if (key === currentMonthKey) byCategory.set(t.category_id, (byCategory.get(t.category_id) ?? 0) + Number(t.amount));
      if (key === prevMonthKey) byCategoryPrev.set(t.category_id, (byCategoryPrev.get(t.category_id) ?? 0) + Number(t.amount));
    }
    setCategoryTotals(
      categoryList
        .filter((c) => byCategory.has(c.id))
        .map((c) => ({ category: c, total: byCategory.get(c.id) ?? 0, prevTotal: byCategoryPrev.get(c.id) ?? 0 }))
        .sort((a, b) => b.total - a.total)
    );

    setLoading(false);
  }

  const maxMonth = Math.max(...months.map((m) => m.total), 1);
  const currentTotal = categoryTotals.reduce((s, c) => s + c.total, 0);
  const currentMonthLabel = months[months.length - 1]?.label ?? "";
  const prevMonthTotal = months[months.length - 2]?.total ?? 0;
  const thisMonthTotal = months[months.length - 1]?.total ?? 0;
  const delta = prevMonthTotal > 0 ? Math.round(((thisMonthTotal - prevMonthTotal) / prevMonthTotal) * 100) : null;

  // Real 6-month stats — nothing here is invented, all derived from the
  // same `months` totals already fetched above.
  const monthTotalsOnly = months.map((m) => m.total).filter((t) => t > 0);
  const avgMonth = monthTotalsOnly.length > 0 ? monthTotalsOnly.reduce((s, t) => s + t, 0) / monthTotalsOnly.length : 0;
  const highestMonth = monthTotalsOnly.length > 0 ? Math.max(...monthTotalsOnly) : 0;
  const lowestMonth = monthTotalsOnly.length > 0 ? Math.min(...monthTotalsOnly) : 0;

  // Fastest-growing category: real month-over-month % change, computed
  // from categoryTotals' prevTotal — only shown when there's an actual
  // prior-month figure to compare against, never a guessed baseline.
  const fastestGrowing = categoryTotals
    .filter((c) => c.prevTotal > 0)
    .map((c) => ({ ...c, pct: Math.round(((c.total - c.prevTotal) / c.prevTotal) * 100) }))
    .sort((a, b) => b.pct - a.pct)[0];

  function downloadCsv() {
    const rows = [["Category", "Amount"], ...categoryTotals.map((c) => [c.category.name, c.total.toFixed(2)])];
    const csv = rows.map((r) => r.join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `expenses-${currentMonthLabel}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <>
      <LockCheck />
      <div className="px-[18px] pt-[18px] pb-1">
        <h1 className="text-[26px] font-extrabold tracking-tight">Trends</h1>
      </div>

      {monthTotalsOnly.length > 0 && (
        <div className="flex gap-2.5 px-[18px] pt-3">
          <div className="flex-1 bg-card rounded-xl2 p-3 shadow-[0_2px_10px_rgba(20,20,31,0.04)]">
            <span className="text-[10px] text-muted">Avg / month</span>
            <div className="text-[15px] font-extrabold mt-0.5">{formatCurrency(avgMonth)}</div>
          </div>
          <div className="flex-1 bg-card rounded-xl2 p-3 shadow-[0_2px_10px_rgba(20,20,31,0.04)]">
            <span className="text-[10px] text-muted">Highest</span>
            <div className="text-[15px] font-extrabold mt-0.5 text-bad-fg">{formatCurrency(highestMonth)}</div>
          </div>
          <div className="flex-1 bg-card rounded-xl2 p-3 shadow-[0_2px_10px_rgba(20,20,31,0.04)]">
            <span className="text-[10px] text-muted">Lowest</span>
            <div className="text-[15px] font-extrabold mt-0.5 text-good-fg">{formatCurrency(lowestMonth)}</div>
          </div>
        </div>
      )}

      <div className="mx-[18px] mt-3 bg-card rounded-xl2 p-4 shadow-[0_2px_10px_rgba(20,20,31,0.04)]">
        <div className="flex items-end gap-2 h-[130px]">
          {months.map((m, i) => (
            <div key={m.monthStart} className="flex-grow flex flex-col items-center gap-1.5">
              <span className={"text-[11px] " + (i === months.length - 1 ? "font-bold text-primary" : "text-muted")}>
                {m.total > 0 ? formatCurrency(m.total).replace("Rs ", "") : ""}
              </span>
              <div
                className="w-full rounded-md"
                style={{
                  height: Math.max((m.total / maxMonth) * 96, 4),
                  background: i === months.length - 1 ? "var(--color-primary)" : "var(--color-accent-soft)"
                }}
              />
            </div>
          ))}
        </div>
        <div className="flex gap-2 mt-2 pt-2 border-t border-border">
          {months.map((m, i) => (
            <span key={m.monthStart} className={"flex-grow text-center text-xs " + (i === months.length - 1 ? "font-bold text-primary" : "text-muted")}>
              {m.label}
            </span>
          ))}
        </div>
      </div>

      {delta !== null && (
        <p className="text-[15px] mx-[18px] mt-3">
          You spent {formatCurrency(Math.abs(thisMonthTotal - prevMonthTotal))} {delta >= 0 ? "more" : "less"} than last month
          {" "}({delta >= 0 ? "+" : ""}{delta}%).
        </p>
      )}

      {(categoryTotals[0] || fastestGrowing) && (
        <div className="flex gap-2.5 mx-[18px] mt-3">
          {categoryTotals[0] && (
            <div className="flex-1 bg-card rounded-xl2 p-3.5 shadow-[0_2px_10px_rgba(20,20,31,0.04)]">
              <span className="text-[11px] text-muted">Biggest category</span>
              <div className="flex items-center gap-2 mt-1.5">
                <span className="w-6 h-6 rounded-lg flex items-center justify-center shrink-0" style={{ background: categoryTotals[0].category.color_dot }}>
                  <PieChart size={12} color="#FFFFFF" strokeWidth={2} />
                </span>
                <div className="min-w-0">
                  <div className="text-[13px] font-bold truncate">{categoryTotals[0].category.name}</div>
                  <div className="text-[11px] text-muted">{Math.round((categoryTotals[0].total / (currentTotal || 1)) * 100)}% of spend</div>
                </div>
              </div>
            </div>
          )}
          {fastestGrowing && (
            <div className="flex-1 bg-card rounded-xl2 p-3.5 shadow-[0_2px_10px_rgba(20,20,31,0.04)]">
              <span className="text-[11px] text-muted">Fastest growing</span>
              <div className="flex items-center gap-2 mt-1.5">
                <span className="w-6 h-6 rounded-lg flex items-center justify-center shrink-0" style={{ background: fastestGrowing.category.color_dot }}>
                  <TrendingUp size={12} color="#FFFFFF" strokeWidth={2.2} />
                </span>
                <div className="min-w-0">
                  <div className="text-[13px] font-bold truncate">{fastestGrowing.category.name}</div>
                  <div className="text-[11px] text-bad-fg font-semibold">+{fastestGrowing.pct}% MoM</div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      <div className="flex items-center justify-between gap-3 px-5 pt-5 pb-1">
        <h2 className="text-[15px] font-bold">Where it went in {currentMonthLabel}</h2>
      </div>

      <div className="flex-grow mx-[18px] bg-card rounded-xl2 px-4 overflow-hidden shadow-[0_2px_10px_rgba(20,20,31,0.04)]">
        {loading ? (
          <SkeletonList />
        ) : categoryTotals.length === 0 ? (
          <div className="flex flex-col items-center gap-3 py-8 text-center">
            <span className="w-14 h-14 rounded-full bg-accentSoft flex items-center justify-center">
              <PieChart size={24} className="text-primary" strokeWidth={1.8} />
            </span>
            <p className="text-sm text-muted">No expenses yet this month.</p>
          </div>
        ) : (
          categoryTotals.map(({ category, total }) => (
            <div key={category.id} className="py-2.5 border-t border-border first:border-t-0">
              <div className="flex items-center gap-2.5">
                <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: category.color_dot }} />
                <span className="flex-grow text-[14px] font-medium">{category.name}</span>
                <span className="text-[14px] font-bold text-right whitespace-nowrap shrink-0">{formatCurrency(total)}</span>
              </div>
              <div className="h-[5px] rounded-full bg-track mt-1.5 ml-5 overflow-hidden">
                <div
                  className="h-full rounded-full"
                  style={{ width: `${Math.round((total / (currentTotal || 1)) * 100)}%`, background: category.color_dot }}
                />
              </div>
            </div>
          ))
        )}
        {categoryTotals.length > 0 && (
          <button type="button" onClick={downloadCsv} className="w-full h-12 text-[15px] font-semibold text-left">
            Export this month as CSV
          </button>
        )}
      </div>

      <div className="pt-3" />
      <BottomNav />
    </>
  );
}
