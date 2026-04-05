import { useState } from "react";

/**
 * Per-card seat filter override.
 * - `override = null` → follows global seatIds (dashboard-level filter)
 * - `override = []`   → show all seats (ignores global)
 * - `override = [...]`→ show only these seats (ignores global)
 *
 * Returns `effective` = the seat IDs the card should actually use for data fetching.
 */
export function useCardSeatOverride(globalSeatIds: string[] | undefined) {
  const [override, setOverride] = useState<string[] | null>(null);
  const effective = override ?? (globalSeatIds ?? []);
  return {
    effective,
    override,
    setOverride,
    isOverride: override !== null,
    resetToGlobal: () => setOverride(null),
  };
}
