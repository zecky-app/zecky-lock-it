import * as Keychain from 'react-native-keychain';

// Asks for the iPhone's own Face ID or passcode before something sensitive
// is shown. A small marker (no secret in it) is kept in the Keychain with an
// access rule, so iOS only hands it back after Face ID or the passcode.
// Reading it is what shows the prompt. The recovery phrase itself is not
// touched.
const SERVICE = 'app.zecky.lockit.owner';

export type OwnerCheck = 'ok' | 'cancelled' | 'no-passcode';

export async function confirmOwner(reason: string): Promise<OwnerCheck> {
  // Without an iPhone passcode, iOS has nothing to ask for.
  if (!(await Keychain.isPasscodeAuthAvailable())) return 'no-passcode';
  try {
    // Written fresh each time: iOS deletes such items when the passcode
    // is turned off, and writing one never shows a prompt.
    await Keychain.setGenericPassword('owner', 'marker', {
      service: SERVICE,
      accessible: Keychain.ACCESSIBLE.WHEN_PASSCODE_SET_THIS_DEVICE_ONLY,
      accessControl: Keychain.ACCESS_CONTROL.USER_PRESENCE,
    });
    const entry = await Keychain.getGenericPassword({
      service: SERVICE,
      authenticationPrompt: { title: reason },
    });
    return entry === false ? 'cancelled' : 'ok';
  } catch {
    // Cancelled, failed, or anything unexpected: the words stay hidden.
    return 'cancelled';
  }
}

/** Removes the marker, for Erase wallet. */
export async function clearOwnerMarker(): Promise<void> {
  await Keychain.resetGenericPassword({ service: SERVICE });
}
