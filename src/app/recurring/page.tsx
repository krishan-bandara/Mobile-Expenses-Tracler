"use client";

// Client-side auth/data pages have no static content worth pre-rendering
// at build time, and doing so made the build depend on live Supabase
// config being valid at image-build time. Force per-request rendering.
export const dynamic = "force-dynamic";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Plus, Repeat } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { LockCheck } from "@/components/LockCheck";
import { SkeletonList } from "@/components/Skeleton";
import { formatCurrency } from "@/lib/utils";
import type { Category, RecurringTemplate } from "@/lib/types";

export default function RecurringPage() {
  const router = useRouter();
  const supabase = createClient();

  const [templates, setTemplates] = useState<RecurringTemplate[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [due, setDue] = useState<RecurringTemplate[]>([]);
  const [name, setName] = useState("");
  const [amount, setAmount] = useState("");
  const [day, setDay] = useState("1");
  const [categoryId, setCategoryId] = useState("");
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function load() {
    const [{ data: t }, { data: c }, dueRes] = await Promise.all([
      supabase.from("recurring_templates").select("*").eq("active", true).order("day_of_month"),
      supabase.from("categories").select("*").eq("is_income", false).eq("archived", false).order("sort_order"),
      fetch("/api/recurring/due").then((r) => r.json())
    ]);
    setTemplates((t ?? []) as RecurringTemplate[]);
    setCategories((c ?? []) as Category[]);
    setCategoryId((c ?? [])[0]?.id ?? "");
    setDue(dueRes.due ?? []);
    setLoading(false);
  }

  async function addTemplate() {
    if (!name.trim() || !Number(amount)) return;
    if (!confirm(`Add "${name.trim()}" as a recurring item for ${formatCurrency(Number(amount))} on day ${day} of each month?`)) {
      return;
    }
    const {
      data: { user }
    } = await supabase.auth.getUser();
    if (!user) return;
    await supabase.from("recurring_templates").insert({
      user_id: user.id,
      name: name.trim(),
      category_id: categoryId || null,
      default_amount: Number(amount),
      day_of_month: Math.min(Math.max(Number(day) || 1, 1), 28)
    });
    setName("");
    setAmount("");
    void load();
  }

  async function saveEdit(id: string, updates: { name: string; default_amount: number; day_of_month: number; category_id: string | null }) {
    if (!confirm(`Save changes to "${updates.name}"?`)) return;
    await supabase.from("recurring_templates").update(updates).eq("id", id);
    setEditingId(null);
    void load();
  }

  async function deactivate(id: string, name: string) {
    if (!confirm(`Turn off "${name}"? It'll stop being asked about each month — this doesn't touch any expenses it already created.`)) {
      return;
    }
    await supabase.from("recurring_templates").update({ active: false }).eq("id", id);
    void load();
  }

  async function actOnDue(templateId: string, name: string, action: "add" | "skip") {
    const message =
      action === "add"
        ? `Add "${name}" as an expense for this month?`
        : `Skip "${name}" this month? It'll be asked about again next month.`;
    if (!confirm(message)) return;

    setDue((d) => d.filter((t) => t.id !== templateId));
    await fetch("/api/recurring/due", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ templateId, action })
    });
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
        <h1 className="flex-grow text-[17px] font-bold">Recurring</h1>
      </div>

      {due.length > 0 && (
        <div className="mx-[18px] mt-3 bg-card rounded-xl2 p-4">
          <h2 className="text-sm font-bold">Due this month</h2>
          <p className="text-xs text-muted mt-1 mb-3">Pick which of these actually happened.</p>
          {due.map((t) => (
            <div key={t.id} className="flex items-center gap-3 py-2.5 border-t border-border first:border-t-0">
              <span className="flex-grow min-w-0">
                <span className="block text-[15px] font-semibold">{t.name}</span>
                <span className="block text-xs text-muted">{formatCurrency(t.default_amount)} &middot; day {t.day_of_month}</span>
              </span>
              <button
                type="button"
                onClick={() => actOnDue(t.id, t.name, "skip")}
                className="h-9 px-3 rounded-xl bg-surface text-xs font-semibold shrink-0"
              >
                Skip
              </button>
              <button
                type="button"
                onClick={() => actOnDue(t.id, t.name, "add")}
                className="h-9 px-3 rounded-xl bg-primary text-white text-xs font-semibold shrink-0"
              >
                Add it
              </button>
            </div>
          ))}
        </div>
      )}

      <div className="mx-[18px] mt-3 bg-card rounded-xl2 p-4">
        <h2 className="text-sm font-bold mb-3">New recurring item</h2>
        <div className="flex flex-col gap-2.5">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Dialog broadband"
            className="h-11 rounded-xl bg-surface px-3 text-[15px] outline-none"
          />
          <div className="flex gap-2">
            <input
              type="number"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="Amount"
              className="flex-1 h-11 rounded-xl bg-surface px-3 text-[15px] outline-none"
            />
            <input
              type="number"
              min={1}
              max={28}
              value={day}
              onChange={(e) => setDay(e.target.value)}
              placeholder="Day"
              className="w-20 h-11 rounded-xl bg-surface px-3 text-[15px] outline-none"
            />
          </div>
          <select
            value={categoryId}
            onChange={(e) => setCategoryId(e.target.value)}
            className="h-11 rounded-xl bg-surface px-3 text-[15px] outline-none"
          >
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
          <button type="button" onClick={addTemplate} className="h-11 rounded-xl bg-primary text-white font-bold flex items-center justify-center gap-2">
            <Plus size={18} />
            Add recurring item
          </button>
        </div>
      </div>

      <div className="flex-grow mx-[18px] mt-3 bg-card rounded-xl2 px-4 overflow-hidden">
        <h2 className="text-sm font-bold pt-3 pb-1">All recurring items</h2>
        {loading ? (
          <SkeletonList rows={2} />
        ) : templates.length === 0 ? (
          <div className="flex flex-col items-center gap-3 py-8 text-center">
            <span className="w-14 h-14 rounded-full bg-accentSoft flex items-center justify-center">
              <Repeat size={24} className="text-primary" strokeWidth={1.8} />
            </span>
            <p className="text-sm text-muted">Nothing set up yet.</p>
          </div>
        ) : (
          templates.map((t) =>
            editingId === t.id ? (
              <EditRecurringRow
                key={t.id}
                template={t}
                categories={categories}
                onCancel={() => setEditingId(null)}
                onSave={(updates) => saveEdit(t.id, updates)}
                onDeactivate={() => deactivate(t.id, t.name)}
              />
            ) : (
              <button
                key={t.id}
                type="button"
                onClick={() => setEditingId(t.id)}
                className="w-full flex items-center justify-between gap-3 h-12 border-t border-border text-left"
              >
                <span className="text-[15px]">{t.name}</span>
                <span className="text-sm text-muted">{formatCurrency(t.default_amount)} &middot; day {t.day_of_month}</span>
              </button>
            )
          )
        )}
      </div>
      <div className="pb-8" />
    </>
  );
}

