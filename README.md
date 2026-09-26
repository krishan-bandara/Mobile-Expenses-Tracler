# Expense Tracker

A personal expense tracker with AI-powered bill scanning, budgets, recurring bills, and account transfers. Works as an installable PWA on mobile and in any browser.

![Next.js](https://img.shields.io/badge/Next.js-14-black?logo=next.js)
![TypeScript](https://img.shields.io/badge/TypeScript-5-blue?logo=typescript)
![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-3-38B2AC?logo=tailwind-css)
![Supabase](https://img.shields.io/badge/Supabase-Postgres%20%2B%20Auth-3ECF8E?logo=supabase)
![Docker](https://img.shields.io/badge/Docker-ready-2496ED?logo=docker)

## Features

- Add expenses, income, or transfers between accounts
- Scan a receipt — Gemini extracts merchant, date, total, tax, and line items into an editable review screen
- Edit or delete any transaction; view the original receipt photo
- Custom categories with 16 colors and 25 icons; custom accounts
- Monthly budgets per category, with overspend shown explicitly
- Recurring bills with a monthly "add it / skip" confirmation checklist
- 6-month trends, category breakdown, CSV export
- Search and filter on the full transaction history
- Offline support — entries queue locally and sync when back online
- PIN + biometric app lock
- Light/dark theme
- Confirmation prompts on every destructive action

## Tech Stack

| Layer          | Technology                                   |
| -------------- | --------------------------------------------- |
| Frontend       | Next.js 14 (App Router), TypeScript, Tailwind CSS |
| Backend        | Supabase (Postgres, Auth, Storage), Row Level Security |
| Offline sync   | Dexie (IndexedDB)                             |
| AI bill reading| Google Gemini (`gemini-3.8-flash`)            |
| Auth           | Supabase Auth (email + password) + local PIN/biometric lock |
| Deployment     | Docker / Docker Compose                       |

## Getting Started

### Prerequisites

- Node.js 20+
- A [Supabase](https://supabase.com) project
- A [Gemini API key](https://aistudio.google.com/apikey)
- Docker (optional, for containerized runs)

### 1. Set up Supabase

Run `supabase/schema.sql` in your project's SQL editor. This creates every table, RLS policy, the private `receipts` storage bucket, and a trigger that seeds default categories and an account on first sign-in.

Grab your Project URL and `anon` key from **Project Settings → API**. The `service_role` key is not needed.

### 2. Configure environment variables

```bash
cp .env.example .env.local
cp .env.example .env
```

Fill in both files with your Supabase and Gemini credentials. `.env.local` is used by `npm run dev`; `.env` is auto-loaded by Docker Compose. Neither is committed to version control.

### 3. Run locally

```bash
npm install
npm run dev
```

Visit `http://localhost:3000` and create an account (email + password).

### 4. Run with Docker

```bash
docker compose --env-file /path/to/your/.env up -d --build
```

Point `--env-file` at wherever you keep your env file — this repo's `docker-compose.yml` is currently set to `/home/threedkn/_work/_allenvs/.env_mobile`, matching how it's deployed on the VM this runs on. Update both if that path ever changes. Docker builds and serves the app on `http://localhost:3000`; it does not host Supabase — the app connects to your cloud project.

### Install as a mobile app

Open the site in Chrome and choose **Add to Home screen** for a full-screen, installable experience with offline support.

## Project Structure

```
src/
├── app/
│   ├── accounts/          # Manage accounts
│   ├── categories/         # Manage categories
│   ├── transactions/       # Transaction list + search/filter
│   │   └── [id]/            # Edit/delete a transaction
│   ├── recurring/          # Recurring bills + due checklist
│   ├── add/                 # Entry screen (expense/income/transfer)
│   ├── scan/                 # Bill photo → AI extraction → review
│   ├── budgets/, trends/    # Budgets and analytics
│   ├── lock/, settings/     # PIN lock, theme, account settings
│   └── api/
│       ├── scan-bill/       # Gemini bill extraction endpoint
│       └── recurring/due/  # Computes monthly recurring due items
├── components/              # Shared UI components
└── lib/
    ├── supabase/            # Supabase client (browser + server)
    ├── db/offline.ts        # Offline queue + sync
    ├── auth/pinLock.ts      # PIN hashing + biometric unlock
    ├── gemini.ts             # Bill extraction logic
    └── theme.ts              # Theme persistence
supabase/schema.sql          # Full database schema + RLS policies
```

## Notes

- **App lock:** the PIN is a local unlock gate on top of your Supabase session, not a second auth layer. It's hashed and stored in Supabase so it follows you across devices. Forgetting it signs you out (data untouched) so you can sign back in with your password and set a new one.
- **Transfers:** moving money between your own accounts is recorded as neither income nor an expense, so it's excluded from totals, budgets, and trends by design.

## Known Limitations

- Single currency (LKR)
- Single-user, no multi-account sharing
- No push notifications
- Category/account colors and icons stay constant across light and dark theme
