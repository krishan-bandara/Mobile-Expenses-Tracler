import Link from "next/link";
import { Settings, PieChart, Receipt, TrendingUp, TrendingDown } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { BottomNav } from "@/components/BottomNav";
import { TransactionRow } from "@/components/TransactionRow";
import { DonutChart } from "@/components/DonutChart";
import { LockCheck } from "@/components/LockCheck";
import { ThemeToggle } from "@/components/ThemeToggle";
import { Greeting } from "@/components/Greeting";
import { formatCurrency, monthStartISO, todayISO } from "@/lib/utils";
import type { Category, Transaction } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const supabase = createClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) return null; // middleware already redirects to /login

  const monthStart = monthStartISO();
  const nextMonthStart = monthStartISO(new Date(new Date(monthStart).getFullYear(), new Date(monthStart).getMonth() + 1, 1));
  const prevMonthDate = new Date(new Date(monthStart).getFullYear(), new Date(monthStart).getMonth() - 1, 1);
  const prevMonthStart = monthStartISO(prevMonthDate);

  const [{ data: categories }, { data: monthTxns }, { data: budgets }, { data: prevMonthTxns }] = await Promise.all([
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

  const categoryList = (categories ?? []) as Category[];
  const txns = (monthTxns ?? []) as Transaction[];
  const categoryById = new Map(categoryList.map((c) => [c.id, c]));

  // Transfers move money between your own accounts — never income or
  // an expense, so both totals below exclude them explicitly.
  const spent = txns.filter((t) => !t.is_income && t.source !== "transfer").reduce((s, t) => s + Number(t.amount), 0);
  const income = txns.filter((t) => t.is_income).reduce((s, t) => s + Number(t.amount), 0);
  const totalBudget = (budgets ?? []).reduce((s, b) => s + Number(b.limit_amount), 0);
  const left = totalBudget - spent;
  const now = new Date();
  const daysLeft = new Date(new Date(nextMonthStart).getTime() - 1).getDate() - now.getDate();
  const daysElapsed = now.getDate();

  const prevTxns = (prevMonthTxns ?? []) as { amount: number; is_income: boolean; source: string }[];
  const prevSpent = prevTxns.filter((t) => !t.is_income && t.source !== "transfer").reduce((s, t) => s + Number(t.amount), 0);

  // Both derived from the same month's data already fetched above — no
  // extra query, and no fabricated numbers (a decorative sparkline with
  // invented values would be exactly the kind of fake data this app
  // deliberately avoids elsewhere).
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
  const donutSegments = categoryList
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
          <div className="text-[19px] font-bold">
            {new Date().toLocaleDateString("en-GB", { month: "long", year: "numeric" })}
          </div>
        </div>
        <ThemeToggle />
        <Link
          href="/settings"
          aria-label="Settings"
          className="relative w-11 h-11 rounded-2xl bg-card flex items-center justify-center shrink-0"
        >
          <Settings size={21} strokeWidth={1.8} />
        </Link>
      </div>

      <div className="mx-[18px] mt-3.5 rounded-2xl p-[18px] relative overflow-hidden" style={{ background: "linear-gradient(135deg, var(--color-primary-light), var(--color-primary))" }}>
        <div className="absolute -top-6 -right-6 w-24 h-24 rounded-full bg-white/10" />
        <div className="flex items-center justify-between">
          <span className="text-xs text-white/75">This Month</span>
        </div>
        <div className="flex items-end justify-between mt-1">
          <div className="text-[30px] font-extrabold text-white tracking-tight">{formatCurrency(spent)}</div>
        </div>
        {spendDelta !== null && (
          <span className="inline-flex items-center gap-1 mt-1.5 bg-white/15 text-white text-[11px] font-bold rounded-lg px-2 py-1">
            {spendDelta >= 0 ? <TrendingUp size={11} /> : <TrendingDown size={11} />}
            {Math.abs(spendDelta)}% {spendDelta >= 0 ? "higher" : "lower"} than last month
          </span>
        )}
        <div className="flex items-center gap-6 mt-3.5 pt-3.5 border-t border-white/20">
          <div>
            <span className="block text-[11px] text-white/75">Last Month</span>
            <span className="block text-sm font-bold text-white mt-0.5">{formatCurrency(prevSpent)}</span>
          </div>
          <div>
            <span className="block text-[11px] text-white/75">Today</span>
            <span className="block text-sm font-bold text-white mt-0.5">{formatCurrency(today)}</span>
          </div>
          <div>
            <span className="block text-[11px] text-white/75">Daily avg</span>
            <span className="block text-sm font-bold text-white mt-0.5">{formatCurrency(dailyAvg)}</span>
          </div>
        </div>
      </div>

      <div className="mx-[18px] mt-3 bg-card rounded-xl2 p-4">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-[15px] font-bold">Spending by Category</h2>
          <span className="text-xs font-semibold text-muted">
            {left >= 0 ? `${formatCurrency(left)} left` : `${formatCurrency(-left)} over`}
          </span>
        </div>

        {donutSegments.length > 0 ? (
          <div className="flex items-center gap-3.5 mt-3">
            <DonutChart segments={donutSegments} size={108} strokeWidth={13} centerLabel="Total" centerValue={formatCurrency(spent)} />
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
            <p className="text-xs text-muted">No expenses yet this month — add one to see the breakdown.</p>
          </div>
        )}

        <p className="text-xs text-muted mt-3 pt-3 border-t border-border">
          {daysLeft > 0 ? `${daysLeft} days left in ${new Date().toLocaleDateString("en-GB", { month: "long" })}.` : "Last day of the month."}
        </p>
      </div>

      <div className="flex items-center justify-between gap-3 px-5 pt-4 pb-1.5">
        <h2 className="text-[15px] font-bold">Recent Transactions</h2>
        <Link href="/transactions" className="text-[13px] font-semibold text-primary">
          See All
        </Link>
      </div>

      <div className="flex-grow mx-[18px] bg-card rounded-xl2 px-3.5 overflow-hidden">
        {recent.length === 0 ? (
          <div className="flex flex-col items-center gap-3 py-6 text-center">
            <span className="w-12 h-12 rounded-full bg-accentSoft flex items-center justify-center">
              <Receipt size={22} className="text-primary" strokeWidth={1.8} />
            </span>
            <p className="text-sm text-muted">
              Nothing recorded yet.{" "}
              <Link href="/add" className="font-semibold">
                Add your first expense
              </Link>
              .
            </p>
          </div>
        ) : (
          recent.map((txn) => <TransactionRow key={txn.id} txn={txn} category={categoryById.get(txn.category_id ?? "") ?? null} />)
        )}
      </div>

      <div className="pt-3" />
      <BottomNav />
    </>
  );
}
