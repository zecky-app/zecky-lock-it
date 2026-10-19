import React, { useMemo } from 'react';
import { View } from 'react-native';
import { makeQrMatrix } from '../lib/qr';
import { makeStyles } from '../theme';

interface Props {
  value: string;
  /** Outer width and height in points, including the white margin. */
  size: number;
}

const QUIET_MODULES = 3;

/** QR code drawn with plain views, so it needs no native graphics library. */
export function QrCode({ value, size }: Props) {
  const styles = useStyles();
  const matrix = useMemo(() => makeQrMatrix(value), [value]);
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
}));
