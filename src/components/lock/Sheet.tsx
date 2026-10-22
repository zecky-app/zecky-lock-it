import React, { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import type { ViewStyle } from 'react-native';
import Svg, {
  Defs,
  G,
  Mask,
  Path,
  RadialGradient,
  Rect,
  Stop,
} from 'react-native-svg';
import { fonts, makeStyles, space, useColors } from '../../theme';
import { wavyRing } from './metal';

const CORNER = 320;

/** A quarter of the medallion, peeking in from a sheet's top-right corner. */
export function SheetCorner() {
  const colors = useColors();
  const rings = useMemo(() => {
    const out: string[] = [];
    const c = CORNER / 2;
    for (let k = 0; k < 7; k++) {
      for (let copy = 0; copy < 3; copy++) {
        const phase = ((copy / 3) * 2 * Math.PI) / 40;
        out.push(wavyRing(c, c, 60 + k * 18, 6, 40, phase, 360, 0));
      }
    }
    return out;
  }, []);
  return (
    <View
      pointerEvents="none"
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={styles.corner}
    >
      <Svg width={CORNER} height={CORNER}>
        <Defs>
          <RadialGradient id="cornerFade" cx="50%" cy="50%" r="53%">
            <Stop offset="0.24" stopColor="#FFF" stopOpacity={1} />
            <Stop offset="1" stopColor="#FFF" stopOpacity={0} />
          </RadialGradient>
          <Mask id="cornerMask">
            <Rect width={CORNER} height={CORNER} fill="url(#cornerFade)" />
          </Mask>
        </Defs>
        <G mask="url(#cornerMask)">
          {rings.map((d, i) => (
            <Path
              key={i}
              d={d}
              fill="none"
              stroke={colors.gold}
              strokeOpacity={0.07}
              strokeWidth={0.6}
            />
          ))}
        </G>
      </Svg>
    </View>
  );
}

interface HeaderProps {
  title: string;
  subtitle?: string;
}

/**
 * The shared sheet heading, as on the Mac: a small gold ZECKY label, a serif
 * title and one line of explanation. Put SheetCorner behind the sheet.
 */
export function SheetHeader({ title, subtitle }: HeaderProps) {
  const s = useSheetStyles();
  return (
    <View style={s.header}>
      <Text style={s.label}>ZECKY</Text>
      <Text style={s.title} accessibilityRole="header">
        {title}
      </Text>
      {subtitle != null && <Text style={s.subtitle}>{subtitle}</Text>}
    </View>
  );
}

/** A calm card for grouped content, as on the Mac. */
export function useCardStyle(): ViewStyle {
  return useSheetStyles().card;
}

const useSheetStyles = makeStyles(colors => ({
  header: { gap: 6, marginBottom: space.lg },
  label: {
    fontFamily: fonts.sansSemiBold,
    fontSize: 11,
    letterSpacing: 4,
    color: colors.gold,
  },
  title: { fontFamily: fonts.serifMedium, fontSize: 30, color: colors.text },
  subtitle: {
    fontFamily: fonts.sans,
    fontSize: 13,
    lineHeight: 19,
    color: colors.textMuted,
  },
  card: {
    padding: space.md,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.inkRaised,
  },
}));

const styles = StyleSheet.create({
  corner: { position: 'absolute', top: -120, right: -120 },
});
