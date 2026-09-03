import { createNativeStackNavigator } from '@react-navigation/native-stack';

import { AgentFormScreen } from '@/features/company-agents/AgentFormScreen';
import { PlaygroundScreen } from '@/features/playground/PlaygroundScreen';

import type { PlaygroundStackParamList } from '../types';

const Stack = createNativeStackNavigator<PlaygroundStackParamList>();

export function PlaygroundStack() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="PlaygroundHome" component={PlaygroundScreen} />
      {/* Reused in-place from the Company Agents stack — "Save as agent"
          opens this inline, seeded with the prompt on screen, rather than
          switching tabs. Matches DashboardStack's and MarketplaceStack's own
          reuse of this screen. */}
      <Stack.Screen name="AgentForm" component={AgentFormScreen} options={{ presentation: 'modal' }} />
    </Stack.Navigator>
  );
}
