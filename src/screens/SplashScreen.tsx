import React, { useEffect, useRef } from 'react';
import { Animated, View } from 'react-native';
import { fonts, makeStyles } from '../theme';

/** The opening screen: the wordmark fading in over the ink background. */
export function SplashScreen() {
  const styles = useStyles();
  const opacity = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(opacity, {
      toValue: 1,
      duration: 600,
      useNativeDriver: true,
    }).start();
  }, [opacity]);

  return (
    <View style={styles.container}>
      <Animated.View style={[styles.mark, { opacity }]}>
        <Animated.Text style={styles.wordmark}>Zecky Lock it</Animated.Text>
        <View style={styles.rule} />
      </Animated.View>
    </View>
  );
}

const useStyles = makeStyles(colors => ({
  container: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  mark: { alignItems: 'center' },
  wordmark: { fontFamily: fonts.serifMedium, fontSize: 52, color: colors.gold },
  rule: {
    width: 56,
    height: 3,
    borderRadius: 2,
    backgroundColor: colors.gold,
    marginTop: 10,
  },
}));
