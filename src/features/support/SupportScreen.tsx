import { ModulePlaceholderScreen } from '@/screens/shell/ModulePlaceholderScreen';
import { SUPPORT_PERMISSIONS } from '@/permissions/slugs';

export function SupportScreen() {
  return (
    <ModulePlaceholderScreen
      title="Support"
      permission={SUPPORT_PERMISSIONS.VIEW}
      icon="support"
      description="Tickets your customers raised, and anything you have handed to the platform team."
    />
  );
}
