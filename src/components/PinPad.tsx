"use client";

import { useState } from "react";
import { Delete } from "lucide-react";

/**
 * A 4-digit PIN entry pad. Calls onComplete once 4 digits are entered;
 * the caller decides whether that PIN was correct and resets via `error`.
 */
export function PinPad({
  length = 4,
  onComplete,
  error
}: {
  length?: number;
  onComplete: (pin: string) => void;
  error?: string;
}) {
  const [digits, setDigits] = useState("");

  function press(key: string) {
    if (key === "back") {
      setDigits((d) => d.slice(0, -1));
      return;
    }
    const next = (digits + key).slice(0, length);
    setDigits(next);
    if (next.length === length) {
      onComplete(next);
      setDigits("");
    }
  }

  return (
    <div className="flex flex-col items-center gap-8">
      <div className="flex gap-3" aria-live="polite">
        {Array.from({ length }).map((_, i) => (
          <span
            key={i}
            className={
              "w-3.5 h-3.5 rounded-full " + (i < digits.length ? "bg-primary" : "bg-surfaceStrong")
            }
          />
        ))}
      </div>
      {error && <p className="text-sm text-bad-fg -mt-4">{error}</p>}
      <div className="grid grid-cols-3 gap-x-5 gap-y-5 w-full max-w-[280px]">
        {["1", "2", "3", "4", "5", "6", "7", "8", "9", "", "0", "back"].map((key, i) =>
          key === "" ? (
            <span key={i} />
          ) : key === "back" ? (
            <button
              key={i}
              type="button"
              aria-label="Delete last digit"
              onClick={() => press("back")}
              className="h-16 rounded-full flex items-center justify-center text-ink"
            >
              <Delete size={22} strokeWidth={1.9} />
            </button>
          ) : (
            <button
              key={i}
              type="button"
              onClick={() => press(key)}
              className="h-16 rounded-full bg-card text-2xl font-semibold text-ink"
            >
              {key}
            </button>
          )
        )}
      </div>
    </div>
  );
}
