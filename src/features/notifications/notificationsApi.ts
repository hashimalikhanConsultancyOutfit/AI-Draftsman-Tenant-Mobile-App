import { api } from '@/store/api';

import type {
  MarkAllReadResponse,
  MarkReadResponse,
  NotificationFeedResponse,
  UnreadCountResponse,
} from './notifications.types';

/**
 * Notifications — the bell's tray. `getNotificationFeed` and
 * `getUnreadNotificationCount` share the `Notifications` tag (like web's
 * two reads do — see NotificationBell.tsx's doc comment), so marking one
 * card — or the whole tray — read refetches the badge and the list
 * together; neither can disagree with the other.
 */
export const notificationsApi = api.injectEndpoints({
  endpoints: (builder) => ({
    getNotificationFeed: builder.query<NotificationFeedResponse, { limit?: number } | void>({
      query: (arg) => ({
        url: '/notifications',
        method: 'GET',
        query: arg?.limit ? { limit: arg.limit } : undefined,
      }),
      providesTags: ['Notifications'],
    }),
    getUnreadNotificationCount: builder.query<UnreadCountResponse, void>({
      query: () => ({ url: '/notifications/unread-count', method: 'GET' }),
      providesTags: ['Notifications'],
    }),
    markNotificationRead: builder.mutation<MarkReadResponse, string>({
      query: (id) => ({ url: `/notifications/${id}/read`, method: 'POST' }),
      invalidatesTags: ['Notifications'],
    }),
    markAllNotificationsRead: builder.mutation<MarkAllReadResponse, void>({
      query: () => ({ url: '/notifications/read-all', method: 'POST' }),
      invalidatesTags: ['Notifications'],
    }),
  }),
});

export const {
  useGetNotificationFeedQuery,
  useGetUnreadNotificationCountQuery,
  useMarkNotificationReadMutation,
  useMarkAllNotificationsReadMutation,
} = notificationsApi;
