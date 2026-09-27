"use client";

// Client-side auth/data pages have no static content worth pre-rendering
// at build time, and doing so made the build depend on live Supabase
// config being valid at image-build time. Force per-request rendering.
export const dynamic = "force-dynamic";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, ScanLine, Sparkles } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { LockCheck } from "@/components/LockCheck";
import { formatCurrency } from "@/lib/utils";
import type { BillExtraction, Category } from "@/lib/types";

export default function ScanBillPage() {
  const router = useRouter();
  const supabase = createClient();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [categories, setCategories] = useState<Category[]>([]);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<BillExtraction | null>(null);
  const [receiptPath, setReceiptPath] = useState<string | null>(null);
  const [categoryId, setCategoryId] = useState<string>("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    supabase
      .from("categories")
      .select("*")
      .eq("archived", false)
      .eq("is_income", false)
      .order("sort_order")
      .then(({ data }) => setCategories((data ?? []) as Category[]));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleFile(file: File) {
    setError(null);
    setPreviewUrl(URL.createObjectURL(file));
    setLoading(true);
    try {
      const formData = new FormData();
      formData.append("photo", file);
      const response = await fetch("/api/scan-bill", { method: "POST", body: formData });
      const json = await response.json();
      if (!response.ok) throw new Error(json.error || "Could not read the bill");
      setResult(json.extraction as BillExtraction);
      setReceiptPath(json.receiptPath ?? null);
      const match = categories.find((c) => c.name.toLowerCase() === String(json.extraction.suggested_category).toLowerCase());
      setCategoryId(match?.id ?? categories[0]?.id ?? "");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong reading that photo.");
    } finally {
      setLoading(false);
    }
  }

  async function handleSave() {
    if (!result) return;
    setSaving(true);
    const {
      data: { user }
    } = await supabase.auth.getUser();
    if (!user) return;

    const { error } = await supabase.from("transactions").insert({
      user_id: user.id,
      category_id: categoryId || null,
      amount: result.total,
      is_income: false,
      txn_date: result.txn_date,
      merchant: result.merchant,
      source: "bill",
      confidence: result.confidence,
      receipt_path: receiptPath,
      raw_extraction: result
    });

    setSaving(false);
    if (!error) {
      router.push("/");
      router.refresh();
    } else {
      setError(error.message);
    }
  }

  const lowConfidence = result ? result.confidence < 0.7 : false;

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
        <h1 className="flex-grow text-[17px] font-bold">Scan a bill</h1>
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) void handleFile(file);
        }}
      />

      {!result && !loading && (
        <div className="mx-[18px] mt-6 flex flex-col items-center gap-5 bg-card rounded-xl2 py-12 px-6 text-center shadow-[0_2px_10px_rgba(20,20,31,0.04)]">
          <div className="w-16 h-16 rounded-full bg-accentSoft flex items-center justify-center">
            <ScanLine size={28} color="#6D28D9" />
          </div>
          <p className="text-sm text-muted max-w-[240px]">
            Take a photo of a receipt and we&apos;ll read the merchant, total and items automatically.
          </p>
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="h-12 px-6 rounded-2xl bg-primary text-white font-bold"
          >
            Take or choose a photo
          </button>
          {error && <p className="text-sm text-bad-fg">{error}</p>}
        </div>
      )}

      {loading && (
        <div className="mx-[18px] mt-6 flex flex-col items-center gap-3 bg-card rounded-xl2 py-14 shadow-[0_2px_10px_rgba(20,20,31,0.04)]">
          <Sparkles size={24} className="animate-pulse" color="#6D28D9" />
          <p className="text-sm text-muted">Reading the bill...</p>
        </div>
      )}

      {result && (
        <>
          <div className="flex gap-3 mx-[18px] mt-4">
            {previewUrl && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={previewUrl} alt="Scanned receipt" className="w-20 h-28 object-cover rounded-xl shrink-0" />
            )}
            <div className="flex-grow bg-card rounded-xl2 p-3.5 shadow-[0_2px_10px_rgba(20,20,31,0.04)]">
              <label className="block text-xs text-muted">Merchant</label>
              <input
                value={result.merchant}
                onChange={(e) => setResult({ ...result, merchant: e.target.value })}
                className="w-full text-[16px] font-semibold outline-none border-b border-border py-1"
              />
              <label className="block text-xs text-muted mt-2.5">Date</label>
              <input
                type="date"
                value={result.txn_date}
                onChange={(e) => setResult({ ...result, txn_date: e.target.value })}
                className="w-full text-[15px] font-semibold outline-none py-1"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 mx-[18px] mt-3">
            <div className="bg-card rounded-xl2 p-3.5 shadow-[0_2px_10px_rgba(20,20,31,0.04)]">
              <label className="block text-xs text-muted">Total</label>
              <input
                type="number"
                value={result.total}
                onChange={(e) => setResult({ ...result, total: Number(e.target.value) })}
                className="w-full text-lg font-bold outline-none"
              />
            </div>
            <div className={"rounded-xl2 p-3.5 " + (lowConfidence ? "bg-bad-bg" : "bg-card")}>
              <label className={"block text-xs " + (lowConfidence ? "text-bad-fg" : "text-muted")}>Tax</label>
              <input
                type="number"
                value={result.tax ?? 0}
                onChange={(e) => setResult({ ...result, tax: Number(e.target.value) })}
                className={"w-full text-lg font-bold outline-none bg-transparent " + (lowConfidence ? "text-bad-fg" : "")}
              />
            </div>
          </div>

          {lowConfidence && (
            <p className="text-xs text-bad-fg mx-[18px] mt-2">
              Some of this was hard to read. Check the numbers against the paper before saving.
            </p>
          )}

          <div className="mx-[18px] mt-3 bg-card rounded-xl2 px-4 shadow-[0_2px_10px_rgba(20,20,31,0.04)]">
            <label className="flex items-center gap-3 h-[54px]">
              <span className="flex-grow text-sm text-muted">Category</span>
              <select
                value={categoryId}
                onChange={(e) => setCategoryId(e.target.value)}
                className="text-[15px] font-semibold bg-transparent outline-none text-right"
              >
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </label>
          </div>

          {result.line_items.length > 0 && (
            <div className="mx-[18px] mt-3 bg-card rounded-xl2 px-4 shadow-[0_2px_10px_rgba(20,20,31,0.04)]">
              {result.line_items.map((item, i) => (
                <div key={i} className="flex items-center justify-between gap-3 h-11 border-t border-border first:border-t-0 text-sm">
                  <span>{item.name}</span>
                  <span className="text-muted">{formatCurrency(item.amount)}</span>
                </div>
              ))}
            </div>
          )}

          <div className="flex-grow" />

          <div className="flex gap-2.5 px-[18px] pt-4 pb-6">
            <button
              type="button"
              onClick={() => {
                setResult(null);
                setPreviewUrl(null);
              }}
              className="w-32 h-14 rounded-[20px] bg-card font-bold"
            >
              Retake
            </button>
            <button
              type="button"
              disabled={saving}
              onClick={handleSave}
              className="flex-grow h-14 rounded-[20px] bg-primary text-white font-bold disabled:opacity-50"
            >
              {saving ? "Saving..." : "Save expense"}
            </button>
          </div>
        </>
      )}
    </>
  );
}
