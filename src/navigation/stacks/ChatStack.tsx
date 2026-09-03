import { createNativeStackNavigator } from '@react-navigation/native-stack';

import { ChatScreen } from '@/features/chat/ChatScreen';

import type { ChatStackParamList } from '../types';

const Stack = createNativeStackNavigator<ChatStackParamList>();

/**
 * Just the thread list. A conversation itself — and everything opened from
 * inside one — lives in `ChatConversationStack`, mounted as a drawer-level
 * sibling of `MainTabs` rather than nested here, so it renders with no tab
 * bar at all (see that stack's own note).
 */
export function ChatStack() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="ChatHome" component={ChatScreen} />
    </Stack.Navigator>
  );
}
