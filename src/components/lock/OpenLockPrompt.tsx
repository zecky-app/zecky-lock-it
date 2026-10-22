import React, { useEffect, useRef, useState } from 'react';
import { Animated, Modal, Pressable, Text, View } from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import { confirmOwner } from '../../lib/deviceAuth';
import { secondsUntilRetry, usePinEnabled, verifyPin } from '../../lib/pin';
import { fonts, makeStyles, space, useColors } from '../../theme';
import { Button } from '../Button';
import { PinPad } from '../PinPad';
import { ZeckyLock } from './ZeckyLock';

interface Props {
  visible: boolean;
  /** Calendar days the Zcash has been locked, or null. */
  days: number | null;
  /** The owner checked out: open the lock. */
  onOpen: () => void;
  onKeep: () => void;
  /** Seconds to wait; 0 skips the question and goes straight to the code. */
  wait: number;
  /** Ask for the Zecky code or Face ID after the question (Keys to the lock). */
  check: boolean;
}

const RING = 104;

/**
 * "Really open the lock?", as on the Mac: the safe choice is the main
 * button, and opening needs a tick and a short wait. Then the app code,
 * or else Face ID or the iPhone passcode.
 */
export function OpenLockPrompt({
  visible,
  days,
  onOpen,
  onKeep,
  wait,
  check,
}: Props) {
  const colors = useColors();
  const styles = useStyles();
  const pinEnabled = usePinEnabled();
  const [agreed, setAgreed] = useState(false);
  const [countdown, setCountdown] = useState(wait);
  const [askingCode, setAskingCode] = useState(false);
  const [pinMessage, setPinMessage] = useState<string | null>(null);
  const [checking, setChecking] = useState(false);

  // Every time it opens, it starts over.
  useEffect(() => {
    if (!visible) return;
    setAgreed(false);
    setCountdown(wait);
    // Without the question, only the code is left to ask.
    setAskingCode(wait === 0 && check);
    setPinMessage(null);
    const timer = setInterval(
      () => setCountdown(c => (c > 0 ? c - 1 : 0)),
      1000,
    );
    return () => clearInterval(timer);
  }, [visible, wait, check]);

  // The card settles in gently over a soft veil instead of a dark screen.
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

  const ready = agreed && countdown === 0;

  const open = async () => {
    if (!ready || checking) return;
    if (!check) {
      onOpen();
      return;
    }
    if (pinEnabled) {
      setAskingCode(true);
      return;
    }
    setChecking(true);
    // Without a passcode on the iPhone there is nothing to ask: the wait
    // and the tick are the guard.
    const result = await confirmOwner('Open the lock');
    setChecking(false);
    if (result !== 'cancelled') onOpen();
  };

  const onPin = async (pin: string) => {
    setPinMessage(null);
    if (await verifyPin(pin)) {
      onOpen();
      return;
    }
    const retry = secondsUntilRetry();
    setPinMessage(
      retry > 0
        ? `Too many wrong codes. Try again in ${
            retry >= 60 ? `${Math.ceil(retry / 60)} min` : `${retry} s`
          }.`
        : 'Wrong code. Try again.',
    );
  };

  const held =
    days == null
      ? ''
      : days === 0
      ? 'This Zcash was locked today. '
      : `This Zcash has been locked for ${days} ${
          days === 1 ? 'day' : 'days'
        }. `;

  const r = RING / 2 - 3;
  const circumference = 2 * Math.PI * r;
  const filled = wait > 0 ? (wait - countdown) / wait : 1;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onKeep}
    >
      <View style={styles.scrim}>
        <Animated.View
          style={[
            styles.card,
            {
              opacity: appear,
              transform: [
                {
                  scale: appear.interpolate({
                    inputRange: [0, 1],
                    outputRange: [0.94, 1],
                  }),
                },
                {
                  translateY: appear.interpolate({
                    inputRange: [0, 1],
                    outputRange: [16, 0],
                  }),
                },
              ],
            },
          ]}
          accessibilityViewIsModal
        >
          {askingCode ? (
            <>
              <PinPad
                title="Enter your code"
                message={pinMessage}
                onComplete={onPin}
              />
              <View style={styles.buttons}>
                <Button label="Keep it locked" onPress={onKeep} />
              </View>
            </>
          ) : (
            <>
              <View style={styles.ring}>
                <Svg
                  width={RING}
                  height={RING}
                  style={styles.ringSvg}
                  pointerEvents="none"
                >
                  <Circle
                    cx={RING / 2}
                    cy={RING / 2}
                    r={r}
                    stroke={colors.gold}
                    strokeOpacity={0.15}
                    strokeWidth={3}
                    fill="none"
                  />
                  <Circle
                    cx={RING / 2}
                    cy={RING / 2}
                    r={r}
                    stroke={colors.gold}
                    strokeWidth={3}
                    strokeLinecap="round"
                    fill="none"
                    strokeDasharray={`${
                      circumference * filled
                    } ${circumference}`}
                    rotation={-90}
                    origin={`${RING / 2}, ${RING / 2}`}
                  />
                </Svg>
                <ZeckyLock open={false} size={56} />
              </View>
              <Text style={styles.count}>
                {countdown > 0 ? String(countdown) : ' '}
              </Text>

              <Text style={styles.title}>Really open the lock?</Text>
              <Text style={styles.intro}>
                {held}
                Nobody legitimate will ever rush you, ask for your 24 words, or
                tell you to move your Zcash to keep it safe.
              </Text>

              <Pressable
                accessibilityRole="checkbox"
                accessibilityState={{ checked: agreed }}
                onPress={() => setAgreed(a => !a)}
                style={[styles.tick, agreed && styles.tickOn]}
              >
                <View style={[styles.box, agreed && styles.boxOn]}>
                  {agreed && <Text style={styles.check}>✓</Text>}
                </View>
                <Text style={styles.tickText}>
                  I am opening it myself, and nobody is telling me to.
                </Text>
              </Pressable>

              <View style={styles.buttons}>
                <Button label="Keep it locked" onPress={onKeep} />
                <View style={styles.gap} />
                <Button
                  label={
                    countdown > 0 ? `Open in ${countdown} s` : 'Open the lock'
                  }
                  variant="quiet"
                  busy={checking}
                  disabled={!ready}
                  onPress={open}
                />
              </View>
            </>
          )}
        </Animated.View>
      </View>
    </Modal>
  );
}

