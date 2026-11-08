import React, { useEffect, useState } from 'react';
import { Modal, Pressable, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { fonts, makeStyles, space } from '../../theme';
import { BrassButton } from './BrassButton';
import { Medallion } from './Medallion';
import { ZeckyLock } from './ZeckyLock';

interface Props {
  visible: boolean;
  /** Skip or Done. */
  onFinish: () => void;
  /** "Choose my keys" on the last step: finish and open Keys to the lock. */
  onChooseKeys: () => void;
}

const STEPS: { title: string; text: string; open: boolean }[] = [
  {
    title: 'Receive',
    text: 'Tap Receive for your address. Zcash sent to it goes straight into the lock.',
    open: false,
  },
  {
    title: 'Tap the lock to send',
    text: 'The lock opens with a deliberate tap. Send takes out only what you choose; the rest stays locked. It closes again by itself.',
    open: true,
  },
  {
    title: 'Choose your keys',
    text: 'Decide what is asked before the lock opens: Face ID, a short pause, a security key. Settings › Security › Keys to the lock.',
    open: false,
  },
];

/**
 * Three quiet steps, shown once after the wallet is ready and again on
 * request from How Zecky works. Skip is always there.
 */
export function Tour({ visible, onFinish, onChooseKeys }: Props) {
  const s = useStyles();
  const insets = useSafeAreaInsets();
  const [step, setStep] = useState(0);
  useEffect(() => {
    if (visible) setStep(0);
  }, [visible]);
  const current = STEPS[step];
  const last = step === STEPS.length - 1;

  return (
    <Modal
      visible={visible}
      animationType="fade"
      presentationStyle="fullScreen"
      onRequestClose={onFinish}
    >
      <View
        style={[
          s.container,
          { paddingTop: insets.top, paddingBottom: insets.bottom + space.md },
        ]}
      >
        <View style={s.top}>
          <Pressable accessibilityRole="button" hitSlop={12} onPress={onFinish}>
            <Text style={s.skip}>Skip</Text>
          </Pressable>
        </View>

        <View style={s.middle}>
          <View
            style={s.hero}
            accessibilityElementsHidden
            importantForAccessibility="no-hide-descendants"
          >
            <View style={s.medallion} pointerEvents="none">
              <Medallion diameter={420} />
            </View>
            <ZeckyLock open={current.open} size={150} />
          </View>
          <Text style={s.label}>
            STEP {step + 1} OF {STEPS.length}
          </Text>
          <Text style={s.title} accessibilityRole="header">
            {current.title}
          </Text>
          <Text style={s.text}>{current.text}</Text>
          <View style={s.dots}>
            {STEPS.map((_, i) => (
              <View key={i} style={[s.dot, i === step && s.dotOn]} />
            ))}
          </View>
        </View>

        <BrassButton
          label={last ? 'Done' : 'Next'}
          onPress={() => (last ? onFinish() : setStep(step + 1))}
        />
        {last ? (
          <Pressable
            accessibilityRole="button"
            hitSlop={10}
            onPress={onChooseKeys}
            style={s.quiet}
          >
            <Text style={s.quietText}>Choose my keys now</Text>
          </Pressable>
        ) : (
          <View style={s.quiet}>
            <Text style={s.quietSpacer}> </Text>
          </View>
        )}
      </View>
    </Modal>
  );
}

const useStyles = makeStyles(colors => ({
  container: {
    flex: 1,
    backgroundColor: colors.ink,
    paddingHorizontal: space.lg,
  },
  top: { alignItems: 'flex-end', paddingTop: space.md },
  skip: { fontFamily: fonts.sansMedium, fontSize: 15, color: colors.textMuted },
  middle: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  hero: {
    height: 210,
    alignSelf: 'stretch',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: space.lg,
  },
  medallion: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: 0,
    right: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: {
    fontFamily: fonts.sansSemiBold,
    fontSize: 11,
    letterSpacing: 3,
    color: colors.gold,
  },
  title: {
    fontFamily: fonts.serifMedium,
    fontSize: 30,
    color: colors.text,
    textAlign: 'center',
    marginTop: space.sm,
  },
  text: {
    fontFamily: fonts.sans,
    fontSize: 15,
    lineHeight: 23,
    color: colors.textMuted,
    textAlign: 'center',
    marginTop: space.sm,
    maxWidth: 320,
  },
  dots: { flexDirection: 'row', gap: 8, marginTop: space.lg },
  dot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: colors.line,
  },
  dotOn: { backgroundColor: colors.gold },
  quiet: { alignItems: 'center', paddingVertical: space.md },
  quietText: { fontFamily: fonts.sansMedium, fontSize: 15, color: colors.gold },
  quietSpacer: { fontSize: 15 },
}));
