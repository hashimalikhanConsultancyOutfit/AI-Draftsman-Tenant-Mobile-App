import { ModulePlaceholderScreen } from '@/screens/shell/ModulePlaceholderScreen';
import { CONNECTOR_PERMISSIONS } from '@/permissions/slugs';

export function MarketplaceScreen() {
  return (
    <ModulePlaceholderScreen
      title="Marketplace"
      permission={CONNECTOR_PERMISSIONS.VIEW}
      icon="marketplace"
      description="Connect services so your agents can access your data, and browse skills and agents you can clone in."
    />
  );
}
