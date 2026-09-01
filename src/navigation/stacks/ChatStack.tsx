import { createNativeStackNavigator } from '@react-navigation/native-stack';

import { ChatScreen } from '@/features/chat/ChatScreen';

import type { ChatStackParamList } from '../types';

const Stack = createNativeStackNavigator<ChatStackParamList>();

export function ChatStack() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="ChatHome" component={ChatScreen} />
    </Stack.Navigator>
  );
}
