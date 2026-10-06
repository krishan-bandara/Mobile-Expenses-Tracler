"use client";

// Client-side auth/data pages have no static content worth pre-rendering
// at build time, and doing so made the build depend on live Supabase
// config being valid at image-build time. Force per-request rendering.
export const dynamic = "force-dynamic";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Camera, ImagePlus, ScanLine, Sparkles } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { LockCheck } from "@/components/LockCheck";
import { compressImage } from "@/lib/image";
import { clearPendingScan, readPendingScan, savePendingScan, sidecarPathFor } from "@/lib/scanPending";
import { formatCurrency } from "@/lib/utils";
import type { BillExtraction, Category } from "@/lib/types";

type Phase = "idle" | "uploading" | "reading" | "review" | "failed";

function extensionFor(type: string): string {
  if (type === "image/png") return "png";
  if (type === "image/webp") return "webp";
  return "jpg";
}

function uniqueId(): string {
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

/**
 * Scan a bill in two separate steps, on purpose:
 *
 * 1. The photo is shrunk on the phone and uploaded to Supabase
 * straight away — a second or two, and from then on it's safe no
 * matter what happens to this page.
 * 2. Only then is the server asked to read it (from storage, so the
 * request itself is tiny).
 *
 * Previously both happened in one long request with the photo saved
 * last, so a phone locking mid-way lost the photo entirely. Now the
 * pending scan is remembered, and coming back to this screen picks up
 * from the stored photo instead of starting over.
 */
export default function ScanBillPage() {
  const router = useRouter();
  const supabase = createClient();
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const galleryInputRef = useRef<HTMLInputElement>(null);

  const [categories, setCategories] = useState<Category[]>([]);
  const [phase, setPhase] = useState<Phase>("idle");
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [resumed, setResumed] = useState(false);
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

  // Pick up a scan that was interrupted (phone locked, tab discarded).
  useEffect(() => {
    const path = readPendingScan();
    if (!path) return;
    (async () => {
      setResumed(true);
      setReceiptPath(path);
      setPhase("reading");
      const { data } = await supabase.storage.from("receipts").createSignedUrl(path, 3600);
      if (data?.signedUrl) setPreviewUrl(data.signedUrl);
      await runExtraction(path);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Category matching lives in its own effect, keyed on both `result`
  // and `categories`, rather than inside the code that receives the
  // scan. Done there, it read `categories` from a closure that could
  // still be the empty initial [] if the list hadn't loaded yet — the
  // dropdown would *look* selected (browsers show the first option
  // when nothing matches) while the real state stayed empty.
  useEffect(() => {
    if (!result || categories.length === 0) return;
    const match = categories.find((c) => c.name.toLowerCase() === String(result.suggested_category ?? "").toLowerCase());
    setCategoryId((prev) => prev || match?.id || categories[0]?.id || "");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [result, categories]);

  async function runExtraction(path: string) {
    setPhase("reading");
    setError(null);
    try {
      const response = await fetch("/api/scan-bill", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ receiptPath: path })
      });
      const json = await response.json().catch(() => ({}));
      if (!response.ok) {
        // 404 = the stored photo is gone; no point offering a retry.
        if (response.status === 404) {
          clearPendingScan();
          setReceiptPath(null);
        }
        throw new Error(json.error || "Could not read the bill");
      }
      setResult(json.extraction as BillExtraction);
      setPhase("review");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong reading that photo.");
      setPhase("failed");
    }
  }

  async function handleFile(file: File) {
    const looksLikeImage = file.type.startsWith("image/") || /\.(jpe?g|png|webp|heic|heif)$/i.test(file.name);
    if (!looksLikeImage) {
      setError("That file isn't a photo. Please choose a picture of the receipt (JPG, PNG or WebP) — PDFs aren't supported yet.");
      setPhase("failed");
      return;
    }
    setError(null);
    setResult(null);
    setResumed(false);
    setCategoryId("");
    setPreviewUrl(URL.createObjectURL(file));
    setPhase("uploading");
    try {
      const {
        data: { user }
      } = await supabase.auth.getUser();
      if (!user) throw new Error("You're signed out — please sign in again.");

      const blob = await compressImage(file);
      const path = `${user.id}/${uniqueId()}.${extensionFor(blob.type)}`;
      const { error: uploadError } = await supabase.storage
        .from("receipts")
        .upload(path, blob, { contentType: blob.type || "image/jpeg" });
      if (uploadError) throw new Error(`Couldn't upload the photo: ${uploadError.message}`);

      // From this point the photo is safe — remember where it is so
      // an interrupted scan can be resumed.
      setReceiptPath(path);
      savePendingScan(path);
      await runExtraction(path);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong uploading that photo.");
      setPhase("failed");
    }
  }

  // Abandon the current scan: forget it, and tidy the stored photo and
  // its cached result so abandoned scans don't pile up in storage.
  function discardScan() {
    clearPendingScan();
    if (receiptPath) {
      void supabase.storage.from("receipts").remove([receiptPath, sidecarPathFor(receiptPath)]);
    }
    setReceiptPath(null);
    setResult(null);
    setPreviewUrl(null);
    setError(null);
    setResumed(false);
    setCategoryId("");
    setPhase("idle");
  }

  async function handleSave() {
    if (!result) return;
    setSaving(true);
    setError(null);
    const {
      data: { user }
    } = await supabase.auth.getUser();
    if (!user) {
      setSaving(false);
      setError("You're signed out — please sign in again.");
      return;
    }

    const { error: insertError } = await supabase.from("transactions").insert({
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
    if (!insertError) {
      clearPendingScan();
      // The photo stays (it's attached to the transaction now); only
      // the cached extraction next to it is no longer needed.
      if (receiptPath) void supabase.storage.from("receipts").remove([sidecarPathFor(receiptPath)]);
      router.push("/");
      router.refresh();
    } else {
      setError(insertError.message);
    }
  }

  const lowConfidence = result ? result.confidence < 0.7 : false;
  const busy = phase === "uploading" || phase === "reading";

  return (
    <>
      <LockCheck />

      <div className="flex items-center gap-3 px-[18px] pt-[18px] pb-1">
        <button
          type="button"
          onClick={() => {
            // Leaving on purpose = abandoning this scan. (If the page
            // is killed by a phone lock instead, this never runs and
            // the pending scan survives for resuming.)
            if (phase !== "idle") discardScan();
            router.push("/");
          }}
          aria-label="Back to home"
          className="w-11 h-11 rounded-2xl bg-card flex items-center justify-center shrink-0 shadow-[0_2px_8px_rgba(20,20,31,0.06)]"
        >
          <ArrowLeft size={20} strokeWidth={2.2} />
        </button>
        <h1 className="flex-grow text-[17px] font-bold">Scan a bill</h1>
      </div>

      {/* Two separate inputs: the camera one forces the camera
          (capture), the gallery one deliberately doesn't — with
          capture on, phones skip the photo picker entirely. */}
      <input
        ref={cameraInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          e.target.value = "";
          if (file) void handleFile(file);
        }}
      />
      {/* Plain accept="image/*" was opening the camera app directly on
          the user's Samsung phone — Chrome adds its own camera/photo
          shortcuts whenever *every* accepted type is an image. Listing
          one non-image type (PDF, rejected below) makes Android use its
          standard file browser instead, which has an "Images" section
          covering the whole gallery and can't launch the camera. */}
      <input
        ref={galleryInputRef}
        type="file"
        accept="image/*,application/pdf"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          e.target.value = "";
          if (file) void handleFile(file);
        }}
      />

      {phase === "idle" && (
        <div className="mx-[18px] mt-6 flex flex-col items-center gap-5 bg-card rounded-xl2 py-10 px-6 text-center shadow-[0_2px_10px_rgba(20,20,31,0.04)]">
          <div className="w-16 h-16 rounded-full bg-accentSoft flex items-center justify-center">
            <ScanLine size={28} color="#6D28D9" />
          </div>
          <p className="text-sm text-muted max-w-[260px]">
            Take a photo of a receipt, or pick one from your gallery, and we&apos;ll read the merchant, total and items automatically.
          </p>
          <div className="w-full flex flex-col gap-2.5">
            <button
              type="button"
              onClick={() => cameraInputRef.current?.click()}
              className="h-12 rounded-2xl text-white font-bold flex items-center justify-center gap-2 shadow-[0_8px_18px_rgba(124,92,252,0.3)]"
              style={{ background: "linear-gradient(135deg, var(--color-primary-light), var(--color-primary))" }}
            >
              <Camera size={18} /> Take a photo
            </button>
            <button
              type="button"
              onClick={() => galleryInputRef.current?.click()}
              className="h-12 rounded-2xl bg-accentSoft text-primary font-bold flex items-center justify-center gap-2"
            >
              <ImagePlus size={18} /> Choose from gallery
            </button>
          </div>
        </div>
      )}

      {busy && (
        <div className="mx-[18px] mt-6 flex flex-col items-center gap-3 bg-card rounded-xl2 py-12 px-6 text-center shadow-[0_2px_10px_rgba(20,20,31,0.04)]">
          {previewUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={previewUrl} alt="Your receipt" className="w-20 h-28 object-cover rounded-xl opacity-80" />
          )}
          <Sparkles size={24} className="animate-pulse" color="#6D28D9" />
          <p className="text-sm font-semibold">{phase === "uploading" ? "Uploading your photo..." : "Reading the bill..."}</p>
          <p className="text-xs text-muted max-w-[250px]">
            {resumed
              ? "Picking up where you left off."
              : phase === "uploading"
                ? "Saving it first, so nothing is lost if you leave."
                : "Your photo is saved. If you lock your phone, we'll pick this up when you come back."}
          </p>
        </div>
      )}

      {phase === "failed" && (
        <div className="mx-[18px] mt-6 flex flex-col items-center gap-4 bg-card rounded-xl2 py-10 px-6 text-center shadow-[0_2px_10px_rgba(20,20,31,0.04)]">
          <p className="text-sm text-bad-fg">{error ?? "Something went wrong."}</p>
          <div className="w-full flex flex-col gap-2.5">
            {receiptPath && (
              <button
                type="button"
                onClick={() => void runExtraction(receiptPath)}
                className="h-12 rounded-2xl text-white font-bold"
                style={{ background: "linear-gradient(135deg, var(--color-primary-light), var(--color-primary))" }}
              >
                Try again
              </button>
            )}
            <button type="button" onClick={discardScan} className="h-12 rounded-2xl bg-accentSoft text-primary font-bold">
              Start over
            </button>
          </div>
        </div>
      )}

      {phase === "review" && result && (
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
                className="w-full text-[16px] font-semibold outline-none border-b border-border py-1 bg-transparent"
              />
              <label className="block text-xs text-muted mt-2.5">Date</label>
              <input
                type="date"
                value={result.txn_date}
                onChange={(e) => setResult({ ...result, txn_date: e.target.value })}
                className="w-full text-[15px] font-semibold outline-none py-1 bg-transparent"
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
                className="w-full text-lg font-bold outline-none bg-transparent"
              />
            </div>
            <div className={"rounded-xl2 p-3.5 " + (lowConfidence ? "bg-bad-bg" : "bg-card shadow-[0_2px_10px_rgba(20,20,31,0.04)]")}>
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

          {error && <p className="text-sm text-bad-fg mx-[18px] mt-3">{error}</p>}

          <div className="flex-grow min-h-6" />

          <div className="flex gap-2.5 px-[18px] pt-4 pb-6">
            <button type="button" onClick={discardScan} className="w-32 h-14 rounded-[20px] bg-card font-bold shadow-[0_2px_8px_rgba(20,20,31,0.05)]">
              Retake
            </button>
            <button
              type="button"
              disabled={saving}
              onClick={handleSave}
              className="flex-grow h-14 rounded-[20px] text-white font-bold disabled:opacity-50 shadow-[0_8px_18px_rgba(124,92,252,0.35)]"
              style={{ background: "linear-gradient(135deg, var(--color-primary-light), var(--color-primary))" }}
            >
              {saving ? "Saving..." : "Save expense"}
            </button>
          </div>
        </>
      )}
    </>
  );
}
