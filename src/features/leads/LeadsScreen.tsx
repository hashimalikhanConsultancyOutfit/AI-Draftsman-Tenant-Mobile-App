import { ModulePlaceholderScreen } from '@/screens/shell/ModulePlaceholderScreen';
import { LEAD_PERMISSIONS } from '@/permissions/slugs';

export function LeadsScreen() {
  return (
    <ModulePlaceholderScreen
      title="Leads"
      permission={LEAD_PERMISSIONS.VIEW}
      icon="leads"
      description="Prospective customers, from first contact to won, with the scoring agent's reasoning attached."
    />
  );
}
