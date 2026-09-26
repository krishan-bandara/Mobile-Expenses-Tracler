import Link from "next/link";
import { Settings, User, PieChart, Receipt } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { BottomNav } from "@/components/BottomNav";
import { TransactionRow } from "@/components/TransactionRow";
import { DonutChart } from "@/components/DonutChart";
import { LockCheck } from "@/components/LockCheck";
import { ThemeToggle } from "@/components/ThemeToggle";
import { Greeting } from "@/components/Greeting";
import { formatCurrency, monthStartISO } from "@/lib/utils";
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
  const daysLeft = new Date(new Date(nextMonthStart).getTime() - 1).getDate() - new Date().getDate();

  // Real month-over-month change, not the placeholder "+10%" / "-3%"
  // this used to always show regardless of the actual numbers. null
  // means "no prior-month data to compare against" — StatCard hides
  // the badge in that case rather than showing a meaningless 0%.
  const prevTxns = (prevMonthTxns ?? []) as { amount: number; is_income: boolean; source: string }[];
  const prevSpent = prevTxns.filter((t) => !t.is_income && t.source !== "transfer").reduce((s, t) => s + Number(t.amount), 0);
  const prevIncome = prevTxns.filter((t) => t.is_income).reduce((s, t) => s + Number(t.amount), 0);
  const incomeDelta = prevIncome > 0 ? Math.round(((income - prevIncome) / prevIncome) * 100) : null;
  const spendDelta = prevSpent > 0 ? Math.round(((spent - prevSpent) / prevSpent) * 100) : null;

  const spendByCategory = new Map<string, number>();
  for (const t of txns) {
    if (t.is_income || !t.category_id) continue;
    spendByCategory.set(t.category_id, (spendByCategory.get(t.category_id) ?? 0) + Number(t.amount));
  }
  const donutSegments = categoryList
    .filter((c) => !c.is_income && spendByCategory.has(c.id))
    .map((c) => ({
      id: c.id,
      label: c.name,
      value: spendByCategory.get(c.id) ?? 0,
      color: c.color_dot,
      bg: c.color_bg
    }));

  const recent = txns.slice(0, 5);

  return (
    <>
      <LockCheck />

      <div className="flex items-center gap-3 px-[18px] pt-[18px] pb-1.5">
        <div className="w-11 h-11 rounded-full bg-accentSoft flex items-center justify-center shrink-0">
          <User size={22} color="#6D28D9" strokeWidth={1.9} />
        </div>
        <div className="flex-grow min-w-0">
          <div className="text-[13px] text-muted">
            <Greeting />
          </div>
          <div className="text-[17px] font-bold">
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

      <div className="flex gap-3 px-[18px] pt-3">
        <StatCard label="Income" value={formatCurrency(income)} higherIsGood delta={incomeDelta} />
        <StatCard label="Spending" value={formatCurrency(spent)} higherIsGood={false} delta={spendDelta} />
      </div>

      <div className="mx-[18px] mt-3 bg-card rounded-xl2 p-4">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-[15px] font-bold">Expenses by category</h2>
          <span className="text-[13px] font-semibold bg-surface rounded-xl px-2.5 py-1.5">
            {left >= 0 ? `${formatCurrency(left)} left` : `${formatCurrency(-left)} over`}
          </span>
        </div>

        <div className="flex items-center justify-center mt-3">
          {donutSegments.length > 0 ? (
            <DonutChart
              segments={donutSegments}
              centerLabel={new Date().toLocaleDateString("en-GB", { month: "long" })}
              centerValue={formatCurrency(spent)}
            />
          ) : (
            <div className="h-[176px] flex flex-col items-center justify-center gap-3 text-center px-6">
              <span className="w-12 h-12 rounded-full bg-accentSoft flex items-center justify-center">
                <PieChart size={22} className="text-primary" strokeWidth={1.8} />
              </span>
              <p className="text-sm text-muted">No expenses yet this month — add one to see the breakdown.</p>
            </div>
          )}
        </div>

        {donutSegments.length > 0 && (
          <div className="flex flex-wrap gap-2 mt-3.5">
            {donutSegments.map((seg) => (
              <span
                key={seg.id}
                className="flex items-center gap-1.5 rounded-xl px-2.5 py-1.5 text-xs font-semibold"
                style={{ background: seg.bg }}
              >
                <span className="w-2 h-2 rounded-full" style={{ background: seg.color }} />
                {seg.label} {Math.round((seg.value / (spent || 1)) * 100)}%
              </span>
            ))}
          </div>
        )}

        <p className="text-xs text-muted mt-3 pt-3 border-t border-border">
          {daysLeft > 0 ? `${daysLeft} days left in ${new Date().toLocaleDateString("en-GB", { month: "long" })}.` : "Last day of the month."}
        </p>
      </div>

      <div className="flex items-center justify-between gap-3 px-5 pt-4 pb-1.5">
        <h2 className="text-[15px] font-bold">Transactions</h2>
        <Link href="/transactions" className="text-[13px] font-semibold">
          View all
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

function StatCard({
  label,
  value,
  higherIsGood,
  delta
}: {
  label: string;
  value: string;
  higherIsGood: boolean;
  delta: number | null;
}) {
  // Real month-over-month change now, not a fixed "+10%"/"-3%" that
  // used to show regardless of what actually happened. null means
  // there's no prior month to compare against yet — no badge in that
  // case, rather than a fabricated percentage.
  const isGood = delta !== null && (higherIsGood ? delta >= 0 : delta <= 0);
  // Built as literal class strings (not template interpolation) so
  // Tailwind's static scanner can find and generate them.
  const toneClasses = isGood ? "bg-good-bg text-good-fg" : "bg-bad-bg text-bad-fg";
  return (
    <div className="flex-1 min-w-0 bg-card rounded-xl2 p-3.5">
      {delta !== null && (
        <div className={`inline-flex items-center gap-1 text-[11px] font-bold rounded-full px-2 py-1 ${toneClasses}`}>
          {delta > 0 ? "+" : delta < 0 ? "\u2212" : ""}
          {Math.abs(delta)}% vs last month
        </div>
      )}
      <div className="text-xs text-muted mt-2.5">{label}</div>
      <div className="text-[19px] font-extrabold tracking-tight mt-0.5">{value}</div>
    </div>
  );
}
