"use client";

// Client-side auth/data pages have no static content worth pre-rendering
// at build time, and doing so made the build depend on live Supabase
// config being valid at image-build time. Force per-request rendering.
export const dynamic = "force-dynamic";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Plus, Archive, Wallet, CreditCard, Landmark, MoreHorizontal } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { LockCheck } from "@/components/LockCheck";
import { SkeletonList } from "@/components/Skeleton";
import type { Account, AccountKind } from "@/lib/types";

const KINDS: { value: AccountKind; label: string; Icon: typeof Wallet }[] = [
  { value: "cash", label: "Cash", Icon: Wallet },
  { value: "card", label: "Card", Icon: CreditCard },
  { value: "bank", label: "Bank", Icon: Landmark },
  { value: "other", label: "Other", Icon: MoreHorizontal }
];

function iconFor(kind: AccountKind) {
  return KINDS.find((k) => k.value === kind)?.Icon ?? Wallet;
}

export default function AccountsPage() {
  const router = useRouter();
  const supabase = createClient();
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [newName, setNewName] = useState("");
  const [newKind, setNewKind] = useState<AccountKind>("cash");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function load() {
    const { data } = await supabase.from("accounts").select("*").eq("archived", false).order("sort_order");
    setAccounts((data ?? []) as Account[]);
    setLoading(false);
  }

  // Same confirm-before-every-mutation pattern as Categories — this is
  // exactly the kind of page where a stray tap should never silently
  // change or remove something you actually use every day.

  async function addAccount() {
    const name = newName.trim();
    if (!name) return;
    if (!confirm(`Add "${name}" as a new account?`)) return;

    const {
      data: { user }
    } = await supabase.auth.getUser();
    if (!user) return;
    await supabase.from("accounts").insert({
      user_id: user.id,
      name,
      kind: newKind,
      sort_order: accounts.length
    });
    setNewName("");
    setNewKind("cash");
    void load();
  }

  async function rename(id: string, oldName: string, newValue: string, revert: () => void) {
    const name = newValue.trim();
    if (!name || name === oldName) {
      revert();
      return;
    }
    if (!confirm(`Rename "${oldName}" to "${name}"?`)) {
      revert();
      return;
    }
    setAccounts((accs) => accs.map((a) => (a.id === id ? { ...a, name } : a)));
    await supabase.from("accounts").update({ name }).eq("id", id);
  }

  async function changeKind(id: string, name: string, kind: AccountKind) {
    if (!confirm(`Change ${name}'s type to ${KINDS.find((k) => k.value === kind)?.label}?`)) return;
    setAccounts((accs) => accs.map((a) => (a.id === id ? { ...a, kind } : a)));
    await supabase.from("accounts").update({ kind }).eq("id", id);
  }

  async function archive(id: string, name: string) {
    if (
      !confirm(
        `Delete "${name}"? It won't show up when adding new expenses or transfers. Past transactions keep showing it — nothing gets lost, but you'd need to come back here to bring it back.`
      )
    ) {
      return;
    }
    setAccounts((accs) => accs.filter((a) => a.id !== id));
    await supabase.from("accounts").update({ archived: true }).eq("id", id);
  }

  return (
    <>
      <LockCheck />
      <div className="flex items-center gap-3 px-[18px] pt-[18px] pb-1">
        <button
          type="button"
          onClick={() => router.push("/settings")}
          aria-label="Back to settings"
          className="w-11 h-11 rounded-2xl bg-card flex items-center justify-center shrink-0"
        >
          <ArrowLeft size={20} strokeWidth={2.2} />
        </button>
        <h1 className="flex-grow text-[17px] font-bold">Accounts</h1>
      </div>

      <div className="mx-[18px] mt-3 bg-card rounded-xl2 p-4">
        <label htmlFor="new-account" className="block text-xs text-muted mb-2">
          Add an account
        </label>
        <div className="flex gap-2">
          <input
            id="new-account"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="e.g. Savings account"
            className="flex-grow h-11 rounded-xl bg-surface px-3 text-[15px] outline-none"
          />
          <button type="button" onClick={addAccount} aria-label="Add account" className="w-11 h-11 rounded-xl bg-primary text-white flex items-center justify-center shrink-0">
            <Plus size={20} />
          </button>
        </div>
        <div className="flex gap-2 mt-3">
          {KINDS.map(({ value, label, Icon }) => (
            <button
              key={value}
              type="button"
              aria-pressed={newKind === value}
              onClick={() => setNewKind(value)}
              className={
                "flex-1 h-10 rounded-xl flex items-center justify-center gap-1.5 text-xs font-semibold " +
                (newKind === value ? "bg-primary text-white" : "bg-surface text-ink")
              }
            >
              <Icon size={14} strokeWidth={1.9} />
              {label}
            </button>
          ))}
        </div>
      </div>

      <div className="flex-grow mx-[18px] mt-3 bg-card rounded-xl2 px-4 overflow-hidden">
        {loading ? (
          <SkeletonList />
        ) : (
          accounts.map((a) => {
            const Icon = iconFor(a.kind);
            return (
              <div key={a.id} className="py-3 border-t border-border first:border-t-0">
                <div className="flex items-center gap-3">
                  <span className="w-9 h-9 rounded-xl bg-accentSoft flex items-center justify-center shrink-0">
                    <Icon size={17} className="text-primary" strokeWidth={1.9} />
                  </span>
                  <input
                    defaultValue={a.name}
                    onBlur={(e) => {
                      const el = e.target;
                      rename(a.id, a.name, el.value, () => {
                        el.value = a.name;
                      });
                    }}
                    className="flex-grow min-w-0 text-[15px] font-semibold bg-transparent outline-none"
                  />
                  <button type="button" onClick={() => archive(a.id, a.name)} aria-label={`Delete ${a.name}`} className="w-9 h-9 rounded-xl bg-surface flex items-center justify-center shrink-0">
                    <Archive size={16} />
                  </button>
                </div>
                <div className="flex gap-1.5 mt-2 ml-12">
                  {KINDS.map(({ value, label }) => (
                    <button
                      key={value}
                      type="button"
                      onClick={() => changeKind(a.id, a.name, value)}
                      className={
                        "h-6 px-2.5 rounded-full text-[11px] font-semibold " +
                        (a.kind === value ? "bg-primary text-white" : "bg-surface text-muted")
                      }
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>
            );
          })
        )}
      </div>
      <div className="pb-8" />
    </>
  );
}
