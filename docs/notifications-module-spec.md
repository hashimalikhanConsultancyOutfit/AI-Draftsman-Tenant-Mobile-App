# Notifications module — spec

## Scope

The bell's tray — reached by tapping the notification bell in `AppHeader`
from any of the five bottom tabs. The bell and its unread badge already
existed (`AppHeader`'s `NotificationBell`, polling every 60s); this module
is the screen it opens, which did not exist before — tapping the bell was
previously a no-op (`onBellPress` was never wired from any screen).

Ported from web's `NotificationBell.tsx` popover (read in full, confirmed
against that source 2026-09-04) and backed by the same four routes web
uses: `GET /notifications`, `GET /notifications/unread-count`,
`POST /notifications/:id/read`, `POST /notifications/read-all` — all
confirmed directly against `apps/gateway-b2b/src/app/notifications/
notifications.controller.ts` and `apps/b2b-core/src/app/notifications/
notification-feed.service.ts`, not Swagger doc-comments alone.

Out of scope, deliberately: the separate ADMIN "notification delivery
matrix" (web's `src/features/Notifications`, gated by the pre-existing
`notification.view`/`notification.manage` permissions) — that is a
workspace-wide settings screen for choosing which channel each event type
uses, a distinct feature from a person's own tray. Happy to build that
too if wanted; this pass only covers the tray, since that is what the
bell already pointed at.

## Why no permission gate

Like Account, Usage & Credits and Analytics, this is the signed-in user's
own data. The backend controller's own doc comment states there is
deliberately no `notification.view` permission on these routes: every one
is scoped to `req.user.userId`, and withholding a permission here would
mean an account that receives notifications it isn't allowed to read.

## Data layer

- `notifications.types.ts` — `TrayNotification`, `NotificationFeedResponse`,
  `UnreadCountResponse`, `MarkReadResponse`, `MarkAllReadResponse`,
  field-for-field against `NotificationFeedService`.
- `notificationsApi.ts` — `getNotificationFeed(limit?)`,
  `getUnreadNotificationCount`, `markNotificationRead(id)`,
  `markAllNotificationsRead`. All four share the existing `'Notifications'`
  tag (already registered in `src/store/api.ts`), so marking a card —
  or the whole tray — read refetches the badge and the list together,
  matching web's own "both provide the same cache tag" design.
- `getUnreadNotificationCount` moved here from `dashboard/dashboardApi.ts`
  (its only prior caller, `AppHeader.tsx`, is now the only caller of the
  moved version too) — consolidates every notification endpoint in one
  feature module rather than splitting the badge query across two files.
  `dashboard.types.ts`'s now-unused `UnreadCountResponse` was removed.
- `notificationsRules.ts` — `formatNotificationWhen` ("just now" / "N min
  ago" / "N h ago" / "N d ago" / "3 Feb", the same buckets as web's
  `formatWhen`), `CATEGORY_META`/`categoryLabel` (the three categories web
  defines: `ACTIVITY_UPDATES`, `SCHEDULED_TASKS`, `USAGE_CREDITS`), copy.

## Screen

`NotificationsScreen.tsx`, reached as a drawer-level screen (registered in
`AppDrawer.tsx` alongside `UsageSpend`/`ApiKeys`/etc., not inside any one
tab's stack — the bell is reachable from every tab, so the destination
can't live inside just one of their stacks) via each tab root's
`onBellPress={() => navigation.getParent()?.getParent()?.navigate('Notifications')}`
(the same two-hop stack → tab → drawer pattern `DashboardScreen`'s own
`goToDrawer` helper already used for `ApiKeys`).

- `AppHeader` in `mode="stack"` (back arrow, no bell/avatar of its own —
  showing a bell on the notifications screen itself would be circular).
- A "Mark all as read" outline button, shown only when `unread > 0`.
- A `FlatList` of cards: a category-coloured dot (info/warning/success,
  matching web's palette mapped onto this app's own theme tokens; a read
  card's dot turns the neutral `border` colour, keeping every row's
  layout aligned rather than the dot disappearing), title (semibold while
  unread, medium once read), body, and the relative time.
- Tapping a card marks it read (fire-and-forget, like web — the tap is
  what the user asked for, and an acknowledgement that fails is meant to
  leave the card unread rather than block on a request).
- Pull-to-refresh; loading/error states matching every other screen this
  session (`Loader`, `ErrorState` + retry).
- Empty state ("Nothing here yet") points at notification preferences,
  same message web's popover shows for the same reason: only categories
  set to "In app" ever land here, so an empty tray is frequently the
  correct answer for the choices the user already made, not a failure.

## Deliberately not implemented: following a card's `link`

Each card's `link` is a **web-portal-relative path** (e.g.
`/customers/123`) — a route in the other app, not one this app's
navigator declares. Web can `router.push(notification.link)` because it
owns that exact route table; guessing a mapping from web paths onto this
app's own screens per category would silently break the moment either
route table changes, for a mapping nobody asked to maintain. So a tap
here only acknowledges the card — it does not attempt to navigate
anywhere from `link`. Worth revisiting if/when there's an agreed
web-path → mobile-screen mapping to build against.
