"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, BarChart3, Plus, Wallet, ScanLine } from "lucide-react";
import { cn } from "@/lib/utils";

const items = [
  { href: "/", label: "Home", icon: Home },
  { href: "/trends", label: "Reports", icon: BarChart3 },
  { href: "/add", label: "Add", icon: Plus, isCenter: true },
  { href: "/budgets", label: "Budgets", icon: Wallet },
  { href: "/scan", label: "Scan", icon: ScanLine }
];

export function BottomNav() {
  const pathname = usePathname();

  return (
    <nav
      className="flex items-center justify-between gap-1 bg-card rounded-xl3 px-3.5 py-2 mx-4 mb-6"
      aria-label="Primary"
    >
      {items.map(({ href, label, icon: Icon, isCenter }) => {
        const active = pathname === href;
        if (isCenter) {
          return (
            <Link
              key={href}
              href={href}
              aria-label={label}
              className="w-14 h-14 rounded-[22px] bg-primary flex items-center justify-center text-white shrink-0"
            >
              <Icon size={26} strokeWidth={2.4} />
            </Link>
          );
        }
        return (
          <Link
            key={href}
            href={href}
            aria-label={label}
            aria-current={active ? "page" : undefined}
            className={cn(
              "w-12 h-12 rounded-2xl flex items-center justify-center",
              active ? "bg-accentSoft text-primary" : "text-muted"
            )}
          >
            <Icon size={22} strokeWidth={2} />
          </Link>
        );
      })}
    </nav>
  );
}
