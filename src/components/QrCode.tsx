import React, { useMemo } from 'react';
import { PixelRatio, Text, View } from 'react-native';
import { makeQrMatrix } from '../lib/qr';
import { fonts, makeStyles } from '../theme';
import { METAL } from './lock/metal';

interface Props {
  value: string;
  /** Outer width and height in points, including the white margin. */
  size: number;
  /**
   * The Zecky Z in the middle, as on the Mac. The code is then made with
   * high error correction so it still scans.
   */
  badge?: boolean;
}

// The QR standard asks a quiet zone of 4 modules around the code. Module
// sizes snap to physical pixels (not whole points), so the leftover margin
// stays small: about 4 to 6 modules, and the code itself is as large as the
// card allows.
const QUIET_MODULES = 4;

/** Light background: dark on light is what every scanner expects. */
export const QR_PAPER = '#ECE8DF';
const QR_INK = '#14161C';

/** QR code drawn with plain views, so it needs no native graphics library. */
export function QrCode({ value, size, badge = false }: Props) {
  const styles = useStyles();
  const matrix = useMemo(
    () => makeQrMatrix(value, badge ? 'H' : 'M'),
    [value, badge],
  );
  // Whole-pixel modules keep the edges crisp; leftover space becomes margin.
  const scale = PixelRatio.get();
  const cell =
    Math.max(
      1,
      Math.floor((size * scale) / (matrix.size + QUIET_MODULES * 2)),
    ) / scale;
  const inner = cell * matrix.size;

  return (
    <View
      accessible
      accessibilityLabel="QR code of your address"
      style={[styles.frame, { width: size, height: size }]}
    >
      <View style={{ width: inner, height: inner }}>
        {matrix.rows.map((runs, r) => (
          <View key={r} style={{ height: cell }}>
            {runs.map(run => (
              <View
                key={run.start}
                style={[
                  styles.dark,
                  {
                    left: run.start * cell,
                    width: run.length * cell,
                    height: cell,
                  },
                ]}
              />
            ))}
          </View>
        ))}
      </View>
      {badge && (
        <View
          style={[
            styles.badge,
            {
              width: Math.round(inner * 0.2),
              height: Math.round(inner * 0.2),
              borderRadius: Math.round(inner * 0.04),
            },
          ]}
        >
          <Text style={[styles.badgeZ, { fontSize: Math.round(inner * 0.13) }]}>
            Z
          </Text>
        </View>
      )}
    </View>
  );
}

// A QR code is always dark on a light paper color, whatever the theme, so
// it scans.
const useStyles = makeStyles(() => ({
  frame: {
    backgroundColor: QR_PAPER,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dark: { position: 'absolute', top: 0, backgroundColor: QR_INK },
  badge: {
    position: 'absolute',
    backgroundColor: METAL.plateInk,
    borderWidth: 3,
    borderColor: QR_PAPER,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeZ: { fontFamily: fonts.serifMedium, color: METAL.gold, marginTop: -2 },
}));
