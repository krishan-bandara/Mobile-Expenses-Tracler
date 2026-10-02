import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { monthStartISO, localDateISO } from "@/lib/utils";

/**
 * GET: the recurring templates whose day has arrived this month and that
 * you have not yet actioned (added or skipped) — the "due" checklist.
 * POST: action on one template for this month — 'add' inserts a real
 * transaction and marks it added; 'skip' just marks it skipped so it
 * stops nagging you for the rest of the month.
 */
export async function GET() {
  const supabase = await createClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not signed in" }, { status: 401 });

  const monthStart = monthStartISO();
  const todayOfMonth = new Date().getDate();

  const [{ data: templates }, { data: confirmations }] = await Promise.all([
    supabase.from("recurring_templates").select("*").eq("active", true).lte("day_of_month", todayOfMonth),
    supabase.from("recurring_confirmations").select("recurring_template_id").eq("month_start", monthStart)
  ]);

  const confirmedIds = new Set((confirmations ?? []).map((c) => c.recurring_template_id));
  const due = (templates ?? []).filter((t) => !confirmedIds.has(t.id));

  return NextResponse.json({ due, monthStart });
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not signed in" }, { status: 401 });

  const body = (await request.json()) as { templateId: string; action: "add" | "skip"; amount?: number };
  const monthStart = monthStartISO();

  if (body.action === "skip") {
    await supabase.from("recurring_confirmations").insert({
      user_id: user.id,
      recurring_template_id: body.templateId,
      month_start: monthStart,
      status: "skipped"
    });
    return NextResponse.json({ ok: true });
  }

  const { data: template } = await supabase
    .from("recurring_templates")
    .select("*")
    .eq("id", body.templateId)
    .eq("user_id", user.id)
    .single();
  if (!template) return NextResponse.json({ error: "Template not found" }, { status: 404 });

  // Template FKs must point at this user's own account/category.
  const [{ data: acct }, { data: cat }] = await Promise.all([
    template.account_id
      ? supabase.from("accounts").select("id").eq("id", template.account_id).eq("user_id", user.id).maybeSingle()
      : Promise.resolve({ data: { id: null } }),
    template.category_id
      ? supabase.from("categories").select("id").eq("id", template.category_id).eq("user_id", user.id).maybeSingle()
      : Promise.resolve({ data: { id: null } })
  ]);
  if (!acct || !cat) return NextResponse.json({ error: "Invalid account or category" }, { status: 400 });

  const { data: transaction, error: txnError } = await supabase
    .from("transactions")
    .insert({
      user_id: user.id,
      account_id: template.account_id,
      category_id: template.category_id,
      amount: body.amount ?? template.default_amount,
      is_income: false,
      txn_date: localDateISO(new Date()),
      merchant: template.name,
      source: "recurring",
      recurring_template_id: template.id
    })
    .select()
    .single();

  if (txnError) return NextResponse.json({ error: txnError.message }, { status: 500 });

  await supabase.from("recurring_confirmations").insert({
    user_id: user.id,
    recurring_template_id: body.templateId,
    month_start: monthStart,
    status: "added",
    transaction_id: transaction.id
  });

  return NextResponse.json({ ok: true, transaction });
}
