/**
 * Branding & domain — copy and pure helpers. Ported from web's
 * `Branding.data.ts` and `sections/CustomDomains/{CustomDomains.data.ts,
 * DomainRecords.tsx}` (confirmed against that source 2026-09-04), trimmed
 * to what this app actually calls — see the module doc comment in
 * `branding.types.ts` for what is left out and why.
 */

import type { Domain, DomainFailureReason } from './branding.types';

/** `RHFColorField`'s pattern on web, ported as-is: `#RGB` or `#RRGGBB`. */
export const HEX_COLOUR_PATTERN = /^#([0-9A-Fa-f]{3}|[0-9A-Fa-f]{6})$/;
export const HEX_COLOUR_MESSAGE = 'Enter a hex colour, e.g. #0A5E49';

/** `FONT_LABELS` on the backend DTO — the only values `PATCH /branding`
 * accepts for `typography`. */
export const FONT_OPTIONS = [
  { label: 'Inter', value: 'Inter' },
  { label: 'Source Sans 3', value: 'Source Sans 3' },
  { label: 'IBM Plex Sans', value: 'IBM Plex Sans' },
  { label: 'System default', value: 'System default' },
];

export const LOGO_MAX_BYTES = 2 * 1024 * 1024;
export const LOGO_ALLOWED_MIME = ['image/png', 'image/jpeg', 'image/webp'];
export const LOGO_TOO_LARGE_MESSAGE = 'That logo is larger than 2 MB. Choose a smaller file.';
export const LOGO_WRONG_TYPE_MESSAGE = 'That file type is not accepted. Choose a PNG, JPEG or WebP image.';

export const PAGE_DESCRIPTION = 'How the portal looks to your customers, and the hostname it answers on.';

export const NO_VIEW_DESCRIPTION = 'Seeing this workspace’s branding and domain needs the "View branding" permission.';

export const BRAND_CARD_TITLE = 'Brand';
export const NO_MANAGE_BRAND_MESSAGE = 'Changing branding needs the "Manage branding" permission.';

export const BRAND_FORM_COPY = {
  title: 'Edit brand',
  description: 'These are your colours and your logo — they are stored as tenant data, not applied to this app.',
  submitLabel: 'Save brand',
} as const;

export const SAVED_BRAND_TOAST = 'Brand saved.';

/* -------------------------------------------------------------------------- */
/* Custom domain                                                              */
/* -------------------------------------------------------------------------- */

export const DOMAIN_CARD_TITLE = 'Custom domain';
export const NO_MANAGE_DOMAIN_MESSAGE = 'Connecting a domain needs the "Manage domain" permission.';
export const NO_VERIFY_MESSAGE = 'Re-checking DNS needs the "Verify domain" permission.';
export const NO_REMOVE_MESSAGE = 'Disconnecting needs the "Remove domain" permission, which is separate from "Manage domain".';

export const DOMAIN_FORM_COPY = {
  title: 'Connect a domain',
  description: 'A hostname you own, without https:// or a path. We will give you the DNS records to publish, and re-check them for you every few minutes.',
  fieldLabel: 'Hostname',
  submitLabel: 'Connect',
} as const;

/** One message per reason, each naming the record to fix — the
 * load-bearing part of this file per web's own comment: a generic
 * "verification failed" leaves nobody able to tell which of the two
 * records to go and fix. */
export const FAILURE_COPY: Record<DomainFailureReason, string> = {
  record_not_found: "We can't see the TXT record yet. If you've just added it, DNS can take 5–10 minutes to propagate.",
  token_mismatch: "We found a TXT record, but the value doesn't match. Copy it again — it may have been truncated.",
  not_pointed_at_gateway: "Ownership confirmed — but the routing record isn't in place yet, so traffic won't reach us. Add the second record below.",
  lookup_failed: "We couldn't reach the DNS servers. This is usually temporary, and it may be nothing you did — we'll keep trying.",
};

export const CONNECTED_MESSAGE = 'Connected. This domain is live and routing to your portal.';
export const PENDING_MESSAGE = 'Publish both records below, then choose Check now. We also re-check on our own every few minutes.';
export const ABANDONED_MESSAGE = 'We stopped checking this domain — the records never appeared. Disconnect it and add it again to start over.';
export const NOT_CONNECTED_MESSAGE = 'No custom domain yet. Connect one and we will show you the two DNS records to publish.';
export const NO_ROUTING_RECORD_MESSAGE = "Ownership record only — we can't show a routing record for this domain yet, so traffic would not reach us even once the TXT is verified. Get in touch and we'll sort it out.";

export const DNS_STATE_TAG: Record<Domain['dnsState'], { label: string; tone: 'warning' | 'success' | 'error' }> = {
  PENDING: { label: 'Pending', tone: 'warning' },
  VERIFIED: { label: 'Verified', tone: 'success' },
  FAILED: { label: 'Not verified', tone: 'error' },
};

export const DISCONNECT_COPY = {
  title: 'Disconnect this domain?',
  body: 'Traffic stops immediately. Also remove the record at your DNS provider — until you do, requests to this hostname will still reach the gateway and be refused.',
  confirmLabel: 'Disconnect',
} as const;

/** Gap between polling ticks. The backend rate-limits verification to one
 * attempt per domain per 30 seconds, so anything faster only earns 429s. */
export const POLL_INTERVAL_MS = 30_000;
/** ~10 minutes of polling. Past that the backend's own 5-minute sweep has
 * the job, and a screen polling forever tells the tenant nothing new. */
export const POLL_MAX_TICKS = 20;
export const RATE_LIMITED_STATUS = 429;

export const CONNECT_SUCCESS_TOAST = (hostname: string) => `${hostname} added. Publish the DNS records to finish.`;
export const DISCONNECT_SUCCESS_TOAST = (hostname: string) => `${hostname} disconnected.`;
export const VERIFIED_SUCCESS_TOAST = (hostname: string) => `${hostname} is connected.`;

/* -------------------------------------------------------------------------- */
/* Pure rules — ported from `DomainRecords.tsx`                              */
/* -------------------------------------------------------------------------- */

/** The line under the hostname. Driven by `failureReason` first, because
 * that names the record to go and fix — `dnsState` alone can only say
 * "pending", which is the generic message this file exists to avoid. */
export const statusMessage = (domain: Domain): string => {
  if (domain.failureReason) return FAILURE_COPY[domain.failureReason];
  if (domain.dnsState === 'VERIFIED') return CONNECTED_MESSAGE;
  if (domain.dnsState === 'FAILED') return ABANDONED_MESSAGE;
  return PENDING_MESSAGE;
};

/** Ownership passed, routing did not — worth its own tone: the tenant
 * has done half the job correctly. */
export const isHalfDone = (domain: Domain): boolean => domain.failureReason === 'not_pointed_at_gateway';

/** Is there a record that would actually carry traffic? TXT proves
 * ownership only; anything else (CNAME or A) is what makes the hostname
 * reachable. Keyed on "not TXT" rather than an allow-list, so a record
 * type added later is treated as routing rather than silently ignored. */
export const hasRoutingRecord = (domain: Domain): boolean => domain.records.some((record) => record.type.toUpperCase() !== 'TXT');

/** `/domains` is a list; the product rule is one domain per tenant,
 * enforced only by this being the only UI that exists for it (no unique
 * index on the backend) — so this always reads the first row. */
export const currentDomain = (domains: Domain[] | undefined): Domain | null => domains?.[0] ?? null;
