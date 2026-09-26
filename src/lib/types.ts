// Hand-written types mirroring supabase/schema.sql.
// (If you prefer, generate these instead with:
//   npx supabase gen types typescript --project-id YOUR_PROJECT_REF > src/lib/types.ts
// and re-export the pieces below from that file.)

export type AccountKind = "cash" | "card" | "bank" | "other";
export type TransactionSource = "manual" | "bill" | "recurring" | "transfer";
export type RecurringStatus = "added" | "skipped";

export interface Account {
  id: string;
  user_id: string;
  name: string;
  kind: AccountKind;
  sort_order: number;
  archived: boolean;
  created_at: string;
}

export interface Category {
  id: string;
  user_id: string;
  name: string;
  icon: string;
  color_bg: string;
  color_fg: string;
  color_dot: string;
  is_income: boolean;
  sort_order: number;
  archived: boolean;
  created_at: string;
}

export interface Transaction {
  id: string;
  user_id: string;
  account_id: string | null;
  category_id: string | null;
  amount: number;
  is_income: boolean;
  txn_date: string; // ISO date
  merchant: string | null;
  note: string | null;
  source: TransactionSource;
  confidence: number | null;
  receipt_path: string | null;
  recurring_template_id: string | null;
  to_account_id: string | null;
  raw_extraction: Record<string, unknown> | null;
  created_at: string;
  updated_at: string;
}

export interface Budget {
  id: string;
  user_id: string;
  category_id: string;
  month_start: string; // first of month, ISO date
  limit_amount: number;
  created_at: string;
}

export interface RecurringTemplate {
  id: string;
  user_id: string;
  name: string;
  category_id: string | null;
  account_id: string | null;
  default_amount: number;
  day_of_month: number;
  active: boolean;
  created_at: string;
}

export interface RecurringConfirmation {
  id: string;
  user_id: string;
  recurring_template_id: string;
  month_start: string;
  status: RecurringStatus;
  transaction_id: string | null;
  created_at: string;
}

export interface Profile {
  id: string;
  pin_hash: string | null;
  pin_salt: string | null;
  biometric_enabled: boolean;
  currency: string;
  created_at: string;
}

// Minimal Database shape so @supabase/ssr's generics are happy without
// pulling in the full generated-types machinery. Extend this if you
// switch to `supabase gen types`.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type Database = any;

// Shape returned by /api/scan-bill (validated with the Zod schema in
// src/lib/openrouter.ts before it ever reaches the client).
export interface BillExtraction {
  merchant: string;
  txn_date: string;
  total: number;
  tax: number | null;
  currency: string;
  line_items: { name: string; amount: number }[];
  suggested_category: string;
  confidence: number;
}
