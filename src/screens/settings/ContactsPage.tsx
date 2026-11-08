import React, { useState } from 'react';
import { Pressable, Text, TextInput, View } from 'react-native';
import { Camera } from 'react-native-camera-kit';
import { Tools } from 'react-native-zcash';
import { Button } from '../../components/Button';
import { NETWORK } from '../../config';
import { addContact, removeContact, useContacts } from '../../lib/contacts';
import { describeError } from '../../lib/errors';
import { isMultiRecipient, parseScanned } from '../../lib/paymentUri';
import { shortenAddress } from '../../lib/zec';
import { fonts, makeStyles, space, useColors } from '../../theme';

export function ContactsPage() {
  const colors = useColors();
  const styles = useStyles();
  const contacts = useContacts();
  const [name, setName] = useState('');
  const [address, setAddress] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  /** Id of the contact whose Remove was tapped once, awaiting a second tap. */
  const [confirming, setConfirming] = useState<string | null>(null);
  const [scanning, setScanning] = useState(false);

  // A contact's code is usually their Receive QR: a bare address or a
  // zcash: payment request. Only the address is kept; an amount in the code
  // belongs to one payment, not to the contact. Add still checks the
  // address with the Zcash engine.
  const onScanned = (text: string) => {
    // The camera can report the same code several times in a row.
    if (!scanning) return;
    setScanning(false);
    const scanned = isMultiRecipient(text) ? null : parseScanned(text);
    if (scanned == null) {
      setError('That code is not a single Zcash address.');
      return;
    }
    setError(null);
    setAddress(scanned.address);
  };

  const add = async () => {
    if (name.trim() === '') return setError('Give the contact a name.');
    setBusy(true);
    setError(null);
    try {
      if (!(await Tools.isValidAddress(address.trim(), NETWORK))) {
        setError('That is not a valid Zcash address.');
        return;
      }
      await addContact(name, address);
      setName('');
      setAddress('');
    } catch (e) {
      setError(describeError(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <Text style={styles.info}>
        Saved on this phone only, in its secure storage. Contacts are never
        uploaded or included in backups.
      </Text>

      {contacts.length > 0 && (
        <View style={styles.card}>
          {contacts.map(contact => (
            <View key={contact.id} style={styles.row}>
              <View style={styles.rowText}>
                <Text style={styles.rowTitle}>{contact.name}</Text>
                <Text style={styles.rowSub}>
                  {shortenAddress(contact.address, 10)}
                </Text>
              </View>
              <Pressable
                accessibilityRole="button"
                hitSlop={10}
                onPress={() => {
                  if (confirming === contact.id) {
                    setConfirming(null);
                    removeContact(contact.id).catch(e =>
                      setError(describeError(e)),
                    );
                  } else {
                    setConfirming(contact.id);
                  }
                }}
              >
                <Text style={styles.remove}>
                  {confirming === contact.id ? 'Tap again to remove' : 'Remove'}
                </Text>
              </Pressable>
            </View>
          ))}
        </View>
      )}

      <Text style={styles.label}>New contact</Text>
      <TextInput
        style={styles.input}
        value={name}
        onChangeText={setName}
        placeholder="Name"
        placeholderTextColor={colors.goldDim}
        selectionColor={colors.gold}
      />
      <View style={styles.gap} />
      <TextInput
        style={[styles.input, styles.multiline]}
        value={address}
        onChangeText={setAddress}
        multiline
        autoCapitalize="none"
        autoCorrect={false}
        spellCheck={false}
        placeholder="Zcash address"
        placeholderTextColor={colors.goldDim}
        selectionColor={colors.gold}
      />
      <View style={styles.gap} />
      {scanning ? (
        <>
          <View style={styles.cameraFrame}>
            <Camera
              style={styles.camera}
              scanBarcode
              showFrame={false}
              onReadCode={event => onScanned(event.nativeEvent.codeStringValue)}
            />
          </View>
          <View style={styles.gap} />
          <Button
            label="Cancel scan"
            variant="back"
            onPress={() => setScanning(false)}
          />
        </>
      ) : (
        <Button
          label="Scan QR code"
          variant="quiet"
          onPress={() => {
            setError(null);
            setScanning(true);
          }}
        />
      )}
      {error != null && <Text style={styles.error}>{error}</Text>}
      <View style={styles.gap} />
      <Button
        label="Add contact"
        variant="quiet"
        busy={busy}
        disabled={name.trim() === '' || address.trim() === ''}
        onPress={add}
      />
    </>
  );
}

const useStyles = makeStyles(colors => ({
  info: {
    fontFamily: fonts.sans,
    fontSize: 14,
    lineHeight: 21,
    color: colors.textMuted,
    marginTop: space.md,
  },
  card: {
    backgroundColor: colors.inkRaised,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.line,
    paddingHorizontal: space.md,
    marginTop: space.md,
  },
  row: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12 },
  rowText: { flex: 1, paddingRight: space.md },
  rowTitle: { fontFamily: fonts.sans, fontSize: 16, color: colors.text },
  rowSub: {
    fontFamily: fonts.sans,
    fontSize: 13,
    color: colors.textMuted,
    marginTop: 2,
  },
  remove: { fontFamily: fonts.sansMedium, fontSize: 13, color: colors.danger },
  label: {
    fontFamily: fonts.sansMedium,
    fontSize: 14,
    color: colors.text,
    marginTop: space.lg,
    marginBottom: space.sm,
  },
  input: {
    backgroundColor: colors.inkRaised,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.line,
    padding: space.md,
    fontFamily: fonts.sans,
    fontSize: 16,
    color: colors.text,
  },
  multiline: { minHeight: 84, textAlignVertical: 'top', lineHeight: 22 },
  error: {
    fontFamily: fonts.sans,
    fontSize: 14,
    lineHeight: 20,
    color: colors.danger,
    marginTop: space.md,
  },
  gap: { height: space.sm },
  cameraFrame: {
    height: 280,
    borderRadius: 16,
    overflow: 'hidden',
    backgroundColor: '#000000',
  },
  camera: { flex: 1 },
}));
