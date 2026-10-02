import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { extractBillFromImage } from "@/lib/gemini";

export const runtime = "nodejs";
export const maxDuration = 60;

const MAX_BYTES = 10 * 1024 * 1024;
const ALLOWED_TYPES: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/heic": "heic"
};

/**
 * POST multipart/form-data with a single "photo" file field.
 * Uploads the photo to the private 'receipts' bucket, sends it to the
 * vision model for extraction, and returns the structured result plus
 * the storage path so the client can attach it to the transaction it
 * eventually saves. Nothing is written to the transactions table here —
 * the review screen decides what to keep.
 */
export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  }

  const formData = await request.formData();
  const file = formData.get("photo");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "Missing 'photo' file" }, { status: 400 });
  }

  const { data: categories } = await supabase.from("categories").select("name").eq("user_id", user.id);
  const categoryNames = (categories ?? []).map((c) => c.name);

  const ext = ALLOWED_TYPES[file.type];
  if (!ext) {
    return NextResponse.json({ error: "Unsupported image type" }, { status: 415 });
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json({ error: "Image too large (max 10 MB)" }, { status: 413 });
  }

  const arrayBuffer = await file.arrayBuffer();
  const base64 = Buffer.from(arrayBuffer).toString("base64");

  let extraction;
  try {
    extraction = await extractBillFromImage({
      imageBase64: base64,
      mimeType: file.type,
      categoryNames: categoryNames.length ? categoryNames : ["Other"]
    });
  } catch (err) {
    console.error("scan-bill extraction failed:", err);
    return NextResponse.json({ error: "Could not read the bill. Please try again." }, { status: 502 });
  }

  // Store the original photo under the user's own folder. The storage
  // RLS policy (auth.uid() = foldername[1]) already lets this signed-in
  // user write here with their own session — no service-role key needed.
  const receiptPath = `${user.id}/${crypto.randomUUID()}.${ext}`;
  const { error: uploadError } = await supabase.storage
    .from("receipts")
    .upload(receiptPath, arrayBuffer, { contentType: file.type });

  return NextResponse.json({
    extraction,
    receiptPath: uploadError ? null : receiptPath
  });
}
