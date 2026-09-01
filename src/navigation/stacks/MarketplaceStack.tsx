import { createNativeStackNavigator } from '@react-navigation/native-stack';

import { MarketplaceScreen } from '@/features/marketplace/MarketplaceScreen';

import type { MarketplaceStackParamList } from '../types';

const Stack = createNativeStackNavigator<MarketplaceStackParamList>();

export function MarketplaceStack() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="MarketplaceHome" component={MarketplaceScreen} />
    </Stack.Navigator>
  );
}
