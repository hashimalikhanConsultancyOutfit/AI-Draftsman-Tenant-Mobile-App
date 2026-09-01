import { ModulePlaceholderScreen } from '@/screens/shell/ModulePlaceholderScreen';
import { USAGE_PERMISSIONS } from '@/permissions/slugs';

export function UsageCreditsScreen() {
  return (
    <ModulePlaceholderScreen
      mode="stack"
      title="Usage and credits"
      permission={USAGE_PERMISSIONS.VIEW}
      icon="account-balance-wallet"
      description="Your wallet balance, monthly cap and this period's spend, from GET /limits."
    />
  );
}
