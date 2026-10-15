import type { NavigationProp, ParamListBase } from '@react-navigation/native';

/**
 * Open a chat thread from inside the Agents Teams stack.
 *
 * The conversation screen lives in `ChatConversationStack`, a drawer-level
 * sibling of this stack (see AppDrawer.tsx) — reached through the drawer BY
 * ID, so this works from any depth of the stack.
 */
/**
 * Start a new team thread in the Chat module — web's "New team chat" (`/chat`)
 * and a builder team's "Chat" (`/chat?team=<id>`). Lands on Chat's Teams tab
 * with the New thread form open on "A team of agents", `agentIds` ticked.
 */
export function openNewTeamChat(navigation: NavigationProp<ParamListBase>, agentIds?: string[]) {
  const drawer = navigation.getParent('RootDrawer') ?? navigation.getParent();
  drawer?.navigate('MainTabs', {
    screen: 'ChatTab',
    params: { screen: 'ChatHome', params: { newTeamThread: { agentIds, nonce: Date.now() } } },
  });
}

export function openTeamConversation(navigation: NavigationProp<ParamListBase>, conversationId: string, title?: string) {
  const drawer = navigation.getParent('RootDrawer') ?? navigation.getParent();
  drawer?.navigate('ChatConversationStack', { screen: 'ChatConversation', params: { conversationId, title } });
}
