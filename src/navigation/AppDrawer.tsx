import { createDrawerNavigator } from '@react-navigation/drawer';

import { ApiKeysScreen } from '@/features/api-keys/ApiKeysScreen';
import { OrganizationSettingsScreen } from '@/features/organization-settings/OrganizationSettingsScreen';
import { RolesPermissionsScreen } from '@/features/roles/RolesPermissionsScreen';
import { SupportScreen } from '@/features/support/SupportScreen';
import { TeamScreen } from '@/features/team/TeamScreen';
import { UsageSpendScreen } from '@/features/usage-spend/UsageSpendScreen';

import { AppTabs } from './AppTabs';
import { SidebarContent } from './SidebarContent';
import { ChatConversationStack } from './stacks/ChatConversationStack';
import { CustomerAgentsStack } from './stacks/CustomerAgentsStack';
import { CustomersStack } from './stacks/CustomersStack';
import { KnowledgeBasesStack } from './stacks/KnowledgeBasesStack';
import { LeadCriteriaStack } from './stacks/LeadCriteriaStack';
import { LeadsStack } from './stacks/LeadsStack';
import { PlaygroundStack } from './stacks/PlaygroundStack';
import { ReportsStack } from './stacks/ReportsStack';
import type { AppDrawerParamList } from './types';

const Drawer = createDrawerNavigator<AppDrawerParamList>();

/**
 * The authenticated shell's true root: a drawer (the sidebar) wrapping the
 * bottom-tab navigator as one screen, plus one screen per module that
 * didn't become a tab — see sidebarConfig.ts for the grouped list the
 * sidebar itself renders. `id="RootDrawer"` lets a screen nested inside a
 * tab's stack reach this navigator via `navigation.getParent('RootDrawer')`
 * without walking an untyped chain.
 */
export function AppDrawer() {
  return (
    <Drawer.Navigator
      id="RootDrawer"
      screenOptions={{ headerShown: false, drawerType: 'front', swipeEdgeWidth: 40 }}
      drawerContent={(props) => <SidebarContent {...props} />}
    >
      <Drawer.Screen name="MainTabs" component={AppTabs} />
      <Drawer.Screen name="ChatConversationStack" component={ChatConversationStack} />
      <Drawer.Screen name="CustomerAgents" component={CustomerAgentsStack} />
      <Drawer.Screen name="KnowledgeBases" component={KnowledgeBasesStack} />
      <Drawer.Screen name="Playground" component={PlaygroundStack} />
      <Drawer.Screen name="Customers" component={CustomersStack} />
      <Drawer.Screen name="Leads" component={LeadsStack} />
      <Drawer.Screen name="LeadCriteria" component={LeadCriteriaStack} />
      <Drawer.Screen name="Reports" component={ReportsStack} />
      <Drawer.Screen name="UsageSpend" component={UsageSpendScreen} />
      <Drawer.Screen name="ApiKeys" component={ApiKeysScreen} />
      <Drawer.Screen name="Team" component={TeamScreen} />
      <Drawer.Screen name="RolesPermissions" component={RolesPermissionsScreen} />
      <Drawer.Screen name="OrganizationSettings" component={OrganizationSettingsScreen} />
      <Drawer.Screen name="Support" component={SupportScreen} />
    </Drawer.Navigator>
  );
}
