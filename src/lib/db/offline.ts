"use client";

import Dexie, { type Table } from "dexie";
import { createClient } from "@/lib/supabase/client";

/**
 * Local-first queue. Every write goes here first; a background sync then
 * replays queued rows into Supabase once the device is back online.
 * Reads in the UI should merge Supabase's data with any still-pending
 * rows from this table so a just-added expense shows up immediately
 * even before it has synced.
 */
export interface PendingTransaction {
  localId?: number; // Dexie auto-increment key
  payload: {
    account_id: string | null;
    category_id: string | null;
    amount: number;
    is_income: boolean;
    txn_date: string;
    merchant: string | null;
    note: string | null;
    source: "manual" | "bill" | "recurring" | "transfer";
    confidence?: number | null;
    receipt_path?: string | null;
    recurring_template_id?: string | null;
    raw_extraction?: Record<string, unknown> | null;
    to_account_id?: string | null;
  };
  createdAt: number;
  syncStatus: "pending" | "syncing" | "failed";
  lastError?: string;
}

class OfflineDB extends Dexie {
  pendingTransactions!: Table<PendingTransaction, number>;

  constructor() {
    super("expense-tracker");
    this.version(1).stores({
      pendingTransactions: "++localId, syncStatus, createdAt"
    });
  }
}

export const offlineDB = new OfflineDB();

export async function queueTransaction(payload: PendingTransaction["payload"]) {
  return offlineDB.pendingTransactions.add({
    payload,
    createdAt: Date.now(),
    syncStatus: "pending"
  });
}

/**
 * Replays every pending row into Supabase. Call this on `online` events,
 * on app focus, and once on mount — it is cheap and a no-op when the
 * queue is empty. Last-write-wins is fine here: this is a single-user
 * app, so the only real conflict is "same row edited on two devices
 * while both were offline," which is rare and low-stakes for a ledger.
 */
export async function syncPendingTransactions(): Promise<{ synced: number; failed: number }> {
  if (typeof navigator !== "undefined" && !navigator.onLine) {
    return { synced: 0, failed: 0 };
  }

  const supabase = createClient();
  const pending = await offlineDB.pendingTransactions
    .where("syncStatus")
    .anyOf("pending", "failed")
    .toArray();

  let synced = 0;
  let failed = 0;

  for (const row of pending) {
    if (row.localId === undefined) continue;
    await offlineDB.pendingTransactions.update(row.localId, { syncStatus: "syncing" });

    const {
      data: { user }
    } = await supabase.auth.getUser();

    if (!user) {
      await offlineDB.pendingTransactions.update(row.localId, {
        syncStatus: "failed",
        lastError: "Not signed in"
      });
      failed++;
      continue;
    }

    const { error } = await supabase.from("transactions").insert({
      user_id: user.id,
      ...row.payload
    });

    if (error) {
      await offlineDB.pendingTransactions.update(row.localId, {
        syncStatus: "failed",
        lastError: error.message
      });
      failed++;
    } else {
      await offlineDB.pendingTransactions.delete(row.localId);
      synced++;
    }
  }

  return { synced, failed };
}

export async function pendingCount(): Promise<number> {
  return offlineDB.pendingTransactions.where("syncStatus").anyOf("pending", "failed", "syncing").count();
}
