"use client";

// Client-side auth/data pages have no static content worth pre-rendering
// at build time, and doing so made the build depend on live Supabase
// config being valid at image-build time. Force per-request rendering.
export const dynamic = "force-dynamic";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Settings, PieChart, Receipt, TrendingUp, TrendingDown, ChevronLeft, ChevronRight } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { BottomNav } from "@/components/BottomNav";
import { TransactionRow } from "@/components/TransactionRow";
import { DonutChart } from "@/components/DonutChart";
import { LockCheck } from "@/components/LockCheck";
import { ThemeToggle } from "@/components/ThemeToggle";
import { Greeting } from "@/components/Greeting";
import { SkeletonList } from "@/components/Skeleton";
import { formatCurrency, monthStartISO, todayISO } from "@/lib/utils";
import type { Category, Transaction } from "@/lib/types";

export default function HomePage() {
  const supabase = createClient();

  const [monthCursor, setMonthCursor] = useState(() => new Date());
  const [categories, setCategories] = useState<Category[]>([]);
  const [txns, setTxns] = useState<Transaction[]>([]);
  const [totalBudget, setTotalBudget] = useState(0);
  const [prevSpent, setPrevSpent] = useState(0);
  const [loading, setLoading] = useState(true);

  const now = new Date();
  const isCurrentMonth = monthCursor.getFullYear() === now.getFullYear() && monthCursor.getMonth() === now.getMonth();
  const monthStart = monthStartISO(monthCursor);
  const nextMonthStart = monthStartISO(new Date(monthCursor.getFullYear(), monthCursor.getMonth() + 1, 1));
  const monthLabel = monthCursor.toLocaleDateString("en-GB", { month: "long", year: "numeric" });

  useEffect(() => {
    setLoading(true);
    (async () => {
      const {
        data: { user }
      } = await supabase.auth.getUser();
      if (!user) return;

      const prevMonthDate = new Date(monthCursor.getFullYear(), monthCursor.getMonth() - 1, 1);
      const prevMonthStart = monthStartISO(prevMonthDate);

      const [{ data: categoriesData }, { data: monthTxns }, { data: budgets }, { data: prevMonthTxns }] = await Promise.all([
        supabase.from("categories").select("*").eq("user_id", user.id).order("sort_order"),
        supabase
          .from("transactions")
          .select("*")
          .eq("user_id", user.id)
          .gte("txn_date", monthStart)
          .lt("txn_date", nextMonthStart)
          .order("txn_date", { ascending: false }),
        supabase.from("budgets").select("limit_amount").eq("user_id", user.id).eq("month_start", monthStart),
        supabase
          .from("transactions")
          .select("amount, is_income, source")
          .eq("user_id", user.id)
          .gte("txn_date", prevMonthStart)
          .lt("txn_date", monthStart)
      ]);

      setCategories((categoriesData ?? []) as Category[]);
      setTxns((monthTxns ?? []) as Transaction[]);
      setTotalBudget((budgets ?? []).reduce((s, b) => s + Number(b.limit_amount), 0));
      const prevTxns = (prevMonthTxns ?? []) as { amount: number; is_income: boolean; source: string }[];
      setPrevSpent(prevTxns.filter((t) => !t.is_income && t.source !== "transfer").reduce((s, t) => s + Number(t.amount), 0));
      setLoading(false);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [monthStart, nextMonthStart]);

  const categoryById = new Map(categories.map((c) => [c.id, c]));

  // Transfers move money between your own accounts — never income or
  // an expense, so both totals below exclude them explicitly.
  const spent = txns.filter((t) => !t.is_income && t.source !== "transfer").reduce((s, t) => s + Number(t.amount), 0);
  const left = totalBudget - spent;
  const daysLeft = new Date(new Date(nextMonthStart).getTime() - 1).getDate() - now.getDate();
  const daysElapsed = now.getDate();

  // Both derived from the same month's data already fetched above — no
  // extra query, and no fabricated numbers (a decorative sparkline with
  // invented values would be exactly the kind of fake data this app
  // deliberately avoids elsewhere). Only meaningful for the current
  // month — a past month has no "today" within it, so these are
  // hidden entirely rather than shown as zero or stale.
  const today = txns
    .filter((t) => !t.is_income && t.source !== "transfer" && t.txn_date === todayISO())
    .reduce((s, t) => s + Number(t.amount), 0);
  const dailyAvg = daysElapsed > 0 ? spent / daysElapsed : 0;
  const spendDelta = prevSpent > 0 ? Math.round(((spent - prevSpent) / prevSpent) * 100) : null;

  const spendByCategory = new Map<string, number>();
  for (const t of txns) {
    if (t.is_income || !t.category_id) continue;
    spendByCategory.set(t.category_id, (spendByCategory.get(t.category_id) ?? 0) + Number(t.amount));
  }
  const donutSegments = categories
    .filter((c) => !c.is_income && spendByCategory.has(c.id))
    .sort((a, b) => (spendByCategory.get(b.id) ?? 0) - (spendByCategory.get(a.id) ?? 0))
    .map((c) => ({
      id: c.id,
      label: c.name,
      value: spendByCategory.get(c.id) ?? 0,
      color: c.color_dot
    }));

  const recent = txns.slice(0, 5);

  return (
    <>
      <LockCheck />

      <div className="flex items-center gap-2 px-[18px] pt-[18px] pb-1.5">
        <div className="flex-grow min-w-0">
          <div className="text-[13px] text-muted">
            <Greeting />
          </div>
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => setMonthCursor((d) => new Date(d.getFullYear(), d.getMonth() - 1, 1))}
              aria-label="Previous month"
              className="w-6 h-6 -ml-1.5 rounded-lg flex items-center justify-center shrink-0 text-muted"
            >
              <ChevronLeft size={15} />
            </button>
            <span className="text-[19px] font-bold">{monthLabel}</span>
            <button
              type="button"
              onClick={() => setMonthCursor((d) => new Date(d.getFullYear(), d.getMonth() + 1, 1))}
              aria-label="Next month"
              disabled={isCurrentMonth}
              className="w-6 h-6 rounded-lg flex items-center justify-center shrink-0 text-muted disabled:opacity-30"
            >
              <ChevronRight size={15} />
            </button>
          </div>
        </div>
        <ThemeToggle />
        <Link
          href="/settings"
          aria-label="Settings"
          className="relative w-11 h-11 rounded-2xl bg-card flex items-center justify-center shrink-0 shadow-[0_2px_8px_rgba(20,20,31,0.05)]"
        >
          <Settings size={21} strokeWidth={1.8} />
        </Link>
      </div>

      <div className="mx-[18px] mt-3.5 rounded-2xl p-[18px] relative overflow-hidden" style={{ background: "linear-gradient(135deg, var(--color-primary-light), var(--color-primary))" }}>
        <div className="absolute -top-6 -right-6 w-24 h-24 rounded-full bg-white/10" />
        <div className="flex items-center justify-between">
          <span className="text-xs text-white/75">{isCurrentMonth ? "This Month" : monthLabel}</span>
        </div>
        <div className="flex items-end justify-between mt-1">
          <div className="text-[30px] font-extrabold text-white tracking-tight">{formatCurrency(spent)}</div>
        </div>
        {spendDelta !== null && (
          <span className="inline-flex items-center gap-1 mt-1.5 bg-white/15 text-white text-[11px] font-bold rounded-lg px-2 py-1">
            {spendDelta >= 0 ? <TrendingUp size={11} /> : <TrendingDown size={11} />}
            {Math.abs(spendDelta)}% {spendDelta >= 0 ? "higher" : "lower"} than the month before
          </span>
        )}
        <div className="flex items-center gap-6 mt-3.5 pt-3.5 border-t border-white/20">
          <div>
            <span className="block text-[11px] text-white/75">Last Month</span>
            <span className="block text-sm font-bold text-white mt-0.5">{formatCurrency(prevSpent)}</span>
          </div>
          {isCurrentMonth && (
            <>
              <div>
                <span className="block text-[11px] text-white/75">Today</span>
                <span className="block text-sm font-bold text-white mt-0.5">{formatCurrency(today)}</span>
              </div>
              <div>
                <span className="block text-[11px] text-white/75">Daily avg</span>
                <span className="block text-sm font-bold text-white mt-0.5">{formatCurrency(dailyAvg)}</span>
              </div>
            </>
          )}
        </div>
      </div>

      <div className="mx-[18px] mt-3 bg-card rounded-xl2 p-4 shadow-[0_2px_10px_rgba(20,20,31,0.04)]">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-[15px] font-bold">Spending by Category</h2>
          {isCurrentMonth && (
            <span className="text-xs font-semibold text-muted">
              {left >= 0 ? `${formatCurrency(left)} left` : `${formatCurrency(-left)} over`}
            </span>
          )}
        </div>

        {loading ? (
          <div className="py-3">
            <SkeletonList rows={2} />
          </div>
        ) : donutSegments.length > 0 ? (
          <div className="flex items-center gap-3.5 mt-3">
            <DonutChart segments={donutSegments} size={168} strokeWidth={20} centerLabel="Total" centerValue={formatCurrency(spent)} />
            <div className="flex-grow min-w-0 flex flex-col gap-2">
              {donutSegments.map((seg) => (
                <div key={seg.id} className="flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full shrink-0" style={{ background: seg.color }} />
                  <span className="flex-grow text-xs truncate">{seg.label}</span>
                  <span className="text-xs font-bold">{Math.round((seg.value / (spent || 1)) * 100)}%</span>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className="h-[108px] flex flex-col items-center justify-center gap-2.5 text-center px-6">
            <span className="w-11 h-11 rounded-full bg-accentSoft flex items-center justify-center">
              <PieChart size={20} className="text-primary" strokeWidth={1.8} />
            </span>
            <p className="text-xs text-muted">
              {isCurrentMonth ? "No expenses yet this month — add one to see the breakdown." : `No expenses recorded in ${monthLabel}.`}
            </p>
          </div>
        )}

        {isCurrentMonth && (
          <p className="text-xs text-muted mt-3 pt-3 border-t border-border">
            {daysLeft > 0 ? `${daysLeft} days left in ${monthLabel.split(" ")[0]}.` : "Last day of the month."}
          </p>
        )}
      </div>

      <div className="flex items-center justify-between gap-3 px-5 pt-4 pb-1.5">
        <h2 className="text-[15px] font-bold">{isCurrentMonth ? "Recent Transactions" : `Transactions in ${monthLabel}`}</h2>
        <Link href="/transactions" className="text-[13px] font-semibold text-primary">
          See All
        </Link>
      </div>

      <div className="flex-grow mx-[18px] bg-card rounded-xl2 px-3.5 overflow-hidden shadow-[0_2px_10px_rgba(20,20,31,0.04)]">
        {loading ? (
          <SkeletonList rows={3} />
        ) : recent.length === 0 ? (
          <div className="flex flex-col items-center gap-3 py-6 text-center">
            <span className="w-12 h-12 rounded-full bg-accentSoft flex items-center justify-center">
              <Receipt size={22} className="text-primary" strokeWidth={1.8} />
            </span>
            <p className="text-sm text-muted">
              {isCurrentMonth ? (
                <>
                  Nothing recorded yet.{" "}
                  <Link href="/add" className="font-semibold">
                    Add your first expense
                  </Link>
                  .
                </>
              ) : (
                `Nothing recorded in ${monthLabel}.`
              )}
            </p>
          </div>
        ) : (
          recent.map((txn) => <TransactionRow key={txn.id} txn={txn} category={categoryById.get(txn.category_id ?? "") ?? null} />)
        )}
      </div>

      <div className="pb-24" />
      <BottomNav />
    </>
  );
}
