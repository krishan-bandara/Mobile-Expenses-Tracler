"use client";

/**
 * Local app-lock. This is a UX gate on top of your already-authenticated
 * Supabase session (it does not replace login) — it just stops someone
 * picking up your unlocked phone from opening the ledger straight away.
 *
 * The PIN is never stored in plain text: we hash it (SHA-256, salted)
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

export async function hashPin(pin: string, salt: string): Promise<string> {
  return sha256Hex(`${salt}:${pin}`);
}

export async function verifyPin(pin: string, salt: string, expectedHash: string): Promise<boolean> {
  const candidate = await hashPin(pin, salt);
  return candidate === expectedHash;
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
