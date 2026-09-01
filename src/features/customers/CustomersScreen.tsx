import { ModulePlaceholderScreen } from '@/screens/shell/ModulePlaceholderScreen';
import { CUSTOMER_PERMISSIONS } from '@/permissions/slugs';

export function CustomersScreen() {
  return (
    <ModulePlaceholderScreen
      title="Customers"
      permission={CUSTOMER_PERMISSIONS.VIEW}
      icon="customers"
      description="Every organisation you serve, their quota use and their spend."
    />
  );
}
