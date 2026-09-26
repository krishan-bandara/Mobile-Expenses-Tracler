"use client";

// Client-side auth/data pages have no static content worth pre-rendering
// at build time, and doing so made the build depend on live Supabase
// config being valid at image-build time. Force per-request rendering.
export const dynamic = "force-dynamic";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Search, Receipt } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { TransactionRow } from "@/components/TransactionRow";
import { LockCheck } from "@/components/LockCheck";
import { SkeletonList } from "@/components/Skeleton";
import type { Category, Transaction } from "@/lib/types";

/**
 * Every transaction, newest first — the page Home's "View all" always
 * should have pointed to. Home only ever shows its 5 most recent as a
 * preview; this is where the rest actually live.
 */
export default function TransactionsPage() {
  const router = useRouter();
  const supabase = createClient();

  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");

  useEffect(() => {
    (async () => {
      const [{ data: txns }, { data: cats }] = await Promise.all([
        supabase.from("transactions").select("*").order("txn_date", { ascending: false }).order("created_at", { ascending: false }),
        supabase.from("categories").select("*")
      ]);
      setTransactions((txns ?? []) as Transaction[]);
      setCategories((cats ?? []) as Category[]);
      setLoading(false);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const categoryById = new Map(categories.map((c) => [c.id, c]));

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return transactions.filter((t) => {
      if (categoryFilter !== "all" && t.category_id !== categoryFilter) return false;
      if (!q) return true;
      return (t.merchant ?? "").toLowerCase().includes(q) || (t.note ?? "").toLowerCase().includes(q);
    });
  }, [transactions, query, categoryFilter]);

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

      {!loading && transactions.length > 0 && (
        <div className="mx-[18px] mt-3 flex flex-col gap-2">
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
          {filterableCategories.length > 1 && (
            <div className="flex gap-2 overflow-x-auto pb-1">
              <button
                type="button"
                onClick={() => setCategoryFilter("all")}
                className={
                  "shrink-0 h-8 px-3 rounded-full text-xs font-semibold whitespace-nowrap " +
                  (categoryFilter === "all" ? "bg-primary text-white" : "bg-card text-muted")
                }
              >
                All
              </button>
              {filterableCategories.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => setCategoryFilter(c.id)}
                  className={
                    "shrink-0 h-8 px-3 rounded-full text-xs font-semibold whitespace-nowrap " +
                    (categoryFilter === c.id ? "bg-primary text-white" : "bg-card text-muted")
                  }
                >
                  {c.name}
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      <div className="flex-grow mx-[18px] mt-3 pb-8">
        {loading ? (
          <div className="bg-card rounded-xl2 px-3.5">
            <SkeletonList />
          </div>
        ) : transactions.length === 0 ? (
          <div className="flex flex-col items-center gap-3 py-10 text-center">
            <span className="w-14 h-14 rounded-full bg-accentSoft flex items-center justify-center">
              <Receipt size={24} className="text-primary" strokeWidth={1.8} />
            </span>
            <p className="text-sm text-muted">Nothing recorded yet.</p>
          </div>
        ) : filtered.length === 0 ? (
          <p className="text-sm text-muted py-10 text-center">No transactions match that search.</p>
        ) : (
          groups.map((group) => (
            <div key={group.date} className="mb-3">
              <div className="text-xs font-semibold text-muted px-1 pb-1.5">{group.label}</div>
              <div className="bg-card rounded-xl2 px-3.5">
                {group.rows.map((txn) => (
                  <TransactionRow key={txn.id} txn={txn} category={categoryById.get(txn.category_id ?? "") ?? null} />
                ))}
              </div>
            </div>
          ))
        )}
      </div>
    </>
  );
}
