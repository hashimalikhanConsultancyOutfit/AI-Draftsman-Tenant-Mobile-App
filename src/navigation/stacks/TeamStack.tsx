import { createNativeStackNavigator } from '@react-navigation/native-stack';

import { ChangeRoleFormScreen } from '@/features/team/ChangeRoleFormScreen';
import { InviteMemberFormScreen } from '@/features/team/InviteMemberFormScreen';
import { TeamScreen } from '@/features/team/TeamScreen';

import type { TeamStackParamList } from '../types';

const Stack = createNativeStackNavigator<TeamStackParamList>();

export function TeamStack() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="TeamHome" component={TeamScreen} />
      <Stack.Screen name="InviteMember" component={InviteMemberFormScreen} options={{ presentation: 'modal' }} />
      <Stack.Screen name="ChangeRole" component={ChangeRoleFormScreen} options={{ presentation: 'modal' }} />
    </Stack.Navigator>
  );
}
