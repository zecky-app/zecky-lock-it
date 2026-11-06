import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import type { ViewStyle } from 'react-native';
import { fonts, makeStyles, space } from '../../theme';
import { Medallion } from './Medallion';
import { ZeckyLock } from './ZeckyLock';

interface HeaderProps {
  title: string;
  subtitle?: string;
  /** The shackle: open while releasing, closed for locking more. */
  open: boolean;
  /** Smaller lock on short screens. */
  compact?: boolean;
  /** No lock at all: while the keyboard is open, so the fields stay in view. */
  bare?: boolean;
}

/**
 * The top of Lock more and Release: the same room as the main screen. A
 * smaller Zecky lock on its guilloché medallion, then the title, so these
 * screens feel like the lock itself rather than a separate form.
 */
export function RoomHeader({
  title,
  subtitle,
  open,
  compact,
  bare,
}: HeaderProps) {
  const s = useRoomStyles();
  const lock = compact ? 64 : 84;
  return (
    <View style={[s.header, bare && s.headerBare]}>
      {!bare && (
        <View style={[s.hero, { height: Math.round(lock * 1.2) }]}>
          <View
            style={StyleSheet.absoluteFill}
            pointerEvents="none"
            accessibilityElementsHidden
            importantForAccessibility="no-hide-descendants"
          >
            <View style={s.center}>
              <Medallion diameter={Math.round(lock * 3.4)} />
            </View>
          </View>
          <View
            accessibilityElementsHidden
            importantForAccessibility="no-hide-descendants"
          >
            <ZeckyLock open={open} size={lock} />
          </View>
        </View>
      )}
      <Text style={s.label}>ZECKY</Text>
      <Text style={s.title} accessibilityRole="header">
        {title}
      </Text>
      {subtitle != null && <Text style={s.subtitle}>{subtitle}</Text>}
    </View>
  );
}

/** An engraved brass plate for the fields and the QR code in the room. */
export function usePlateStyle(): ViewStyle {
  return useRoomStyles().plate;
}

const useRoomStyles = makeStyles(colors => ({
  header: { alignItems: 'center', gap: 6, marginBottom: space.lg },
  headerBare: { marginBottom: space.md },
  hero: {
    alignSelf: 'stretch',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: space.sm,
  },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  label: {
    fontFamily: fonts.sansSemiBold,
    fontSize: 11,
    letterSpacing: 4,
    color: colors.gold,
  },
  title: {
    fontFamily: fonts.serifMedium,
    fontSize: 30,
    color: colors.text,
    textAlign: 'center',
  },
  subtitle: {
    fontFamily: fonts.sans,
    fontSize: 13,
    lineHeight: 19,
    color: colors.textMuted,
    textAlign: 'center',
  },
  plate: {
    padding: space.md,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.gold + '38',
    backgroundColor: colors.inkRaised,
    shadowColor: colors.gold,
    shadowOpacity: 0.12,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 0 },
  },
}));
