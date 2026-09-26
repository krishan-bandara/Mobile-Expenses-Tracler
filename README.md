# Expense Tracker

A personal expense tracker — installable on your Samsung phone as a PWA,
and usable from any browser on the same account. Manual entry, AI bill
scanning, budgets, recurring bills, and an app-lock PIN.

## Stack

- **Frontend:** Next.js 14 (App Router) + TypeScript + Tailwind CSS, installable as a PWA
- **Backend:** Supabase (Postgres + Auth + Storage), Row Level Security throughout
- **Offline:** Dexie (IndexedDB) queues expenses added while offline and syncs them when you're back online
- **Bill reading:** Google Gemini, called directly server-side so the API key never reaches the browser
- **App lock:** 4-digit PIN (hashed, stored in Supabase) with optional device biometric unlock

## 1. Create your Supabase project

1. Go to [supabase.com](https://supabase.com), create a new project.
2. In the SQL editor, paste and run `supabase/schema.sql` from this repo.
   It creates every table, Row Level Security policy, the private
   `receipts` storage bucket, and a trigger that seeds six default
   categories + a Cash account the first time you sign in.
3. In **Project Settings → API**, copy the Project URL and the `anon`
   public key into `.env.local`. You don't need the `service_role` key —
   nothing in the app uses it (see the note in `.env.example`).

## 2. Get a Gemini key

Go to [aistudio.google.com/apikey](https://aistudio.google.com/apikey) and
create a key. The default model in `.env.example` is `gemini-3.8-flash`,
which supports image input.

## 3. Configure environment variables

```bash
cp .env.example .env.local
```

Fill in `.env.local` with the values from steps 1 and 2. **Never commit
this file** — it's already in `.gitignore`.

## 4. Run it

### Locally

```bash
npm install
npm run dev
```

Open http://localhost:3000, sign in with your email (magic link — no
password), and you're in.

### With Docker

```bash
docker compose up --build
```

This builds the Next.js app in standalone mode and serves it on
http://localhost:3000. Docker does **not** run Supabase — you're
connecting to your cloud Supabase project via the env vars above.

## Installing on your Samsung phone

Open the site in Chrome, tap the menu, and choose **"Add to Home
screen."** It installs like a native app, opens full-screen, and keeps
working offline for adding expenses (they sync once you're back on
data or Wi-Fi).

## Project structure

```
src/
  app/              Pages (App Router) + API routes
    api/scan-bill/       server route that calls Gemini and stores the receipt
    api/recurring/due/   computes which recurring bills are due this month
  components/       Shared UI (BottomNav, DonutChart, Keypad, PinPad, ...)
  lib/
    supabase/       Browser + server Supabase clients
    db/offline.ts   Dexie offline queue + sync
    auth/pinLock.ts PIN hashing + biometric unlock
    gemini.ts       Bill-photo → structured JSON extraction
supabase/schema.sql Full Postgres schema + RLS policies + seed trigger
```

## Notes on the app lock

The PIN is a **local UX gate on top of your Supabase session** — it
stops someone who picks up your unlocked phone from opening the ledger,
it isn't a second authentication server. The PIN hash is stored in
Supabase so it follows you between devices. Biometric unlock uses the
device's own WebAuthn platform authenticator as a convenience shortcut
for the PIN, registered per device.

## What's stubbed vs. complete

Complete and wired to Supabase: adding expenses, offline queueing +
sync, AI bill scanning + review, budgets with live spend, categories
(add/rename/recolor/archive), recurring items with the monthly "due"
checklist, the 6-month trends chart + CSV export, and the PIN/biometric
lock.

Left for you to extend: editing/deleting a past transaction (currently
add-only), push notifications for budget thresholds, and account
transfers. The schema (`accounts`, `transactions.account_id`) already
supports these — they just need UI.
