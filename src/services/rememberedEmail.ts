import * as SecureStore from 'expo-secure-store';

/**
 * The email address remembered by the login screen's "Remember me"
 * checkbox — deliberately just the email, never the password. Written on
 * every sign-in attempt while the checkbox is checked (or cleared when it
 * isn't), and read back by LoginScreen on mount so a signed-out user still
 * sees their email pre-filled, the same way it survives a full sign-out
 * (logout only clears the session cookie/snapshot, never this key).
 */

const REMEMBERED_EMAIL_KEY = 'auth.rememberedEmail.v1';

export async function saveRememberedEmail(email: string): Promise<void> {
  await SecureStore.setItemAsync(REMEMBERED_EMAIL_KEY, email);
}

export async function loadRememberedEmail(): Promise<string | null> {
  return SecureStore.getItemAsync(REMEMBERED_EMAIL_KEY);
}

export async function clearRememberedEmail(): Promise<void> {
  await SecureStore.deleteItemAsync(REMEMBERED_EMAIL_KEY);
}
