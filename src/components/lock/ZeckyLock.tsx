import React, { useEffect, useRef } from 'react';
import { Animated, Easing, StyleSheet, Text, View } from 'react-native';
import Svg, {
  Defs,
  Ellipse,
  LinearGradient,
  Path,
  RadialGradient,
  Rect,
  Stop,
  Text as SvgText,
} from 'react-native-svg';
import { fonts, useIsDark } from '../../theme';
import { METAL } from './metal';

interface Props {
  /** Shackle swung open. */
  open: boolean;
  /** Width in points; the height follows (300 × 340 drawing). */
  size?: number;
  /** What the name plate says: the value, or LOCKED / OPEN. No plate when null. */
  plateText?: string | null;
}

const W = 300;
const H = 340;
// The shackle turns around the top of its right leg.
const PIVOT = { x: 216 - W / 2, y: 160 - H / 2 };
const SHACKLE = 'M84 160 L84 96 A66 66 0 0 1 216 96 L216 160';

/**
 * The Zecky lock: a gold padlock with the engraved Z and a name plate,
 * drawn like Lock it on the Mac. The shackle swings open and closed.
 */
export function ZeckyLock({ open, size = 220, plateText = null }: Props) {
  const dark = useIsDark();
  const swing = useRef(new Animated.Value(open ? 1 : 0)).current;

  useEffect(() => {
    Animated.timing(swing, {
      toValue: open ? 1 : 0,
      duration: 420,
      easing: Easing.out(Easing.back(1.4)),
      useNativeDriver: true,
    }).start();
  }, [open, swing]);

  const scale = size / W;
  const plate = plateText != null && plateText !== '';
  const isWord = plate && /^[A-Za-z]+$/.test(plateText);
  // The Z and the plate are centred on the body together.
  const zBaseline = plate ? 247 : 263;

  return (
    <View
      style={{ width: size, height: (size * H) / W }}
      accessible
      accessibilityRole="image"
      accessibilityLabel={
        open ? 'The Zecky lock, opened' : 'The Zecky lock, locked'
      }
    >
      <View
        style={[
          styles.canvas,
          {
            left: (size - W) / 2,
            top: (size * H) / W / 2 - H / 2,
            transform: [{ scale }],
          },
        ]}
      >
        {/* Shadow on the ground. */}
        <Svg width={W} height={H} style={StyleSheet.absoluteFill}>
          <Defs>
            <RadialGradient id="shadow" cx="50%" cy="50%" r="50%">
              <Stop
                offset="0"
                stopColor="#000"
                stopOpacity={dark ? 0.6 : 0.28}
              />
              <Stop offset="1" stopColor="#000" stopOpacity={0} />
            </RadialGradient>
          </Defs>
          <Ellipse cx={150} cy={332} rx={122} ry={14} fill="url(#shadow)" />
        </Svg>

        {/* Shackle, behind the body, swinging around its right leg. */}
        <Animated.View
          style={[
            StyleSheet.absoluteFill,
            {
              transform: [
                { translateX: PIVOT.x },
                { translateY: PIVOT.y },
                {
                  rotate: swing.interpolate({
                    inputRange: [0, 1],
                    outputRange: ['0deg', '-22deg'],
                  }),
                },
                { translateX: -PIVOT.x },
                { translateY: -PIVOT.y },
                {
                  translateY: swing.interpolate({
                    inputRange: [0, 1],
                    outputRange: [0, -36],
                  }),
                },
              ],
            },
          ]}
        >
          <Svg width={W} height={H}>
            <Defs>
              <LinearGradient
                id="shackle"
                x1="84"
                y1="0"
                x2="216"
                y2="0"
                gradientUnits="userSpaceOnUse"
              >
                <Stop offset="0" stopColor={METAL.shackle[0]} />
                <Stop offset="0.33" stopColor={METAL.shackle[1]} />
                <Stop offset="0.6" stopColor={METAL.shackle[2]} />
                <Stop offset="1" stopColor={METAL.shackle[3]} />
              </LinearGradient>
            </Defs>
            <Path
              d={SHACKLE}
              stroke="url(#shackle)"
              strokeWidth={26}
              fill="none"
            />
          </Svg>
        </Animated.View>

        {/* Body with the engraved Z. */}
        <Svg width={W} height={H} style={StyleSheet.absoluteFill}>
          <Defs>
            <LinearGradient id="body" x1="0" y1="0" x2="0" y2="1">
              <Stop offset="0" stopColor={METAL.bodyTop} />
              <Stop offset="0.42" stopColor={METAL.gold} />
              <Stop offset="1" stopColor={METAL.bodyBottom} />
            </LinearGradient>
            <LinearGradient id="sheen" x1="0" y1="0" x2="1" y2="0.25">
              <Stop offset="0" stopColor="#FFF" stopOpacity={0} />
              <Stop offset="0.28" stopColor="#FFF" stopOpacity={0.32} />
              <Stop offset="0.46" stopColor="#FFF" stopOpacity={0} />
            </LinearGradient>
          </Defs>
          <Rect
            x={36}
            y={148}
            width={228}
            height={176}
            rx={34}
            fill="url(#body)"
          />
          <Rect
            x={36}
            y={148}
            width={228}
            height={176}
            rx={34}
            fill="url(#sheen)"
          />
          <Rect
            x={41}
            y={153}
            width={218}
            height={166}
            rx={30}
            fill="none"
            stroke={METAL.innerEdge}
            strokeWidth={2}
          />
          <Rect
            x={36.75}
            y={148.75}
            width={226.5}
            height={174.5}
            rx={33.5}
            fill="none"
            stroke={METAL.outerEdge}
            strokeWidth={1.5}
          />
          <SvgText
            x={150}
            y={zBaseline + 3}
            fill={METAL.engraveLight}
            fontFamily={fonts.serifMedium}
            fontSize={88}
            textAnchor="middle"
          >
            Z
          </SvgText>
          <SvgText
            x={150}
            y={zBaseline}
            fill={METAL.engraveInk}
            fontFamily={fonts.serifMedium}
            fontSize={88}
            textAnchor="middle"
          >
            Z
          </SvgText>
        </Svg>

        {plate && (
          <View style={styles.plateRow} pointerEvents="none">
            <View style={styles.plate}>
              <Text
                numberOfLines={1}
                adjustsFontSizeToFit
                minimumFontScale={0.6}
                style={[
                  styles.plateText,
                  isWord ? styles.plateWord : styles.plateValue,
                ]}
              >
                {plateText}
              </Text>
            </View>
          </View>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  canvas: { position: 'absolute', width: W, height: H },
  plateRow: {
    position: 'absolute',
    top: 274,
    left: 36,
    width: 228,
    alignItems: 'center',
  },
  plate: {
    minWidth: 116,
    maxWidth: 200,
    height: 30,
    paddingHorizontal: 14,
    borderRadius: 6,
    borderWidth: 1.2,
    borderColor: METAL.plateEdge,
    backgroundColor: METAL.plateInk,
    alignItems: 'center',
    justifyContent: 'center',
  },
  plateText: {
    fontFamily: fonts.sansSemiBold,
    color: METAL.gold,
    fontVariant: ['tabular-nums'],
  },
  plateWord: { fontSize: 13, letterSpacing: 5, paddingLeft: 5 },
  plateValue: { fontSize: 14, letterSpacing: 0.4 },
});
