/**
 * Imported-not-restated, matching web's own comment on this constant
 * (`organization-pricing.dto.ts`): `ResaleRateService.assertSane` refuses
 * the same figure from the same shared constant on the backend, so this
 * client-side bound cannot admit a value the server will reject or vice
 * versa without both sides being edited together. Mobile has no path to
 * `@b2b/shared/tokens` (a backend-only workspace package), so the number
 * is restated here with this note standing in for that guarantee — keep
 * it equal to `MAX_SELL_PENCE_PER_CREDIT` in
 * `libs/b2b-shared/src/tokens/work-units.ts` if that ever changes.
 *
 * £1,000 for one credit is a unit-check ceiling, not a business rule — it
 * catches pounds typed into a pence-scale field, not a real price anyone
 * means to set.
 */
export const MAX_SELL_PENCE_PER_CREDIT = 100_000;
