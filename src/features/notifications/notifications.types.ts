/**
 * The notification tray's wire types — confirmed against the real backend
 * source, not Swagger doc-comments alone:
 * `apps/b2b-core/src/app/notifications/notification-feed.service.ts`
 * (`TrayNotification`, `NotificationFeed`) and
 * `apps/gateway-b2b/src/app/notifications/notifications.controller.ts`
 * (the four routes below), both read in full 2026-09-04.
 *
 *   GET  /notifications              -> NotificationFeedResponse
 *   GET  /notifications/unread-count -> UnreadCountResponse
 *   POST /notifications/:id/read     -> MarkReadResponse
 *   POST /notifications/read-all     -> MarkAllReadResponse
 *
 * This is the signed-in user's OWN tray, scoped server-side to their
 * `(tenantId, userId)` — there is no way to ask for anyone else's, and no
 * `notification.view` permission gates it (see the controller's own doc
 * comment: withholding a permission here would mean an account that
 * receives notifications it isn't allowed to read).
 */

/** One card in the tray. Dates arrive as ISO strings over the wire. */
export interface TrayNotification {
  id: string;
  category: string;
  title: string;
  body: string;
  /** Portal-relative (e.g. "/customers/123") — a web route, not a mobile
   * one, so this app does not attempt to navigate from it (see
   * NotificationsScreen's doc comment). */
  link: string | null;
  readAt: string | null;
  createdAt: string;
}

export interface NotificationFeedResponse {
  items: TrayNotification[];
  /** Unread across the WHOLE tray, not just this page. */
  unread: number;
}

export interface UnreadCountResponse {
  unread: number;
}

export interface MarkReadResponse {
  id: string;
  unread: number;
}

export interface MarkAllReadResponse {
  updated: number;
  unread: number;
}
