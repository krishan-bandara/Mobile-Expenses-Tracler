"use client";

import { Delete } from "lucide-react";

const KEYS = ["1", "2", "3", "4", "5", "6", "7", "8", "9", ".", "0", "back"];

export function Keypad({ onKey }: { onKey: (key: string) => void }) {
  return (
    <div className="grid grid-cols-3 gap-2">
      {KEYS.map((key) =>
        key === "back" ? (
          <button
            key={key}
            type="button"
            aria-label="Delete last digit"
            onClick={() => onKey("back")}
            className="h-[52px] rounded-2xl bg-surfaceStrong flex items-center justify-center text-ink"
          >
            <Delete size={22} strokeWidth={1.9} />
          </button>
        ) : (
          <button
            key={key}
            type="button"
            onClick={() => onKey(key)}
            className="h-[52px] rounded-2xl bg-card flex items-center justify-center text-xl font-bold text-ink"
          >
            {key}
          </button>
        )
      )}
    </div>
  );
}