function EditRecurringRow({
  template,
  categories,
  onCancel,
  onSave,
  onDeactivate
}: {
  template: RecurringTemplate;
  categories: Category[];
  onCancel: () => void;
  onSave: (updates: { name: string; default_amount: number; day_of_month: number; category_id: string | null }) => void;
  onDeactivate: () => void;
}) {
  const [name, setName] = useState(template.name);
  const [amount, setAmount] = useState(String(template.default_amount));
  const [day, setDay] = useState(String(template.day_of_month));
  const [categoryId, setCategoryId] = useState(template.category_id ?? "");

  return (
    <div className="py-3 border-t border-border">
      <div className="flex flex-col gap-2">
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="h-10 rounded-lg bg-surface px-3 text-[14px] outline-none"
        />
        <div className="flex gap-2">
          <input
            type="number"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            className="flex-1 h-10 rounded-lg bg-surface px-3 text-[14px] outline-none"
          />
          <input
            type="number"
            min={1}
            max={28}
            value={day}
            onChange={(e) => setDay(e.target.value)}
            className="w-16 h-10 rounded-lg bg-surface px-3 text-[14px] outline-none"
          />
        </div>
        <select
          value={categoryId}
          onChange={(e) => setCategoryId(e.target.value)}
          className="h-10 rounded-lg bg-surface px-3 text-[14px] outline-none"
        >
          {categories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
        <div className="flex gap-2 mt-1">
          <button type="button" onClick={onDeactivate} className="h-9 px-3 rounded-lg bg-bad-bg text-bad-fg text-xs font-semibold">
            Turn off
          </button>
          <button type="button" onClick={onCancel} className="h-9 px-3 rounded-lg bg-surface text-xs font-semibold">
            Cancel
          </button>
          <button
            type="button"
            onClick={() =>
              onSave({
                name: name.trim() || template.name,
                default_amount: Number(amount) || template.default_amount,
                day_of_month: Math.min(Math.max(Number(day) || 1, 1), 28),
                category_id: categoryId || null
              })
            }
            className="flex-grow h-9 rounded-lg bg-primary text-white text-xs font-semibold"
          >
            Save
          </button>
        </div>
      </div>
    </div>
  );
}
