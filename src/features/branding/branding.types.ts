/**
 * BRANDING & DOMAIN — types
 * =============================================================================
 * Confirmed against `apps/gateway-b2b/src/app/{branding/{branding.controller.
 * ts,dto/branding.dto.ts}, domains/{domains.controller.ts,dto/domain.dto.ts}}`
 * and web's own `src/store/api/{branding.api.ts,domains.api.ts}` and
 * `src/types/domain.types.ts` on 2026-09-04.
 *
 * Two REAL, gateway-backed resources — `/branding` (the brand card: logo,
 * palette, font, badge) and `/domains` (the custom hostname and its DNS
 * lifecycle). See `brandingRules.ts` for what this module deliberately
 * leaves out and why: web's route also shows a white-label "level", a
 * sending address, a status-page hostname and a model-alias table, all of
 * which live on a THIRD, web-only mock singleton (`/brand`) that has no
 * gateway-b2b implementation at all — there is nothing for this app to
 * call for any of those four.
 */

/** The two brand colours — mirrors the backend's `palette` JSON column. */
export interface BrandPalette {
  primary: string;
  accent: string;
}

/** `GET /branding` / the result of `PATCH /branding` — the gateway's
 * response shape, one per tenant (a singleton, so no id). */
export interface BrandTheme {
  /** A short-lived SAS read URL, or null when no logo has been uploaded.
   * OUTPUT only — the logo is written by attaching a file to the PATCH,
   * never by sending this field back. */
  logo: string | null;
  palette: BrandPalette;
  /** One of `FONT_LABELS` — see `brandingRules.ts`. */
  typography: string;
  /** Show the "Powered by AiDraftsman" badge in the customer portal. */
  powered: boolean;
}

export type DnsState = 'PENDING' | 'VERIFIED' | 'FAILED';

/** "TLS has worked", not "TLS is working" — see the field's own doc in
 * `DomainCard.tsx`. Nothing re-checks it once ACTIVE. */
export type TlsState = 'PENDING' | 'ACTIVE' | 'EXPIRED' | 'FAILED';

/** Why the last verification check did not pass, in the order the checks
 * run server-side. */
export type DomainFailureReason = 'record_not_found' | 'token_mismatch' | 'not_pointed_at_gateway' | 'lookup_failed';

/** One row of the DNS instructions. Deliberately a plain string `type`
 * (not a union) on the wire — a record type added on the backend should
 * widen what renders, not fail to parse. */
export interface DomainDnsRecord {
  type: string;
  name: string;
  value: string;
}

/** One connected hostname. `/domains` is a list endpoint because the
 * backend places no limit on the count, but the product rule — enforced
 * only by this being the only UI that exists — is one per tenant; see
 * `brandingRules.ts`'s `currentDomain`. */
export interface Domain {
  id: string;
  hostname: string;
  dnsState: DnsState;
  tlsState: TlsState;
  verifiedAt: string | null;
  lastCheckedAt: string | null;
  failureReason: DomainFailureReason | null;
  /** Both records to publish, returned at every stage — a subdomain gets
   * TXT + CNAME, an apex gets TXT + one or more A records (DNS forbids a
   * CNAME at an apex). Render this array; never assume its shape. */
  records: DomainDnsRecord[];
}

/** `POST /domains` body. Lower-cased and punycoded server-side, so this
 * is sent exactly as typed. */
export interface AddDomainBody {
  hostname: string;
}
