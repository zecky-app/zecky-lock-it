import React, { useMemo } from 'react';
import { Text, View } from 'react-native';
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

const QUIET_MODULES = 3;

/** QR code drawn with plain views, so it needs no native graphics library. */
export function QrCode({ value, size, badge = false }: Props) {
  const styles = useStyles();
  const matrix = useMemo(
    () => makeQrMatrix(value, badge ? 'H' : 'M'),
    [value, badge],
  );
  // Whole-point modules keep the edges crisp; leftover space becomes margin.
  const cell = Math.max(
    1,
    Math.floor(size / (matrix.size + QUIET_MODULES * 2)),
  );
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

// A QR code is always dark on white, whatever the theme, so it scans.
const useStyles = makeStyles(() => ({
  frame: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dark: { position: 'absolute', top: 0, backgroundColor: '#14161C' },
  badge: {
    position: 'absolute',
    backgroundColor: METAL.plateInk,
    borderWidth: 3,
    borderColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeZ: { fontFamily: fonts.serifMedium, color: METAL.gold, marginTop: -2 },
}));
