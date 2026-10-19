import React, { useEffect, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { PIN_LENGTH } from '../lib/pin';
import { fonts, makeStyles, space } from '../theme';

interface Props {
  title: string;
  /** Shown under the dots: an error or a hint. */
  message?: string | null;
  /** Called with the code once all digits are in. The pad then clears. */
  onComplete: (pin: string) => void;
  disabled?: boolean;
}

const KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '', '0', '⌫'];

/** Four dots and a number pad, for entering the app code. */
export function PinPad({ title, message, onComplete, disabled }: Props) {
  const styles = useStyles();
  const [digits, setDigits] = useState('');

  useEffect(() => {
    if (digits.length === PIN_LENGTH) {
      const pin = digits;
      setDigits('');
      onComplete(pin);
    }
  }, [digits, onComplete]);

  const press = (key: string) => {
    if (disabled) return;
    if (key === '⌫') setDigits(d => d.slice(0, -1));
    else if (key !== '') {
      setDigits(d => (d.length < PIN_LENGTH ? d + key : d));
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>{title}</Text>
      <View style={styles.dots}>
        {Array.from({ length: PIN_LENGTH }, (_, i) => (
          <View
            key={i}
            style={[styles.dot, i < digits.length && styles.dotOn]}
          />
        ))}
      </View>
      <Text style={styles.message}>{message ?? ' '}</Text>
      <View style={[styles.keys, disabled && styles.dim]}>
        {KEYS.map((key, i) => (
          <Pressable
            key={i}
            accessibilityRole={key === '' ? undefined : 'button'}
            accessibilityLabel={key === '⌫' ? 'Delete' : key}
            disabled={key === '' || disabled}
            onPress={() => press(key)}
            style={({ pressed }) => [
              styles.key,
              key !== '' && key !== '⌫' && styles.keyDigit,
              pressed && styles.keyPressed,
            ]}
          >
            <Text style={styles.keyLabel}>{key}</Text>
          </Pressable>
        ))}
      </View>
    </View>
  );
}

const useStyles = makeStyles(colors => ({
  container: { alignItems: 'center' },
  title: { fontFamily: fonts.serifMedium, fontSize: 26, color: colors.text },
  dots: { flexDirection: 'row', marginTop: space.lg },
  dot: {
    width: 14,
    height: 14,
    borderRadius: 7,
    borderWidth: 1.5,
    borderColor: colors.gold,
    marginHorizontal: 10,
  },
  dotOn: { backgroundColor: colors.gold },
  message: {
    fontFamily: fonts.sans,
    fontSize: 14,
    color: colors.textMuted,
    textAlign: 'center',
    marginTop: space.md,
    minHeight: 20,
  },
  keys: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    width: 276,
    marginTop: space.lg,
  },
  dim: { opacity: 0.35 },
  key: {
    width: 76,
    height: 76,
    margin: 8,
    borderRadius: 38,
    alignItems: 'center',
    justifyContent: 'center',
  },
  keyDigit: { backgroundColor: colors.inkRaised },
  keyPressed: { opacity: 0.5 },
  keyLabel: { fontFamily: fonts.sans, fontSize: 28, color: colors.text },
}));
