import { ModulePlaceholderScreen } from '@/screens/shell/ModulePlaceholderScreen';
import { USAGE_PERMISSIONS } from '@/permissions/slugs';

export function UsageSpendScreen() {
  return (
    <ModulePlaceholderScreen
      title="Usage & spend"
      permission={USAGE_PERMISSIONS.VIEW}
      icon="usageAndSpend"
      description="Where the consumption went, broken down by model, customer, agent and key."
    />
  );
}
