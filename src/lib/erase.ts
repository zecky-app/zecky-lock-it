import { NativeModules } from 'react-native';
import * as Keychain from 'react-native-keychain';
import { NETWORK, WALLET_ALIAS } from '../config';
import { forgetSession } from '../wallet/useSynchronizer';
import { deleteWallet } from '../wallet/seed';
import { clearAddresses } from './addressBook';
import { clearContacts } from './contacts';
import { clearOwnerMarker } from './deviceAuth';
import { KEYCHAIN_SERVICES } from './freshInstall';
import { clearLastBalance } from './lastBalance';
import { setPhraseUnconfirmed } from './phraseCheck';
import { clearPin } from './pin';

/**
 * Removes the wallet from this phone: the recovery phrase, the app code,
 * contacts, the list of handed-out addresses, the last known balance, the
 * Face ID marker and the wallet database. Settings are reset separately by
 * resetAllSettings, once the wallet screen has closed.
 * The funds themselves are untouched and can be restored with the phrase.
 */
export async function eraseWallet(
  defaultAddress: string | null,
): Promise<void> {
  // Added to the Zcash library by patches/react-native-zcash+*.patch. It
  // stops the wallet and deletes its files.
  const native = NativeModules.RNZcash;
  // Without this step the old wallet's data would stay on the device and
  // mix with the next wallet, so stop here rather than half-erase.
  if (typeof native?.wipeWallet !== 'function') {
    throw new Error(
      'This copy of Zecky cannot erase wallet data. Nothing was erased.',
    );
  }
  try {
    await native.wipeWallet(WALLET_ALIAS, NETWORK);
  } catch {
    throw new Error(
      'The wallet data could not be removed. Nothing was erased. Close Zecky, open it again and retry.',
    );
  }
  forgetSession();
  await deleteWallet();
  setPhraseUnconfirmed(false);
  await clearPin();
  await clearOwnerMarker();
  await clearContacts();
  await clearLastBalance();
  clearAddresses(defaultAddress);
  // Anything left in the Keychain, such as the wrong-code counter.
  for (const service of KEYCHAIN_SERVICES) {
    await Keychain.resetGenericPassword({ service }).catch(() => false);
  }
}
