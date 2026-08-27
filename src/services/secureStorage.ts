import * as SecureStore from 'expo-secure-store';

/**
 * Stores a small, non-sensitive-beyond-session-scope snapshot of the
 * signed-in user (email, name, role, permissions, onboarding/tenant
 * status) — NOT the session cookie itself, which lives only in the
 * native cookie store (see cookieAuth.ts) and never touches JS-visible
 * storage.
 *
 * Purpose: let the app render the correct shell (which tabs, which
 * sidebar items) instantly on cold start, before `GET /auth/session`
 * returns. The snapshot is always treated as provisional and is
 * overwritten — or cleared — by the real session-bootstrap call.
 */

const SESSION_SNAPSHOT_KEY = 'auth.sessionSnapshot.v1';

export interface SessionSnapshot {
  email: string;
  name: string;
  status: string;
  onboardingStep: string;
  role: { id: string; name: string; description: string | null } | null;
  rolePermissions: string[];
  /** Client-side timestamp (ms) when this snapshot was written. */
  cachedAt: number;
}

export async function saveSessionSnapshot(
  snapshot: SessionSnapshot,
): Promise<void> {
  await SecureStore.setItemAsync(
    SESSION_SNAPSHOT_KEY,
    JSON.stringify(snapshot),
  );
}

export async function loadSessionSnapshot(): Promise<SessionSnapshot | null> {
  const raw = await SecureStore.getItemAsync(SESSION_SNAPSHOT_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as SessionSnapshot;
  } catch {
    // Corrupt or foreign-format value — treat as absent rather than throw.
    return null;
  }
}

export async function clearSessionSnapshot(): Promise<void> {
  await SecureStore.deleteItemAsync(SESSION_SNAPSHOT_KEY);
}
