import { ModulePlaceholderScreen } from '@/screens/shell/ModulePlaceholderScreen';
import { BILLING_PERMISSIONS } from '@/permissions/slugs';

export function OrganizationSettingsScreen() {
  return (
    <ModulePlaceholderScreen
      title="Organization settings"
      permission={BILLING_PERMISSIONS.VIEW}
      icon="organizationSettings"
      description="What a credit costs you, and what you charge your customers for one."
    />
  );
}
