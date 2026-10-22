import React, { useEffect, useRef } from 'react';
import { Animated, Text, View } from 'react-native';
import { ZeckyLock, prepareMedallion } from '../components/lock';
import { fonts, makeStyles } from '../theme';

/**
 * The opening screen: the lock and the wordmark fading in over the ink
 * background, the same lock the home screen opens on.
 */
export function SplashScreen() {
  const styles = useStyles();
  const opacity = useRef(new Animated.Value(0)).current;
  const rise = useRef(new Animated.Value(8)).current;
  useEffect(() => {
    Animated.parallel([
      Animated.timing(opacity, {
        toValue: 1,
        duration: 600,
        useNativeDriver: true,
      }),
      Animated.timing(rise, {
        toValue: 0,
        duration: 600,
        useNativeDriver: true,
      }),
    ]).start();
    // Once the fade has run, prepare the home screen's background pattern
    // so it appears without a hitch.
    const t = setTimeout(prepareMedallion, 700);
    return () => clearTimeout(t);
  }, [opacity, rise]);

  return (
    <View style={styles.container}>
      <Animated.View
        style={[styles.mark, { opacity, transform: [{ translateY: rise }] }]}
      >
        <ZeckyLock open={false} size={132} />
        <View style={styles.wordmark}>
          <Text style={styles.brand}>ZECKY</Text>
          <Text style={styles.product}>Lock it</Text>
        </View>
      </Animated.View>
    </View>
  );
}

const useStyles = makeStyles(colors => ({
  container: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  mark: { alignItems: 'center' },
  wordmark: {
    flexDirection: 'row',
    alignItems: 'baseline',
    marginTop: 22,
  },
  brand: {
    fontFamily: fonts.sansSemiBold,
    fontSize: 15,
    letterSpacing: 6,
    color: colors.gold,
  },
  product: {
    fontFamily: fonts.serif,
    fontSize: 18,
    color: colors.textMuted,
    marginLeft: 6,
  },
}));
