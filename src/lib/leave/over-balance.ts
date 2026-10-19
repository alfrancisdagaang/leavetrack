/**
 * TASK-040. The one rule for "over balance" that every page shares, so the manager's queue, the
 * team member page and the employee's own list agree with the HR override queue
 * (`override-queue.ts`) and the TASK-038 route (`override.ts`).
 *
 * A request is `over` only when HR can actually override it: a balance-tracked type, a balance
 * row, and `0 <= balance < working days`, measured against the CONFIRMED balance (not "available",
 * which subtracts other pending requests). A missing balance row and a negative balance are their
 * own states, because neither the manager nor HR can approve those: they need the balance fixed.
 * Pure and dependency-free.
 */
export type BalanceCheck =
  | { kind: "ok" }
  | {
      kind: "over";
      /** The confirmed balance, which an override would use up. */
      balance: number;
      /** `days - balance`, exact to the hundredth. */
      shortfall: number;
    }
  | { kind: "no_balance_record" }
  | { kind: "negative"; balance: number };

const toCents = (value: number): number => Math.round(value * 100);

export function checkOverBalance(input: {
  tracksBalance: boolean;
  /** The confirmed balance; null when there is no balance row. */
  balance: number | null;
  /** Working days the request asks for. */
  days: number;
}): BalanceCheck {
  if (!input.tracksBalance) return { kind: "ok" };
  if (input.balance === null) return { kind: "no_balance_record" };
  if (input.balance < 0) return { kind: "negative", balance: input.balance };
  const shortfallCents = toCents(input.days) - toCents(input.balance);
  if (shortfallCents <= 0) return { kind: "ok" };
  return { kind: "over", balance: input.balance, shortfall: shortfallCents / 100 };
}
