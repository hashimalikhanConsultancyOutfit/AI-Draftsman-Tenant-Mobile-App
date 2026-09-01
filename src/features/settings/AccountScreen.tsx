import { ModulePlaceholderScreen } from '@/screens/shell/ModulePlaceholderScreen';

export function AccountScreen() {
  return (
    <ModulePlaceholderScreen
      mode="stack"
      title="Account"
      icon="person-outline"
      description="Your profile, password and two-factor status — reads and writes to /auth/my-settings/account."
    />
  );
}
