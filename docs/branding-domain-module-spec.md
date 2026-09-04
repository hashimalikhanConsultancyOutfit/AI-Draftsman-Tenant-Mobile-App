# Branding & domain module — spec

Not in the original 17-module plan — this app's own `sidebarConfig.ts`
carried a comment marking "Branding & domain" out of scope alongside
Getting started and Audit log. Added 2026-09-04 by explicit request,
scoped down from what the comment excluded: aliasing is left out because
it was asked to be, and the white-label level/sending address/status-page
fields are left out because — as research turned up before any code was
written — they have nowhere real to write to. See **Scope** below.

Ported from web's `src/features/Branding/` and the gateway's
`apps/gateway-b2b/src/app/{branding,domains}/*`, confirmed against that
source on 2026-09-04.

## Scope

Web's route renders THREE panels backed by TWO different data sources,
and the difference matters:

- The Brand card (logo, palette, font, the "Powered by" badge) is real,
  reaching `GET`/`PATCH /branding` on gateway-b2b.
- The Custom domain panel is real, reaching `GET/POST /domains`,
  `POST /domains/:id/verify`, `DELETE /domains/:id`.
- The white-label **level**, a sending address, a status-page hostname,
  and the model-alias table all live on a THIRD endpoint, `/brand` — and
  that one is served entirely by the web app's own in-memory mock
  (confirmed directly: `apps/gateway-b2b` has no `brand` controller, and
  web's own `hybridBaseQuery.ts` routes every other resource on this
  route to gateway-b2b except that one, which stays on the mock by
  design). There is nothing on the real backend for a native client to
  call for any of those four fields.

This app therefore builds the two real panels only. That is a narrower
cut than what was asked to be excluded (aliasing) — the level/sender/
status fields were never on the table to begin with, because nothing
exists server-side to persist them. If a real `/brand`-equivalent ever
ships on gateway-b2b, those fields (and aliasing, if un-excluded) are the
next module to build on top of this one, not a rewrite of it.

One consequence worth stating plainly: web's "level 1 locks the badge on"
rule is pure mock-tier business logic layered on top of the real
`/branding` write, which has no concept of a level at all — it just
stores `poweredByHidden` as sent. So this app's badge toggle is freely
editable under `branding.manage` alone, with no lock, because there is
no real tier to lock it against.

## Screens

- `BrandingScreen` — both panels on one screen (mirrors web's single
  route). `branding.view` gates the whole screen, exactly as it gates
  both real reads on web's route — neither `domain` nor (on web)
  `model_alias` carries its own view slug in the catalogue. Pull-to-
  refresh re-reads both `/branding` and `/domains`.
  - **Brand card**: a small preview (colour swatches, font name, badge
    on/off) plus "Edit brand", disabled-with-a-caption under
    `branding.manage` rather than hidden — matching every gated primary
    action already built in this app except Organization Settings' rate
    editor, which web itself calls out as the one deliberate exception;
    this one follows the more common hide/disable-with-reason pattern
    since web's own Branding page hides nothing here either way (its
    disabled-tooltip choice on this page is a broader page-level pattern,
    not a documented one-off like Organization Settings').
  - **Custom domain card**: "Connect" when there is none yet (gated on
    `domain.manage`), or `DomainCard` once one exists — hostname, DNS/TLS
    badges, the DNS records to publish (re-flowed from web's 4-column
    grid into stacked blocks; a DNS value can run 60+ characters, which a
    phone-width column would only truncate), a failure-reason-aware
    status line, and Check now / Disconnect, each its own catalogue grant
    (`domain.verify` / `domain.remove`) and each disabled-with-a-caption
    rather than hidden.
- `BrandFormScreen` — modal. Logo (optional; picked via the device photo
  library, validated client-side against the same PNG/JPEG/WebP + 2 MB
  bounds `BrandingController` enforces, and left alone to keep the
  current logo when untouched), primary/accent hex colours with a swatch
  preview, font, the badge switch. Submits one multipart `PATCH
  /branding` — palette as a JSON string, exactly as the DTO expects.
- `DomainFormScreen` — modal, reachable only while there is no domain yet
  (the hostname is read-only forever after: it carries a verification
  lifecycle and DNS records keyed on the value, so retyping it would
  either be silently ignored or taken as a domain the backend has never
  seen — disconnect and add again is the only path back to this screen).
  One field, `POST /domains`; stays open with the typed value on a 400/409
  so the tenant can correct it rather than retype from scratch.

## Polling

A `PENDING` domain is re-checked automatically every 30 seconds for up to
~10 minutes (`POLL_INTERVAL_MS` / `POLL_MAX_TICKS`), mirroring web's
`useCustomDomains` exactly — the backend's own 5-minute sweep has the job
past that, and a screen polling forever tells nobody anything new. Every
automatic tick swallows its own rejection: a 429 is the backend's per-
domain cooldown doing its job, and a failed CHECK is not a rejection at
all (it answers 200 with `failureReason`, which the card already renders)
— only the manual "Check now" button surfaces an error toast, and treats
429 as an informational "checked too recently" rather than a failure.

## The one infrastructure change

`PATCH /branding` is this app's first multipart write. Mobile's shared
`apiRequest` (`src/services/httpClient.ts`) previously JSON-stringified
every body and forced `Content-Type: application/json` unconditionally —
correct for every existing endpoint, and exactly wrong for a `FormData`
body, whose multipart boundary `fetch` must set itself. Added a single
`body instanceof FormData` branch that skips both for a `FormData` body
and leaves every other call site's behaviour byte-for-byte identical
(none of them has ever passed one). This is a foundational fix, not a
`branding`-only workaround — any future multipart upload (a second logo-
style field, elsewhere) can go through the same RTK Query `api` slice
this app already uses everywhere else, rather than a bespoke uploader.

## Permission slugs

`branding.view` / `branding.manage` and `domain.manage` / `domain.verify`
/ `domain.remove` — all five were already present in
`src/permissions/slugs.ts` before this module was built.
`model_alias.manage` exists too, for the excluded aliasing panel, and is
untouched.

## Definition of Done

- [x] Every real (gateway-backed) panel has a mobile destination; the
      three mock-only fields and the alias table are deliberately absent,
      documented above and in `branding.types.ts`'s module doc, not
      silently dropped
- [x] Brand form fields mirror `UpdateBrandingDto` exactly (hex colours,
      the closed font list, the 2 MB / PNG-JPEG-WebP logo bounds)
- [x] Domain form fields mirror `AddDomainDto` (non-empty, ≤253 chars)
- [x] Domain lifecycle rendered from `records`/`dnsState`/`tlsState`/
      `failureReason` with no assumptions about record count or shape
- [x] Automatic polling + manual Check now, both silent-on-expected-
      rejection (429), and 429 read as a message rather than an error
- [x] Every permission gate applied, including the domain's three
      separately-grantable writes
- [x] Documented error codes handled via `getErrorMessage`
- [x] Success behaviour: toast text, navigation, cache invalidation
- [x] `tsc --noEmit` clean, `expo export` clean
- [ ] Tested on a real device: connecting a domain, letting DNS actually
      propagate, and watching the automatic poll pick it up
- [ ] Dark mode pass
