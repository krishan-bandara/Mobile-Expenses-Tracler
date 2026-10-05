import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { extractBillFromImage } from "@/lib/gemini";
import { sidecarPathFor } from "@/lib/scanPending";

export const runtime = "nodejs";
export const maxDuration = 60;

/**
 * POST { receiptPath } — JSON, not a file upload.
 *
 * The browser has already uploaded the (compressed) photo straight to
 * the private 'receipts' bucket before calling this, so this request is
 * tiny and the photo is safe in storage no matter what happens next.
 * This route reads that photo back, sends it to the vision model, and
 * returns the structured result for the review screen. Nothing is
 * written to the transactions table here — the review screen decides
 * what to keep.
 *
 * The finished extraction is also saved next to the photo as a small
 * .json file. If the phone locks mid-read and the connection drops,
 * the server carries on regardless; when the user comes back, the
 * result is already sitting there and gets returned instantly instead
 * of paying for a second model call.
 */
export async function POST(request: Request) {
  const supabase = createClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  }

  let receiptPath: unknown;
  try {
    ({ receiptPath } = await request.json());
  } catch {
    return NextResponse.json({ error: "Expected JSON with a receiptPath" }, { status: 400 });
  }

  // Only ever read from this user's own folder. Storage RLS would block
  // anything else anyway; checking here too gives a clear error.
  if (typeof receiptPath !== "string" || !receiptPath.startsWith(`${user.id}/`) || receiptPath.includes("..")) {
    return NextResponse.json({ error: "Invalid receiptPath" }, { status: 400 });
  }

  const sidecarPath = sidecarPathFor(receiptPath);

  // Already read (e.g. while the client's connection was down)?
  const cached = await supabase.storage.from("receipts").download(sidecarPath);
  if (!cached.error && cached.data) {
    try {
      const extraction = JSON.parse(await cached.data.text());
      return NextResponse.json({ extraction, receiptPath, cached: true });
    } catch {
      // Unreadable sidecar — fall through and read the photo again.
    }
  }

  const photo = await supabase.storage.from("receipts").download(receiptPath);
  if (photo.error || !photo.data) {
    return NextResponse.json({ error: "Couldn't find that photo — please take or choose it again." }, { status: 404 });
  }

  const { data: categories } = await supabase.from("categories").select("name").eq("user_id", user.id);
  const categoryNames = (categories ?? []).map((c) => c.name);

  const base64 = Buffer.from(await photo.data.arrayBuffer()).toString("base64");

  let extraction;
  try {
    extraction = await extractBillFromImage({
      imageBase64: base64,
      mimeType: photo.data.type || "image/jpeg",
      categoryNames: categoryNames.length ? categoryNames : ["Other"]
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Could not read the bill" },
      { status: 502 }
    );
  }

  // Best effort — if this fails the only cost is a re-read on resume.
  try {
    await supabase.storage
      .from("receipts")
      .upload(sidecarPath, JSON.stringify(extraction), { contentType: "application/json" });
  } catch {
    // ignore
  }

  return NextResponse.json({ extraction, receiptPath });
}
