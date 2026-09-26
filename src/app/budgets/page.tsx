"use client";

// Client-side auth/data pages have no static content worth pre-rendering
// at build time, and doing so made the build depend on live Supabase
// config being valid at image-build time. Force per-request rendering.
export const dynamic = "force-dynamic";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { BottomNav } from "@/components/BottomNav";
import { BudgetBar } from "@/components/BudgetBar";
import { LockCheck } from "@/components/LockCheck";
import { SkeletonList } from "@/components/Skeleton";
import { formatCurrency, monthStartISO, daysLeftInMonth, localDateISO } from "@/lib/utils";
import type { Category } from "@/lib/types";

interface Row {
  category: Category;
  spent: number;
  limit: number;
}

export default function BudgetsPage() {
  const supabase = createClient();
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const monthStart = monthStartISO();

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function load() {
    const {
      data: { user }
    } = await supabase.auth.getUser();
    if (!user) return;

    const nextMonth = new Date(monthStart);
    nextMonth.setMonth(nextMonth.getMonth() + 1);
    const nextMonthISO = localDateISO(nextMonth);

    const [{ data: categories }, { data: budgets }, { data: txns }] = await Promise.all([
      supabase.from("categories").select("*").eq("is_income", false).eq("archived", false).order("sort_order"),
      supabase.from("budgets").select("*").eq("month_start", monthStart),
      supabase.from("transactions").select("category_id, amount").eq("is_income", false).gte("txn_date", monthStart).lt("txn_date", nextMonthISO)
    ]);

    const spentByCategory = new Map<string, number>();
    for (const t of txns ?? []) {
      if (!t.category_id) continue;
      spentByCategory.set(t.category_id, (spentByCategory.get(t.category_id) ?? 0) + Number(t.amount));
    }
    const limitByCategory = new Map((budgets ?? []).map((b) => [b.category_id, Number(b.limit_amount)]));

    setRows(
      ((categories ?? []) as Category[]).map((c) => ({
        category: c,
        spent: spentByCategory.get(c.id) ?? 0,
        limit: limitByCategory.get(c.id) ?? 0
      }))
    );
    setLoading(false);
  }

  async function updateLimit(categoryId: string, categoryName: string, limit: number, revert: () => void) {
    if (!confirm(`Set ${categoryName}'s monthly limit to ${formatCurrency(limit)}?`)) {
      revert();
      return;
    }
    setRows((rs) => rs.map((r) => (r.category.id === categoryId ? { ...r, limit } : r)));
    const {
      data: { user }
    } = await supabase.auth.getUser();
    if (!user) return;
    await supabase
      .from("budgets")
      .upsert(
        { user_id: user.id, category_id: categoryId, month_start: monthStart, limit_amount: limit },
        { onConflict: "user_id,category_id,month_start" }
      );
  }

  const totalSpent = rows.reduce((s, r) => s + r.spent, 0);
  const totalLimit = rows.reduce((s, r) => s + r.limit, 0);
  const daysLeft = daysLeftInMonth();
  const dailyAllowance = daysLeft > 0 ? Math.max(totalLimit - totalSpent, 0) / daysLeft : 0;

  return (
    <>
      <LockCheck />
      <div className="flex items-center justify-between gap-3 px-[18px] pt-[18px] pb-1">
        <h1 className="text-[26px] font-extrabold tracking-tight">Budgets</h1>
      </div>

      <div className="mx-[18px] mt-3 bg-card rounded-xl2 p-4">
        <p className="text-sm text-muted">Daily allowance for the rest of the month</p>
        <p className="text-[28px] font-extrabold tracking-tight mt-0.5">{formatCurrency(dailyAllowance)}</p>
        <p className="text-sm text-muted mt-1">
          {formatCurrency(Math.max(totalLimit - totalSpent, 0))} spread across {daysLeft || 1} day{daysLeft === 1 ? "" : "s"}.
        </p>
      </div>

      <div className="flex items-center justify-between gap-3 px-5 pt-5 pb-1">
        <h2 className="text-[15px] font-bold">By category</h2>
      </div>

      <div className="flex-grow mx-[18px] bg-card rounded-xl2 px-4 overflow-hidden">
        {loading ? (
          <SkeletonList />
        ) : (
          rows.map((row) => (
            <div key={row.category.id} className="border-t border-border first:border-t-0">
              <BudgetBar name={row.category.name} spent={row.spent} limit={row.limit} dotColor={row.category.color_dot} />
              <label className="flex items-center gap-2 pb-3 -mt-1">
                <span className="text-xs text-muted">Monthly limit</span>
                <input
                  type="number"
                  defaultValue={row.limit || ""}
                  placeholder="Not set"
                  onBlur={(e) => {
                    const el = e.target;
                    const newLimit = Number(el.value) || 0;
                    if (newLimit === row.limit) return;
                    updateLimit(row.category.id, row.category.name, newLimit, () => {
                      el.value = String(row.limit || "");
                    });
                  }}
                  className="w-24 h-8 rounded-lg bg-surface px-2 text-sm outline-none"
                />
              </label>
            </div>
          ))
        )}
      </div>

      <div className="pt-3" />
      <BottomNav />
    </>
  );
}
