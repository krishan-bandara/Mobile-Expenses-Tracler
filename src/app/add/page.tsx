"use client";

// Client-side auth/data pages have no static content worth pre-rendering
// at build time, and doing so made the build depend on live Supabase
// config being valid at image-build time. Force per-request rendering.
export const dynamic = "force-dynamic";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Keypad } from "@/components/Keypad";
import { LockCheck } from "@/components/LockCheck";
import { queueTransaction, syncPendingTransactions } from "@/lib/db/offline";
import { todayISO, formatCurrency } from "@/lib/utils";
import type { Account, Category } from "@/lib/types";

type Mode = "out" | "in" | "transfer";

export default function AddExpensePage() {
  const router = useRouter();
  const supabase = createClient();

  const [mode, setMode] = useState<Mode>("out");
  const [amount, setAmount] = useState("0");
  const [categories, setCategories] = useState<Category[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [categoryId, setCategoryId] = useState<string>("");
  const [accountId, setAccountId] = useState<string>("");
  const [toAccountId, setToAccountId] = useState<string>("");
  const [note, setNote] = useState("");
  const [date, setDate] = useState(todayISO());
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function selectMode(next: Mode) {
    setMode(next);
    setError(null);
    if (next === "transfer") return;
    // The category list depends on which mode we're in — re-pick a
    // sensible default for the new mode instead of leaving whatever
    // category id was selected before. Leaving it stale was exactly
    // why an income entry could silently save under an expense
    // category like Groceries: the dropdown itself would show no
    // matching option, but the old id was still what got submitted.
    const match = categories.find((c) => c.is_income === (next === "in"));
    setCategoryId(match?.id ?? "");
  }

  useEffect(() => {
    (async () => {
      const [{ data: cats }, { data: accs }] = await Promise.all([
        supabase.from("categories").select("*").eq("archived", false).order("sort_order"),
        supabase.from("accounts").select("*").eq("archived", false).order("sort_order")
      ]);
      const catList = (cats ?? []) as Category[];
      const accList = (accs ?? []) as Account[];
      setCategories(catList);
      setAccounts(accList);
      setCategoryId(catList.find((c) => !c.is_income)?.id ?? "");
      setAccountId(accList[0]?.id ?? "");
      setToAccountId(accList[1]?.id ?? accList[0]?.id ?? "");
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function handleKey(key: string) {
    if (key === "back") {
      setAmount((a) => (a.length > 1 ? a.slice(0, -1) : "0"));
      return;
    }
    if (key === "." && amount.includes(".")) return;
    setAmount((a) => (a === "0" && key !== "." ? key : a + key));
  }

  async function handleSave() {
    const numericAmount = Number(amount);
    if (!numericAmount || numericAmount <= 0) return;

    if (mode === "transfer" && accountId === toAccountId) {
      setError("Pick two different accounts for a transfer.");
      return;
    }

    setSaving(true);
    setError(null);

    const payload =
      mode === "transfer"
        ? {
            account_id: accountId || null,
            to_account_id: toAccountId || null,
            category_id: null,
            amount: numericAmount,
            is_income: false,
            txn_date: date,
            merchant: note || null,
            note: null,
            source: "transfer" as const
          }
        : {
            account_id: accountId || null,
            category_id: categoryId || null,
            amount: numericAmount,
            is_income: mode === "in",
            txn_date: date,
            merchant: note || null,
            note: null,
            source: "manual" as const
          };

    try {
      if (navigator.onLine) {
        const {
          data: { user }
        } = await supabase.auth.getUser();
        if (!user) throw new Error("Not signed in");
        const { error } = await supabase.from("transactions").insert({ user_id: user.id, ...payload });
        if (error) throw error;
      } else {
        await queueTransaction(payload);
      }
      router.push("/");
      router.refresh();
    } catch {
      // Fall back to the offline queue on any network/insert error —
      // better to keep the entry than lose it. (Transfers created
      // offline still queue fine — to_account_id rides along with the
      // rest of the payload.)
      await queueTransaction(payload);
      router.push("/");
      router.refresh();
    } finally {
      setSaving(false);
      void syncPendingTransactions();
    }
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
        <h1 className="flex-grow text-[17px] font-bold">
          {mode === "transfer" ? "Transfer" : "Add expense"}
        </h1>
      </div>

      <div className="flex gap-1 mx-[18px] mt-3.5 bg-card rounded-2xl p-1.5">
        <button
          type="button"
          aria-pressed={mode === "out"}
          onClick={() => selectMode("out")}
          className={"flex-1 h-[42px] rounded-xl text-sm font-bold " + (mode === "out" ? "bg-primary text-white" : "text-muted")}
        >
          Money out
        </button>
        <button
          type="button"
          aria-pressed={mode === "in"}
          onClick={() => selectMode("in")}
          className={"flex-1 h-[42px] rounded-xl text-sm font-semibold " + (mode === "in" ? "bg-primary text-white" : "text-muted")}
        >
          Money in
        </button>
        <button
          type="button"
          aria-pressed={mode === "transfer"}
          onClick={() => selectMode("transfer")}
          className={"flex-1 h-[42px] rounded-xl text-sm font-semibold " + (mode === "transfer" ? "bg-primary text-white" : "text-muted")}
        >
          Transfer
        </button>
      </div>

      <div className="mx-[18px] mt-3 bg-card rounded-xl2 p-[18px]">
        <label htmlFor="amount-display" className="block text-xs text-muted">
          Amount
        </label>
        <div className="flex items-baseline gap-2 mt-0.5">
          <span className="text-[22px] font-bold text-muted">Rs</span>
          <span id="amount-display" className="flex-grow text-right text-[44px] font-extrabold tracking-tight">
            {amount}
          </span>
        </div>
      </div>

      <div className="mx-[18px] mt-3 bg-card rounded-xl2 px-4">
        {mode === "transfer" ? (
          <>
            <label className="flex items-center gap-3 h-[58px]">
              <span className="flex-grow text-sm text-muted">From</span>
              <select
                value={accountId}
                onChange={(e) => setAccountId(e.target.value)}
                className="text-[15px] font-semibold bg-transparent outline-none text-right"
              >
                {accounts.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex items-center gap-3 h-[58px] border-t border-border">
              <span className="flex-grow text-sm text-muted">To</span>
              <select
                value={toAccountId}
                onChange={(e) => setToAccountId(e.target.value)}
                className="text-[15px] font-semibold bg-transparent outline-none text-right"
              >
                {accounts.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name}
                  </option>
                ))}
              </select>
            </label>
          </>
        ) : categories.filter((c) => c.is_income === (mode === "in")).length === 0 ? (
          <div className="flex items-center gap-3 h-[58px]">
            <span className="flex-grow text-sm text-bad-fg">
              No {mode === "in" ? "income" : "expense"} categories yet — add one in Settings → Categories.
            </span>
          </div>
        ) : (
          <label className="flex items-center gap-3 h-[58px]">
            <span className="flex-grow text-sm text-muted">Category</span>
            <select
              value={categoryId}
              onChange={(e) => setCategoryId(e.target.value)}
              className="text-[15px] font-semibold bg-transparent outline-none text-right"
            >
              {categories
                .filter((c) => c.is_income === (mode === "in"))
                .map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
            </select>
          </label>
        )}
        {mode !== "transfer" && (
          <label className="flex items-center gap-3 h-[58px] border-t border-border">
            <span className="flex-grow text-sm text-muted">Account</span>
            <select
              value={accountId}
              onChange={(e) => setAccountId(e.target.value)}
              className="text-[15px] font-semibold bg-transparent outline-none text-right"
            >
              {accounts.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                </option>
              ))}
            </select>
          </label>
        )}
        <label className="flex items-center gap-3 h-[58px] border-t border-border">
          <span className="flex-grow text-sm text-muted">Date</span>
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="text-[15px] font-semibold bg-transparent outline-none text-right"
          />
        </label>
        <label className="flex items-center gap-3 h-[58px] border-t border-border">
          <span className="text-sm text-muted">Note</span>
          <input
            type="text"
            placeholder="Optional"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            className="flex-grow min-w-0 text-[15px] font-semibold bg-transparent outline-none text-right"
          />
        </label>
      </div>

      {error && <p className="text-sm text-bad-fg mx-[18px] mt-3">{error}</p>}

      <div className="flex-grow" />

      <div className="px-[18px]">
        <Keypad onKey={handleKey} />
      </div>

      <div className="px-[18px] pt-3.5 pb-6">
        <button
          type="button"
          disabled={saving || !Number(amount)}
          onClick={handleSave}
          className="w-full h-14 rounded-[20px] bg-primary text-white text-base font-bold disabled:opacity-50"
        >
          {saving ? "Saving..." : `${mode === "transfer" ? "Transfer" : "Save"} ${formatCurrency(Number(amount) || 0)}`}
        </button>
      </div>
    </>
  );
}
