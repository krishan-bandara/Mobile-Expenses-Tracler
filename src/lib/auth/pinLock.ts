"use client";

/**
 * Local app-lock. This is a UX gate on top of your already-authenticated
 * Supabase session (it does not replace login) — it just stops someone
 * picking up your unlocked phone from opening the ledger straight away.
 *
 * The PIN is never stored in plain text: we hash it (PBKDF2-SHA256, salted)
 * client-side and only ever persist the hash+salt, in the `profiles`
 * table so it follows you across devices.
 */

const SESSION_KEY = "expense-tracker:unlocked-at";
const UNLOCK_TTL_MS = 5 * 60 * 1000; // re-lock after 5 minutes in the background

async function sha256Hex(text: string): Promise<string> {
  const data = new TextEncoder().encode(text);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export function randomSalt(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  return Array.from(bytes).map((b) => b.toString(16).padStart(2, "0")).join("");
}

const PBKDF2_PREFIX = "pbkdf2$";
const PBKDF2_ITERATIONS = 310_000;

async function pbkdf2Hex(pin: string, salt: string, iterations: number): Promise<string> {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey("raw", enc.encode(pin), "PBKDF2", false, ["deriveBits"]);
  const bits = await crypto.subtle.deriveBits(
    { name: "PBKDF2", hash: "SHA-256", salt: enc.encode(salt), iterations },
    key,
    256
  );
  return Array.from(new Uint8Array(bits))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export async function hashPin(pin: string, salt: string): Promise<string> {
  return `${PBKDF2_PREFIX}${PBKDF2_ITERATIONS}$${await pbkdf2Hex(pin, salt, PBKDF2_ITERATIONS)}`;
}

function constantTimeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

/** Accepts both the new PBKDF2 format and legacy salted SHA-256 hashes. */
export async function verifyPin(pin: string, salt: string, expectedHash: string): Promise<boolean> {
  if (expectedHash.startsWith(PBKDF2_PREFIX)) {
    const [, iterations, hex] = expectedHash.split("$");
    const iters = Number(iterations);
    if (!Number.isInteger(iters) || iters < 1 || !hex) return false;
    return constantTimeEqual(await pbkdf2Hex(pin, salt, iters), hex);
  }
  return constantTimeEqual(await sha256Hex(`${salt}:${pin}`), expectedHash);
}

const ATTEMPTS_KEY = "expense-tracker:pin-attempts";
const MAX_ATTEMPTS = 5;
const LOCKOUT_MS = 30_000;

/** Seconds remaining on the lockout, or 0 if the PIN pad is usable. */
export function lockoutRemainingSeconds(): number {
  try {
    const raw = localStorage.getItem(ATTEMPTS_KEY);
    if (!raw) return 0;
    const { count, last } = JSON.parse(raw) as { count: number; last: number };
    if (count < MAX_ATTEMPTS) return 0;
    const remaining = LOCKOUT_MS * 2 ** Math.min(count - MAX_ATTEMPTS, 6) - (Date.now() - last);
    return remaining > 0 ? Math.ceil(remaining / 1000) : 0;
  } catch {
    return 0;
  }
}

export function recordFailedAttempt() {
  try {
    const raw = localStorage.getItem(ATTEMPTS_KEY);
    const count = raw ? (JSON.parse(raw) as { count: number }).count : 0;
    localStorage.setItem(ATTEMPTS_KEY, JSON.stringify({ count: count + 1, last: Date.now() }));
  } catch {
    // storage unavailable — lockout is best-effort
  }
}

export function resetAttempts() {
  try {
    localStorage.removeItem(ATTEMPTS_KEY);
  } catch {
    // ignore
  }
}

export function markUnlocked() {
  sessionStorage.setItem(SESSION_KEY, String(Date.now()));
}

export function isUnlocked(): boolean {
  const raw = sessionStorage.getItem(SESSION_KEY);
  if (!raw) return false;
  return Date.now() - Number(raw) < UNLOCK_TTL_MS;
}

export function lock() {
  sessionStorage.removeItem(SESSION_KEY);
}

/**
 * Simplified, device-local biometric unlock built on the WebAuthn platform
 * authenticator (Face ID / fingerprint / Windows Hello). This is a
 * convenience layer on top of the PIN, not a replacement for it — there is
 * no server-side challenge/assertion verification, because for a
 * single-user personal app the thing being protected is "don't show my
 * numbers to whoever picks up this phone," not a multi-tenant login.
 * The PIN remains the source of truth synced via Supabase.
 */
export async function biometricSupported(): Promise<boolean> {
  if (typeof window === "undefined" || !window.PublicKeyCredential) return false;
  try {
    return await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable();
  } catch {
    return false;
  }
}

const CREDENTIAL_ID_KEY = "expense-tracker:webauthn-credential-id";

export async function registerBiometric(userId: string): Promise<boolean> {
  try {
    const challenge = crypto.getRandomValues(new Uint8Array(32));
    const credential = (await navigator.credentials.create({
      publicKey: {
        challenge,
        rp: { name: "Expense Tracker" },
        user: {
          id: new TextEncoder().encode(userId),
          name: "you",
          displayName: "you"
        },
        pubKeyCredParams: [{ alg: -7, type: "public-key" }],
        authenticatorSelection: { userVerification: "required", authenticatorAttachment: "platform" },
        timeout: 60000
      }
    })) as PublicKeyCredential | null;

    if (!credential) return false;
    localStorage.setItem(CREDENTIAL_ID_KEY, credential.id);
    return true;
  } catch {
    return false;
  }
}

export async function unlockWithBiometric(): Promise<boolean> {
  const credentialId = localStorage.getItem(CREDENTIAL_ID_KEY);
  if (!credentialId) return false;

  try {
    const challenge = crypto.getRandomValues(new Uint8Array(32));
    const assertion = await navigator.credentials.get({
      publicKey: {
        challenge,
        allowCredentials: [
          { id: Uint8Array.from(atob(credentialId.replace(/-/g, "+").replace(/_/g, "/")), (c) => c.charCodeAt(0)), type: "public-key" }
        ],
        userVerification: "required",
        timeout: 60000
      }
    });
    return Boolean(assertion);
  } catch {
    return false;
  }
}

export function hasBiometricRegistered(): boolean {
  return typeof window !== "undefined" && Boolean(localStorage.getItem(CREDENTIAL_ID_KEY));
}
