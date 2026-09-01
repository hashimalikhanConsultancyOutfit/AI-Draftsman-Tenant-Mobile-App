import { ModulePlaceholderScreen } from '@/screens/shell/ModulePlaceholderScreen';
import { CHAT_PERMISSIONS } from '@/permissions/slugs';

export function ChatScreen() {
  return (
    <ModulePlaceholderScreen
      title="Chat"
      permission={CHAT_PERMISSIONS.VIEW}
      icon="chat"
      description="Talk to your agents. Threads run against your own agents, with cost visible to Owner, Admin and Finance."
    />
  );
}
