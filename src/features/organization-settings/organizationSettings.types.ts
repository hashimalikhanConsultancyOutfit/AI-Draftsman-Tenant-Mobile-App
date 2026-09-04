/**
 * ORGANIZATION SETTINGS — types
 * =============================================================================
 * Confirmed against `apps/gateway-b2b/src/app/organization/{organization.
 * controller.ts, dto/organization-pricing.dto.ts}` and web's own
 * `src/store/api/organization.api.ts` on 2026-09-04.
 *
 * Every figure on the wire is INTEGER PENCE. A credit is one POUND of
 * platform cost by definition, not a setting — `costPencePerCredit` is
 * always 100, read from the response rather than hardcoded, so this screen
 * keeps showing the right number if the definition ever moves.
 */

/** The two prices and their difference, per credit. `sellPencePerCredit`
 * and `marginPencePerCredit` are null together — never set, not zero. */
export interface CreditRate {
  sellPencePerCredit: number | null;
  costPencePerCredit: number;
  /** Sell minus cost. Negative is legal — a workspace may price below
   * cost, and this screen must show that rather than hide it. */
  marginPencePerCredit: number | null;
}

/** This period's consumption, revenue and margin, from the usage ledger. */
export interface CreditPeriodSummary {
  /** UTC `YYYY-MM`. */
  period: string;
  /** Fractional when an action is priced at other than £1 a credit. */
  credits: number;
  costCents: number;
  /** Only turns carrying a sell price — an internal turn has none. */
  sellCents: number;
  /** Sell minus the cost of the RESOLD credits only, never the whole
   * period's cost — see `resoldCredits`. */
  marginCents: number;
  /** Of `credits`, how many were resold rather than consumed internally.
   * The base `marginCents` is measured against this, not `credits`. */
  resoldCredits: number;
  /** Charged ledger entries this period — what tells a quiet month apart
   * from a pricing rule that never reaches the charge; both are zeros
   * otherwise. */
  entries: number;
}

export interface OrganizationPricing {
  creditRate: CreditRate;
  /** Set when the workspace default prices some other way this screen
   * cannot edit — a flat per-call price, a percentage markup, or the
   * per-million-token rate this screen used to author. */
  otherMechanism: 'flat' | 'markup' | 'tokenRate' | null;
  /** Null when the ledger could not be read — rendered as unavailable,
   * never as zeros. */
  period: CreditPeriodSummary | null;
}

/** `PUT /organization/pricing/credit-rate` body. Whole pence, 0..100_000
 * (£1,000 — see `MAX_SELL_PENCE_PER_CREDIT`, a unit-check ceiling, not a
 * business rule). Zero is allowed; negative is refused server-side. */
export interface SetCreditRateBody {
  sellPencePerCredit: number;
}
