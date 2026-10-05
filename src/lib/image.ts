/**
 * Shrinks a phone photo before it's uploaded. A modern phone camera
 * shot is routinely 3-8 MB of detail a receipt reader doesn't need —
 * resizing the long edge to ~2000px at 80% JPEG quality keeps small
 * print readable while typically cutting the file to a few hundred KB.
 * That's the difference between a multi-second upload on mobile data
 * and a near-instant one, and it also means less for the vision model
 * to chew through.
 *
 * Falls back to the original file if anything goes wrong (an image
 * format the browser can't decode, no canvas support, etc.) — a slow
 * upload beats a failed one.
 */
export async function compressImage(file: File, maxDim = 2000, quality = 0.8): Promise<Blob> {
  // Already a small JPEG? Re-encoding would only lose quality for no
  // real size win.
  if (file.type === "image/jpeg" && file.size <= 600 * 1024) return file;

  try {
    // createImageBitmap applies the photo's EXIF rotation by default in
    // current browsers, so portrait shots don't come out sideways.
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, maxDim / Math.max(bitmap.width, bitmap.height));
    const width = Math.round(bitmap.width * scale);
    const height = Math.round(bitmap.height * scale);

    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    if (!ctx) return file;
    ctx.drawImage(bitmap, 0, 0, width, height);
    bitmap.close?.();

    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", quality));
    // Only use the result if it actually came out smaller.
    return blob && blob.size < file.size ? blob : file;
  } catch {
    return file;
  }
}
