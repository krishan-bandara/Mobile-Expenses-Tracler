/**
 * Bookkeeping for a bill scan that's mid-flight. A phone locking (or
 * the OS discarding a backgrounded tab) can kill the page while a scan
 * is still being read — but by then the photo is already safe in
 * Supabase storage, so all that needs to survive is *where it is*.
 * Coming back to the Scan screen picks that path up and carries on
 * from the stored photo instead of making you take it again.
 *
 * Stale entries are ignored: this is for "I locked my phone a minute
 * ago", not for resurrecting a scan from last week.
 */
const KEY = "expenza:pending-scan";
const TTL_MS = 30 * 60 * 1000;

export function savePendingScan(path: string) {
  try {
    localStorage.setItem(KEY, JSON.stringify({ path, ts: Date.now() }));
  } catch {
    // Storage unavailable (private mode etc.) — resume just won't work.
  }
}

export function readPendingScan(): string | null {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const { path, ts } = JSON.parse(raw) as { path?: string; ts?: number };
    if (!path || !ts || Date.now() - ts > TTL_MS) {
      localStorage.removeItem(KEY);
      return null;
    }
    return path;
  } catch {
    return null;
  }
}

export function clearPendingScan() {
  try {
    localStorage.removeItem(KEY);
  } catch {
    // nothing to do
  }
}

/**
 * Where the server parks a finished extraction next to its photo
 * (same name, .json). If the server finishes reading a bill after your
 * phone has already dropped the connection, the result is waiting here
 * when you return — no second round trip to the vision model.
 */
export function sidecarPathFor(receiptPath: string): string {
  return receiptPath.replace(/\.[^./]+$/, "") + ".json";
}