const useStyles = makeStyles(colors => ({
  scrim: {
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
    paddingHorizontal: space.lg,
    paddingTop: space.lg,
    paddingBottom: space.lg,
    alignItems: 'stretch',
  },
  ring: {
    alignSelf: 'center',
    width: RING,
    height: RING,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ringSvg: { position: 'absolute', top: 0, left: 0 },
  count: {
    alignSelf: 'center',
    fontFamily: fonts.sansSemiBold,
    fontSize: 11,
    color: colors.gold,
    marginTop: 2,
  },
  title: {
    fontFamily: fonts.serifMedium,
    fontSize: 28,
    color: colors.text,
    textAlign: 'center',
    marginTop: space.sm,
  },
  intro: {
    fontFamily: fonts.sans,
    fontSize: 14,
    lineHeight: 20,
    color: colors.textMuted,
    textAlign: 'center',
    marginTop: space.sm,
  },
  tick: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: space.md,
    padding: 14,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.ink,
  },
  tickOn: { borderColor: colors.gold + '99' },
  box: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 1.5,
    borderColor: colors.textMuted,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  boxOn: { backgroundColor: colors.gold, borderColor: colors.gold },
  check: { color: colors.onGold, fontSize: 14, fontFamily: fonts.sansSemiBold },
  tickText: {
    flex: 1,
    fontFamily: fonts.sans,
    fontSize: 14,
    lineHeight: 19,
    color: colors.text,
  },
  buttons: { marginTop: space.md },
  gap: { height: space.sm },
}));
