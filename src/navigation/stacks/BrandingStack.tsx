import { createNativeStackNavigator } from '@react-navigation/native-stack';

import { BrandFormScreen } from '@/features/branding/BrandFormScreen';
import { BrandingScreen } from '@/features/branding/BrandingScreen';
import { DomainFormScreen } from '@/features/branding/DomainFormScreen';

import type { BrandingStackParamList } from '../types';

const Stack = createNativeStackNavigator<BrandingStackParamList>();

export function BrandingStack() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="BrandingHome" component={BrandingScreen} />
      <Stack.Screen name="BrandForm" component={BrandFormScreen} options={{ presentation: 'modal' }} />
      <Stack.Screen name="DomainForm" component={DomainFormScreen} options={{ presentation: 'modal' }} />
    </Stack.Navigator>
  );
}
