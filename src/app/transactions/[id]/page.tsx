"use client";

// Client-side auth/data pages have no static content worth pre-rendering
// at build time, and doing so made the build depend on live Supabase
// config being valid at image-build time. Force per-request rendering.
export const dynamic = "force-dynamic";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft, ImageIcon } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { LockCheck } from "@/components/LockCheck";
import { formatCurrency } from "@/lib/utils";
import type { Account, Category, Transaction } from "@/lib/types";

export default function EditTransactionPage() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const supabase = createClient();

  const [txn, setTxn] = useState<Transaction | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [amount, setAmount] = useState("");
  const [merchant, setMerchant] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [accountId, setAccountId] = useState("");
  const [date, setDate] = useState("");
  const [receiptUrl, setReceiptUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const [{ data: t, error: txnError }, { data: cats }, { data: accs }] = await Promise.all([
        supabase.from("transactions").select("*").eq("id", params.id).single(),
        supabase.from("categories").select("*").eq("archived", false).order("sort_order"),
        supabase.from("accounts").select("*").eq("archived", false).order("sort_order")
      ]);

      if (txnError || !t) {
        setError("Couldn't find that transaction.");
        setLoading(false);
        return;
      }

      const transaction = t as Transaction;
      setTxn(transaction);
      setAmount(String(transaction.amount));
      setMerchant(transaction.merchant ?? "");
      setCategoryId(transaction.category_id ?? "");
      setAccountId(transaction.account_id ?? "");
      setDate(transaction.txn_date);
      setCategories((cats ?? []) as Category[]);
      setAccounts((accs ?? []) as Account[]);

      if (transaction.receipt_path) {
        const { data: signed } = await supabase.storage
          .from("receipts")
          .createSignedUrl(transaction.receipt_path, 60 * 10);
        setReceiptUrl(signed?.signedUrl ?? null);
      }

      setLoading(false);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params.id]);

  async function handleSave() {
    if (!txn) return;
    const numericAmount = Number(amount);
    if (!numericAmount || numericAmount <= 0) return;
    if (!confirm(`Save changes to this ${txn.is_income ? "income" : "expense"} entry?`)) return;

    setSaving(true);
    const { error } = await supabase
      .from("transactions")
      .update({
        amount: numericAmount,
        merchant: merchant || null,
        category_id: categoryId || null,
        account_id: accountId || null,
        txn_date: date
      })
      .eq("id", txn.id);
    setSaving(false);

    if (error) {
      setError(error.message);
      return;
    }
    router.push("/transactions");
    router.refresh();
  }

  async function handleDelete() {
    if (!txn) return;
    if (
      !confirm(
        "Delete this transaction? Unlike categories, this is a real, permanent delete — there's no way to bring it back afterward."
      )
    ) {
      return;
    }
    setSaving(true);
    const { error } = await supabase.from("transactions").delete().eq("id", txn.id);
    setSaving(false);

    if (error) {
      setError(error.message);
      return;
    }
    router.push("/transactions");
    router.refresh();
  }

  if (loading) {
    return (
      <>
        <LockCheck />
        <div className="flex items-center gap-3 px-[18px] pt-[18px] pb-1">
          <button
            type="button"
            onClick={() => router.push("/transactions")}
            aria-label="Back to transactions"
            className="w-11 h-11 rounded-2xl bg-card flex items-center justify-center shrink-0"
          >
            <ArrowLeft size={20} strokeWidth={2.2} />
          </button>
          <h1 className="flex-grow text-[17px] font-bold">Edit transaction</h1>
        </div>
        <div className="mx-[18px] mt-3 bg-card rounded-xl2 p-4 animate-pulse">
          <div className="h-4 w-24 bg-track rounded mb-3" />
          <div className="h-10 bg-track rounded" />
        </div>
      </>
    );
  }

  if (error && !txn) {
    return (
      <>
        <LockCheck />
        <div className="flex items-center gap-3 px-[18px] pt-[18px] pb-1">
          <button
            type="button"
            onClick={() => router.push("/transactions")}
            aria-label="Back to transactions"
            className="w-11 h-11 rounded-2xl bg-card flex items-center justify-center shrink-0"
          >
            <ArrowLeft size={20} strokeWidth={2.2} />
          </button>
          <h1 className="flex-grow text-[17px] font-bold">Edit transaction</h1>
        </div>
        <p className="text-sm text-bad-fg text-center mt-8">{error}</p>
      </>
    );
  }

  if (!txn) return null;

  return (
    <>
      <LockCheck />
      <div className="flex items-center gap-3 px-[18px] pt-[18px] pb-1">
        <button
          type="button"
          onClick={() => router.push("/transactions")}
          aria-label="Back to transactions"
          className="w-11 h-11 rounded-2xl bg-card flex items-center justify-center shrink-0 active:scale-95 transition-transform"
        >
          <ArrowLeft size={20} strokeWidth={2.2} />
        </button>
        <h1 className="flex-grow text-[17px] font-bold">
          {txn.is_income ? "Edit income" : "Edit expense"}
        </h1>
      </div>

      {txn.source === "bill" && (
        <div className="mx-[18px] mt-3 bg-accentSoft rounded-xl px-4 py-2.5">
          <p className="text-xs text-muted">Originally read from a scanned bill.</p>
        </div>
      )}
      {txn.source === "transfer" && (
        <div className="mx-[18px] mt-3 bg-accentSoft rounded-xl px-4 py-2.5">
          <p className="text-xs text-muted">This is a transfer between your own accounts.</p>
        </div>
      )}

      <div className="mx-[18px] mt-3 bg-card rounded-xl2 p-[18px]">
        <label htmlFor="edit-amount" className="block text-xs text-muted">
          Amount
        </label>
        <div className="flex items-baseline gap-2 mt-0.5">
          <span className="text-[22px] font-bold text-muted">Rs</span>
          <input
            id="edit-amount"
            type="number"
            inputMode="decimal"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            className="flex-grow text-right text-[32px] font-extrabold tracking-tight bg-transparent outline-none"
          />
        </div>
      </div>

      <div className="mx-[18px] mt-3 bg-card rounded-xl2 px-4">
        <label className="flex items-center gap-3 h-[58px] border-b border-border">
          <span className="flex-grow text-sm text-muted">Category</span>
          <select
            value={categoryId}
            onChange={(e) => setCategoryId(e.target.value)}
            className="text-[15px] font-semibold bg-transparent outline-none text-right"
          >
            <option value="">None</option>
            {categories
              .filter((c) => c.is_income === txn.is_income)
              .map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
          </select>
        </label>
        <label className="flex items-center gap-3 h-[58px] border-b border-border">
          <span className="flex-grow text-sm text-muted">Account</span>
          <select
            value={accountId}
            onChange={(e) => setAccountId(e.target.value)}
            className="text-[15px] font-semibold bg-transparent outline-none text-right"
          >
            <option value="">None</option>
            {accounts.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name}
              </option>
            ))}
          </select>
        </label>
        <label className="flex items-center gap-3 h-[58px] border-b border-border">
          <span className="flex-grow text-sm text-muted">Date</span>
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="text-[15px] font-semibold bg-transparent outline-none text-right"
          />
        </label>
        <label className="flex items-center gap-3 h-[58px]">
          <span className="text-sm text-muted">Note</span>
          <input
            type="text"
            value={merchant}
            onChange={(e) => setMerchant(e.target.value)}
            placeholder="Optional"
            className="flex-grow min-w-0 text-[15px] font-semibold bg-transparent outline-none text-right"
          />
        </label>
      </div>

      {receiptUrl && (
        <a
          href={receiptUrl}
          target="_blank"
          rel="noreferrer"
          className="mx-[18px] mt-3 bg-card rounded-xl2 p-4 flex items-center gap-3 active:scale-[0.98] transition-transform"
        >
          <span className="w-10 h-10 rounded-xl bg-accentSoft flex items-center justify-center shrink-0">
            <ImageIcon size={18} strokeWidth={1.9} />
          </span>
          <span className="text-[15px] font-semibold text-primary">View original receipt</span>
        </a>
      )}

      {error && <p className="text-sm text-bad-fg mx-[18px] mt-3">{error}</p>}

      <div className="flex-grow" />

      <div className="flex gap-2.5 px-[18px] pt-4 pb-6">
        <button
          type="button"
          disabled={saving}
          onClick={handleDelete}
          className="w-28 h-14 rounded-[20px] bg-bad-bg text-bad-fg font-bold disabled:opacity-50 active:scale-95 transition-transform"
        >
          Delete
        </button>
        <button
          type="button"
          disabled={saving || !Number(amount)}
          onClick={handleSave}
          className="flex-grow h-14 rounded-[20px] bg-primary text-white font-bold disabled:opacity-50 active:scale-95 transition-transform"
        >
          {saving ? "Saving..." : `Save ${formatCurrency(Number(amount) || 0)}`}
        </button>
      </div>
    </>
  );
}
