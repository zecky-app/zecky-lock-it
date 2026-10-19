import React, { useEffect, useRef } from 'react';
import { Animated, Text, View } from 'react-native';
import { fonts, makeStyles, space } from '../theme';

/**
 * One quiet line for money that has arrived but is still confirming: a
 * softly pulsing dot and a short text. It disappears once the funds are
 * usable, so its absence means "all settled".
 */
export function Confirming({ text }: { text: string }) {
  const styles = useStyles();
  const pulse = useRef(new Animated.Value(0.3)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, {
          toValue: 1,
          duration: 900,
          useNativeDriver: true,
        }),
        Animated.timing(pulse, {
          toValue: 0.3,
          duration: 900,
          useNativeDriver: true,
        }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [pulse]);

  return (
    <View style={styles.row} accessibilityLabel={text}>
      <Animated.View style={[styles.dot, { opacity: pulse }]} />
      <Text style={styles.text}>{text}</Text>
    </View>
  );
}

const useStyles = makeStyles(colors => ({
  row: { flexDirection: 'row', alignItems: 'center', marginTop: space.sm },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.gold,
    marginRight: space.sm,
  },
  text: {
    fontFamily: fonts.sans,
    fontSize: 13,
    color: colors.textMuted,
    fontVariant: ['tabular-nums'],
  },
}));
