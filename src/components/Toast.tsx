import React, { useEffect, useRef } from 'react';
import { Animated, Pressable, Text, View } from 'react-native';
import { fonts, makeStyles, space, useColors } from '../theme';
import { Icon } from './Icon';

export interface ToastMessage {
  /** Changes for every new message, so the same text can show twice. */
  key: string;
  kind: 'received' | 'sent';
  title: string;
  detail: string;
}

interface Props {
  message: ToastMessage | null;
  onPress: () => void;
  /** Called when the message has slid away. */
  onDone: () => void;
}

const VISIBLE_MS = 4500;

/** A short message that slides down from the top and leaves by itself. */
export function Toast({ message, onPress, onDone }: Props) {
  const colors = useColors();
  const styles = useStyles();
  const shown = useRef(new Animated.Value(0)).current;
  const done = useRef(onDone);
  done.current = onDone;
  const key = message?.key;

  useEffect(() => {
    if (key == null) return;
    shown.setValue(0);
    Animated.spring(shown, {
      toValue: 1,
      useNativeDriver: true,
      friction: 9,
    }).start();
    const timer = setTimeout(() => {
      Animated.timing(shown, {
        toValue: 0,
        duration: 250,
        useNativeDriver: true,
      }).start(() => done.current());
    }, VISIBLE_MS);
    return () => clearTimeout(timer);
  }, [key, shown]);

  if (message == null) return null;
  const received = message.kind === 'received';

  return (
    <Animated.View
      style={[
        styles.wrap,
        {
          opacity: shown,
          transform: [
            {
              translateY: shown.interpolate({
                inputRange: [0, 1],
                outputRange: [-30, 0],
              }),
            },
          ],
        },
      ]}
    >
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${message.title}. ${message.detail}`}
        onPress={onPress}
        style={styles.card}
      >
        <View style={[styles.badge, received && styles.badgeIn]}>
          <Icon
            name={received ? 'arrowDown' : 'arrowUp'}
            size={18}
            color={colors.onGold}
          />
        </View>
        <View style={styles.text}>
          <Text style={styles.title}>{message.title}</Text>
          <Text style={styles.detail}>{message.detail}</Text>
        </View>
      </Pressable>
    </Animated.View>
  );
}

const useStyles = makeStyles(colors => ({
  wrap: {
    position: 'absolute',
    top: space.sm,
    left: space.md,
    right: space.md,
  },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.inkRaised,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.gold,
    padding: space.md,
    shadowColor: '#000000',
    shadowOpacity: 0.3,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 6,
  },
  badge: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.gold,
    marginRight: space.md,
  },
  badgeIn: { backgroundColor: colors.ok },
  text: { flex: 1 },
  title: { fontFamily: fonts.sansSemiBold, fontSize: 16, color: colors.text },
  detail: {
    fontFamily: fonts.sans,
    fontSize: 14,
    color: colors.textMuted,
    marginTop: 2,
    fontVariant: ['tabular-nums'],
  },
}));
