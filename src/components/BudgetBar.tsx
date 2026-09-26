import { formatCurrency } from "@/lib/utils";

export function BudgetBar({
  name,
  spent,
  limit,
  dotColor
}: {
  name: string;
  spent: number;
  limit: number;
  dotColor: string;
}) {
  const pct = limit > 0 ? Math.min((spent / limit) * 100, 100) : 0;
  const over = spent > limit;
  const overAmount = spent - limit;

  return (
    <div className="py-3.5">
      <div className="flex items-center gap-2.5">
        <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: dotColor }} />
        <span className={"flex-grow text-[15px] font-medium " + (over ? "text-bad-fg" : "")}>{name}</span>
        <span className={"text-sm " + (over ? "text-bad-fg" : "text-muted")}>
          {formatCurrency(spent)} of {formatCurrency(limit)}
        </span>
      </div>
      <div className="h-1.5 rounded-full bg-track mt-2.5 overflow-hidden flex">
        <div
          className="h-full rounded-full"
          style={{ width: `${pct}%`, background: over ? "var(--color-bad-fg)" : dotColor }}
        />
      </div>
      {over && (
        <p className="text-xs text-bad-fg mt-2">{formatCurrency(overAmount)} over this month's limit</p>
      )}
    </div>
  );
}
