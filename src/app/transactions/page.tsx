"use client";

// Client-side auth/data pages have no static content worth pre-rendering
// at build time, and doing so made the build depend on live Supabase
// config being valid at image-build time. Force per-request rendering.
export const dynamic = "force-dynamic";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, ChevronLeft, ChevronRight, Search, Receipt, X } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { TransactionRow } from "@/components/TransactionRow";
import { LockCheck } from "@/components/LockCheck";
import { SkeletonList } from "@/components/Skeleton";
import { formatCurrency, monthStartISO } from "@/lib/utils";
import type { Category, Transaction } from "@/lib/types";

/**
 * Every transaction, month by month — loads the current month by
 * default rather than your entire history at once, with prev/next
 * navigation and a jump-to-month picker. You can pick any number of
 * individual dates to total just those together (not just one day or
 * a whole month), and categories are multi-select. The summary below
 * shows income and spending as two separate amounts rather than
 * netting them into one, since that's usually what's actually useful
 * to see at a glance.
 */
function dedupeById(rows: Transaction[]): Transaction[] {
  const seen = new Set<string>();
  return rows.filter((r) => {
    if (seen.has(r.id)) return false;
    seen.add(r.id);
    return true;
  });
}

export default function TransactionsPage() {
  const router = useRouter();
  const supabase = createClient();

  const [monthCursor, setMonthCursor] = useState(() => new Date());
  const [rangeStart, setRangeStart] = useState("");
  const [rangeEnd, setRangeEnd] = useState("");
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<string[]>([]);
  const [showCategoryPicker, setShowCategoryPicker] = useState(false);

  const monthStart = monthStartISO(monthCursor);
  const nextMonthStart = monthStartISO(new Date(monthCursor.getFullYear(), monthCursor.getMonth() + 1, 1));
  const monthLabel = monthCursor.toLocaleDateString("en-GB", { month: "long", year: "numeric" });

  useEffect(() => {
    setLoading(true);
    (async () => {
      const [{ data: txns }, { data: cats }] = await Promise.all([
        supabase
          .from("transactions")
          .select("*")
          .gte("txn_date", monthStart)
          .lt("txn_date", nextMonthStart)
          .order("txn_date", { ascending: false })
          .order("created_at", { ascending: false }),
        supabase.from("categories").select("*")
      ]);
      setTransactions(dedupeById((txns ?? []) as Transaction[]));
      setCategories((cats ?? []) as Category[]);
      setLoading(false);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [monthStart, nextMonthStart]);

  const categoryById = new Map(categories.map((c) => [c.id, c]));

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return transactions.filter((t) => {
      if (rangeStart && t.txn_date < rangeStart) return false;
      if (rangeEnd && t.txn_date > rangeEnd) return false;
      if (categoryFilter.length > 0 && !categoryFilter.includes(t.category_id ?? "")) return false;
      if (!q) return true;
      return (t.merchant ?? "").toLowerCase().includes(q) || (t.note ?? "").toLowerCase().includes(q);
    });
  }, [transactions, query, categoryFilter, rangeStart, rangeEnd]);

  // Shown as two separate figures rather than netted into one — a
  // single "+Rs 12,000" line hides whether that's a big income month
  // or just barely-positive after heavy spending, which is exactly the
  // distinction that's actually useful at a glance.
  const incomeTotal = filtered.filter((t) => t.is_income).reduce((s, t) => s + Number(t.amount), 0);
  const expenseTotal = filtered
    .filter((t) => !t.is_income && t.source !== "transfer")
    .reduce((s, t) => s + Number(t.amount), 0);

  // Group by calendar date so the list reads like a statement rather
  // than one long undifferentiated feed.
  const groups: { date: string; label: string; rows: Transaction[] }[] = [];
  for (const t of filtered) {
    const last = groups[groups.length - 1];
    if (last && last.date === t.txn_date) {
      last.rows.push(t);
    } else {
      groups.push({
        date: t.txn_date,
        label: new Date(t.txn_date).toLocaleDateString("en-GB", {
          weekday: "short",
          day: "numeric",
          month: "short",
          year: "numeric"
        }),
        rows: [t]
      });
    }
  }

  const usedCategoryIds = new Set(transactions.map((t) => t.category_id).filter(Boolean) as string[]);
  const filterableCategories = categories.filter((c) => usedCategoryIds.has(c.id));

  function shiftMonth(delta: number) {
    setMonthCursor((d) => new Date(d.getFullYear(), d.getMonth() + delta, 1));
    setRangeStart("");
    setRangeEnd("");
  }

  function toggleCategory(id: string) {
    setCategoryFilter((ids) => (ids.includes(id) ? ids.filter((x) => x !== id) : [...ids, id]));
  }

  return (
    <>
      <LockCheck />
      <div className="flex items-center gap-3 px-[18px] pt-[18px] pb-1">
        <button
          type="button"
          onClick={() => router.push("/")}
          aria-label="Back to home"
          className="w-11 h-11 rounded-2xl bg-card flex items-center justify-center shrink-0"
        >
          <ArrowLeft size={20} strokeWidth={2.2} />
        </button>
        <h1 className="flex-grow text-[17px] font-bold">All transactions</h1>
      </div>

      <div className="mx-[18px] mt-3 flex items-center gap-2 bg-card rounded-xl2 p-2">
        <button
          type="button"
          onClick={() => shiftMonth(-1)}
          aria-label="Previous month"
          className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0 text-muted"
        >
          <ChevronLeft size={18} />
        </button>
        <label className="flex-grow relative">
          <span className="sr-only">Jump to month</span>
          <input
            type="month"
            value={`${monthCursor.getFullYear()}-${String(monthCursor.getMonth() + 1).padStart(2, "0")}`}
            onChange={(e) => {
              if (!e.target.value) return;
              const [y, m] = e.target.value.split("-").map(Number);
              setMonthCursor(new Date(y, m - 1, 1));
              setRangeStart("");
              setRangeEnd("");
            }}
            className="absolute inset-0 opacity-0 cursor-pointer"
          />
          <span className="block text-center text-[15px] font-bold pointer-events-none">{monthLabel}</span>
        </label>
        <button
          type="button"
          onClick={() => shiftMonth(1)}
          aria-label="Next month"
          className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0 text-muted"
        >
          <ChevronRight size={18} />
        </button>
      </div>

      <div className="mx-[18px] mt-2 flex flex-col gap-2">
        <div className="flex items-center gap-2 bg-card rounded-xl px-3 h-11">
          <Search size={16} className="text-muted shrink-0" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search by shop or note"
            className="flex-grow min-w-0 bg-transparent outline-none text-[15px]"
          />
        </div>

        {/*
          A range, not a set of individual days — picking 21/09 and
          25/09 here means "everything from the 21st through the 25th
          inclusive", not just those two specific days. That's what
          "select two dates" actually meant; the earlier add-one-at-a-
          time chip picker was solving a different problem than the one
          being asked for.
        */}
        <div className="flex items-center gap-2">
          <label className="flex items-center gap-2 bg-card rounded-xl px-3 h-10 flex-grow">
            <span className="text-xs text-muted shrink-0">From</span>
            <input
              type="date"
              value={rangeStart}
              onChange={(e) => setRangeStart(e.target.value)}
              className="flex-grow min-w-0 bg-transparent outline-none text-[13px]"
            />
          </label>
          <label className="flex items-center gap-2 bg-card rounded-xl px-3 h-10 flex-grow">
            <span className="text-xs text-muted shrink-0">To</span>
            <input
              type="date"
              value={rangeEnd}
              onChange={(e) => setRangeEnd(e.target.value)}
              className="flex-grow min-w-0 bg-transparent outline-none text-[13px]"
            />
          </label>
          {(rangeStart || rangeEnd) && (
            <button
              type="button"
              onClick={() => {
                setRangeStart("");
                setRangeEnd("");
              }}
              aria-label="Clear date range"
              className="w-10 h-10 rounded-xl bg-card flex items-center justify-center shrink-0 text-muted"
            >
              <X size={16} />
            </button>
          )}
        </div>


        {filterableCategories.length > 0 && (
          <div>
            <button
              type="button"
              onClick={() => setShowCategoryPicker((s) => !s)}
              className="h-9 px-3 rounded-xl bg-card text-xs font-semibold flex items-center gap-1.5"
            >
              {categoryFilter.length === 0 ? "All categories" : `${categoryFilter.length} categor${categoryFilter.length === 1 ? "y" : "ies"} selected`}
              <ChevronRight size={13} className={"transition-transform " + (showCategoryPicker ? "rotate-90" : "")} />
            </button>
            {showCategoryPicker && (
              <div className="flex gap-2 flex-wrap mt-2 bg-card rounded-xl2 p-3">
                {filterableCategories.map((c) => {
                  const active = categoryFilter.includes(c.id);
                  return (
                    <button
                      key={c.id}
                      type="button"
                      aria-pressed={active}
                      onClick={() => toggleCategory(c.id)}
                      className={
                        "flex items-center gap-1.5 h-8 px-3 rounded-full text-xs font-semibold " +
                        (active ? "bg-primary text-white" : "bg-surface text-ink")
                      }
                    >
                      <span className="w-2 h-2 rounded-full" style={{ background: c.color_dot }} />
                      {c.name}
                    </button>
                  );
                })}
                {categoryFilter.length > 0 && (
                  <button type="button" onClick={() => setCategoryFilter([])} className="h-8 px-3 rounded-full text-xs font-semibold text-bad-fg">
                    Clear
                  </button>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      <div className="flex-grow mx-[18px] mt-3">
        {loading ? (
          <div className="bg-card rounded-xl2 px-3.5">
            <SkeletonList />
          </div>
        ) : transactions.length === 0 ? (
          <div className="flex flex-col items-center gap-3 py-10 text-center">
            <span className="w-14 h-14 rounded-full bg-accentSoft flex items-center justify-center">
              <Receipt size={24} className="text-primary" strokeWidth={1.8} />
            </span>
            <p className="text-sm text-muted">Nothing recorded in {monthLabel}.</p>
          </div>
        ) : filtered.length === 0 ? (
          <p className="text-sm text-muted py-10 text-center">Nothing matches those filters.</p>
        ) : (
          groups.map((group) => (
            <div key={group.date} className="mb-3 isolate">
              <div className="text-xs font-semibold text-muted px-1 pb-1.5">{group.label}</div>
              <div className="bg-card rounded-xl2 px-3.5 overflow-hidden">
                {group.rows.map((txn) => (
                  <TransactionRow key={txn.id} txn={txn} category={categoryById.get(txn.category_id ?? "") ?? null} />
                ))}
              </div>
            </div>
          ))
        )}
      </div>

      {!loading && filtered.length > 0 && (
        <div className="mx-[18px] mb-8 mt-1 bg-card rounded-xl2 p-4">
          <span className="text-xs text-muted">
            {filtered.length === transactions.length
              ? `${monthLabel}`
              : rangeStart || rangeEnd
                ? rangeStart && rangeEnd
                  ? `${new Date(rangeStart).toLocaleDateString("en-GB", { day: "numeric", month: "short" })} – ${new Date(rangeEnd).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}`
                  : `From ${new Date(rangeStart || rangeEnd).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}`
                : "This filter"}
          </span>
          <div className="flex items-center justify-between mt-1.5">
            <span className="text-sm text-muted">Income</span>
            <span className="text-base font-bold text-good-fg">+{formatCurrency(incomeTotal)}</span>
          </div>
          <div className="flex items-center justify-between mt-1">
            <span className="text-sm text-muted">Spending</span>
            <span className="text-base font-bold text-bad-fg">−{formatCurrency(expenseTotal)}</span>
          </div>
        </div>
      )}
    </>
  );
}
