import React, { useEffect, useRef } from 'react';
import { Animated, Modal, Pressable, Text, View } from 'react-native';
import { fonts, makeStyles, space, useColors } from '../../theme';
import { BrassButton } from './BrassButton';
import { ZeckyLock } from './ZeckyLock';

interface Props {
  visible: boolean;
  /** "0.010 ZEC", or null while amounts are hidden. */
  amountText: string | null;
  /** Shielding can only start once the wallet is up to date. */
  ready: boolean;
  busy: boolean;
  /** What happened after the last try, if anything. */
  note: string | null;
  onLockIn: () => void;
  onClose: () => void;
}

/**
 * Zcash that arrived on the public address is not locked yet. This card
 * explains that in three sentences and locks it in (shields it) with one
 * button, in the style of "Really open the lock?".
 */
export function LockInPrompt({
  visible,
  amountText,
  ready,
  busy,
  note,
  onLockIn,
  onClose,
}: Props) {
  const colors = useColors();
  const styles = useStyles();
  const appear = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (!visible) return;
    appear.setValue(0);
    Animated.spring(appear, {
      toValue: 1,
      friction: 9,
      tension: 70,
      useNativeDriver: true,
    }).start();
  }, [visible, appear]);

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <View style={styles.veil}>
        <Animated.View
          accessibilityViewIsModal
          style={[
            styles.card,
            {
              opacity: appear,
              transform: [
                {
                  translateY: appear.interpolate({
                    inputRange: [0, 1],
                    outputRange: [16, 0],
                  }),
                },
              ],
            },
          ]}
        >
          <View style={styles.lock}>
            <ZeckyLock open size={64} />
          </View>
          <Text style={styles.title}>
            {amountText == null
              ? 'Zcash outside the lock'
              : `${amountText} outside the lock`}
          </Text>
          <Text style={styles.body}>
            It arrived on your public address. Anyone can see it until it is
            locked in. Locking it in moves it into your private balance, for a
            small network fee.
          </Text>
          {note != null && (
            <Text
              style={[
                styles.note,
                note.startsWith('Locking') && { color: colors.gold },
              ]}
            >
              {note}
            </Text>
          )}
          {!ready && (
            <Text style={styles.note}>
              This works once the wallet is up to date.
            </Text>
          )}
          <View style={styles.button}>
            <BrassButton
              label="Lock it in"
              busy={busy}
              disabled={!ready}
              onPress={onLockIn}
            />
          </View>
          <Pressable
            accessibilityRole="button"
            hitSlop={10}
            onPress={onClose}
            style={styles.quiet}
          >
            <Text style={styles.quietText}>Not now</Text>
          </Pressable>
        </Animated.View>
      </View>
    </Modal>
  );
}

const useStyles = makeStyles(colors => ({
  veil: {
    flex: 1,
    backgroundColor: colors.ink + 'B3',
    justifyContent: 'center',
    padding: space.md,
  },
  card: {
    backgroundColor: colors.inkRaised,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: colors.gold + '40',
    padding: space.lg,
    paddingBottom: space.md,
  },
  lock: { alignItems: 'center', marginBottom: space.sm },
  title: {
    fontFamily: fonts.serifMedium,
    fontSize: 24,
    color: colors.text,
    textAlign: 'center',
  },
  body: {
    fontFamily: fonts.sans,
    fontSize: 14,
    lineHeight: 20,
    color: colors.textMuted,
    textAlign: 'center',
    marginTop: space.sm,
  },
  note: {
    fontFamily: fonts.sans,
    fontSize: 13,
    lineHeight: 19,
    color: colors.textMuted,
    textAlign: 'center',
    marginTop: space.sm,
  },
  button: { marginTop: space.lg },
  quiet: { alignSelf: 'center', paddingVertical: space.sm + 4 },
  quietText: {
    fontFamily: fonts.sansMedium,
    fontSize: 15,
    color: colors.textMuted,
  },
}));
