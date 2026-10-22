import React from 'react';
import { ActivityIndicator, Pressable, Text } from 'react-native';
import { fonts, makeStyles, space, useColors } from '../theme';
import { noteEvent } from '../wallet/entropy';
import { BrassButton } from './lock/BrassButton';

interface Props {
  label: string;
  onPress: () => void;
  /**
   * One rule everywhere, as on Home: the main action is brass; other
   * actions are gold text; the way back (Done, Back, Cancel) is quiet
   * text; something that cannot be undone is red.
   */
  variant?: 'primary' | 'quiet' | 'back' | 'danger';
  busy?: boolean;
  disabled?: boolean;
}

export function Button({
  label,
  onPress,
  variant = 'primary',
  busy = false,
  disabled = false,
}: Props) {
  const colors = useColors();
  const styles = useStyles();
  if (variant === 'primary') {
    return (
      <BrassButton
        label={label}
        icon={null}
        onPress={onPress}
        busy={busy}
        disabled={disabled}
      />
    );
  }
  const danger = variant === 'danger';
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: disabled || busy }}
      disabled={disabled || busy}
      onPress={() => {
        noteEvent();
        onPress();
      }}
      style={({ pressed }) => [
        styles.base,
        danger && styles.danger,
        (pressed || disabled) && styles.dim,
      ]}
    >
      {busy ? (
        <ActivityIndicator color={danger ? colors.danger : colors.gold} />
      ) : (
        <Text
          style={[
            styles.label,
            variant === 'back' && styles.back,
            danger && styles.dangerLabel,
          ]}
        >
          {label}
        </Text>
      )}
    </Pressable>
  );
}

const useStyles = makeStyles(colors => ({
  base: {
    minHeight: 46,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: space.lg,
  },
  danger: {
    minHeight: 50,
    borderWidth: 1,
    borderColor: colors.danger,
    backgroundColor: colors.danger + '14',
  },
  dim: { opacity: 0.5 },
  label: { fontFamily: fonts.sansMedium, fontSize: 15, color: colors.gold },
  back: { color: colors.textMuted },
  dangerLabel: { fontFamily: fonts.sansSemiBold, color: colors.danger },
}));
