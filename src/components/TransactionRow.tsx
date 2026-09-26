import Link from "next/link";
import type { Category, Transaction } from "@/lib/types";
import { formatCurrency } from "@/lib/utils";
import * as Icons from "lucide-react";

const sourceLabel: Record<Transaction["source"], string> = {
  manual: "Manual",
  bill: "Scanned",
  recurring: "Auto",
  transfer: "Transfer"
};

export function TransactionRow({ txn, category }: { txn: Transaction; category: Category | null }) {
  // lucide-react icon lookup by string name (category.icon), default to Tag.
  const Icon = (Icons as unknown as Record<string, Icons.LucideIcon>)[
    toPascalCase(category?.icon || "tag")
  ] || Icons.Tag;

  return (
    <Link
      href={`/transactions/${txn.id}`}
      className="flex items-center gap-3 py-2.5 border-t border-border first:border-t-0 active:opacity-60 transition-opacity"
    >
      <span
        className="w-10 h-10 rounded-2xl flex items-center justify-center shrink-0"
        style={{ background: category?.color_bg || "var(--color-surface)" }}
      >
        <Icon size={20} color={category?.color_fg || "var(--color-muted)"} strokeWidth={1.9} />
      </span>
      <span className="flex-grow min-w-0">
        <span className="block text-[15px] font-semibold truncate">{txn.merchant || "Untitled"}</span>
        <span className="block text-xs text-muted mt-0.5">
          {category?.name || "Uncategorized"} &middot; {new Date(txn.txn_date).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}
        </span>
      </span>
      <span className="text-right shrink-0">
        <span className={"block text-[15px] font-bold " + (txn.is_income ? "text-good-fg" : "text-bad-fg")}>
          {txn.is_income ? "+" : "-"}
          {formatCurrency(txn.amount)}
        </span>
        <span className="block text-[11px] text-muted mt-0.5">{sourceLabel[txn.source]}</span>
      </span>
    </Link>
  );
}

function toPascalCase(kebab: string): string {
  return kebab
    .split("-")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join("");
}
