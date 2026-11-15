import React, { useEffect, useRef } from 'react';
import { Animated, Easing, StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, G, Line } from 'react-native-svg';
import { fonts, useColors } from '../../theme';

interface Props {
  /** 0 to 1, towards the next milestone. */
  progress: number;
  diameter?: number;
  /** The day a milestone is reached: a soft glow along the arc. */
  glow?: boolean;
  /**
   * Raise this for each new block: "BLOCK <height>" shows for a moment and,
   * when `sweepLight` is on, a short gold light runs once around the ring.
   * 0 shows nothing.
   */
  sweep?: number;
  /** The block shown with the sweep. */
  sweepHeight?: number;
  /** Run the light (off with Reduce Motion: then only the number shows). */
  sweepLight?: boolean;
}

const SWEEP_MS = 1200;
// The light: a tail of a few arc pieces that brighten towards the head.
const TAIL_DEG = 36;
const TAIL_PARTS = 4;

// Room around the ring for the glow of the tip.
const PAD = 10;

/**
 * A thin gold ring around the lock that fills towards the next milestone,
 * with a glowing tip like the hand of a clock and fine tick marks.
 */
export function MilestoneRing({
  progress,
  diameter = 300,
  glow = false,
  sweep = 0,
  sweepHeight = 0,
  sweepLight = true,
}: Props) {
  const colors = useColors();
  // The sweep turns a separate layer with the native driver (transform and
  // opacity only), so it stays smooth on older iPhones and never redraws
  // the ring underneath.
  const turn = useRef(new Animated.Value(0)).current;
  const light = useRef(new Animated.Value(0)).current;
  const label = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (sweep <= 0) return;
    turn.setValue(0);
    light.setValue(0);
    // The number fades in, stays a few seconds, and fades out, as on the
    // Mac; a newer block restarts it.
    const number = Animated.sequence([
      Animated.timing(label, {
        toValue: 1,
        duration: 600,
        useNativeDriver: true,
      }),
      Animated.delay(3300),
      Animated.timing(label, {
        toValue: 0,
        duration: 600,
        useNativeDriver: true,
      }),
    ]);
    number.start();
    if (!sweepLight) return () => number.stop();
    const run = Animated.parallel([
      Animated.timing(turn, {
        toValue: 1,
        duration: SWEEP_MS,
        easing: Easing.inOut(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.sequence([
        Animated.timing(light, {
          toValue: 1,
          duration: 150,
          useNativeDriver: true,
        }),
        Animated.delay(SWEEP_MS - 450),
        Animated.timing(light, {
          toValue: 0,
          duration: 400,
          useNativeDriver: true,
        }),
      ]),
    ]);
    run.start();
    return () => {
      run.stop();
      number.stop();
    };
  }, [sweep, sweepLight, turn, light, label]);
  const rotate = turn.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });
  const p = Math.max(0.004, Math.min(1, progress));
  const r = diameter / 2;
  const c = r + PAD;
  const size = diameter + PAD * 2;
  const circumference = 2 * Math.PI * r;
  const angle = (p * 360 - 90) * (Math.PI / 180);
  const tip = { x: c + r * Math.cos(angle), y: c + r * Math.sin(angle) };

  const ticks = [];
  for (let i = 0; i < 60; i++) {
    const long = i % 5 === 0;
    const h = long ? 8 : 4;
    const a = (i * 6 - 90) * (Math.PI / 180);
    const r1 = r - 10 - h / 2;
    const r2 = r - 10 + h / 2;
    ticks.push(
      <Line
        key={i}
        x1={c + r1 * Math.cos(a)}
        y1={c + r1 * Math.sin(a)}
        x2={c + r2 * Math.cos(a)}
        y2={c + r2 * Math.sin(a)}
        stroke={colors.gold}
        strokeOpacity={long ? 0.35 : 0.14}
        strokeWidth={1}
      />,
    );
  }

  return (
    <View
      pointerEvents="none"
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={{ width: size, height: size }}
    >
      <Svg width={size} height={size}>
        <Circle
          cx={c}
          cy={c}
          r={r}
          fill="none"
          stroke={colors.gold}
          strokeOpacity={0.14}
          strokeWidth={2}
        />
        <G rotation={-90} origin={`${c}, ${c}`}>
          {/* On a milestone day only, a wider, softer copy: the glow. */}
          {glow && (
            <Circle
              cx={c}
              cy={c}
              r={r}
              fill="none"
              stroke={colors.gold}
              strokeOpacity={0.12}
              strokeWidth={16}
              strokeLinecap="round"
              strokeDasharray={[circumference * p, circumference]}
            />
          )}
          {/* A soft wide copy under the arc stands in for its glow. */}
          <Circle
            cx={c}
            cy={c}
            r={r}
            fill="none"
            stroke={colors.gold}
            strokeOpacity={0.18}
            strokeWidth={7}
            strokeLinecap="round"
            strokeDasharray={[circumference * p, circumference]}
          />
          <Circle
            cx={c}
            cy={c}
            r={r}
            fill="none"
            stroke={colors.gold}
            strokeWidth={2.5}
            strokeLinecap="round"
            strokeDasharray={[circumference * p, circumference]}
          />
        </G>
        <Circle
          cx={tip.x}
          cy={tip.y}
          r={9}
          fill={colors.gold}
          fillOpacity={0.18}
        />
        <Circle cx={tip.x} cy={tip.y} r={4} fill={colors.gold} />
        {ticks}
      </Svg>
      {sweep > 0 && sweepHeight > 0 && (
        <Animated.View
          style={[
            styles.label,
            { width: size, top: c - r + Math.round(diameter * 0.12) },
            { opacity: label },
          ]}
        >
          <Text style={[styles.labelText, { color: colors.gold }]}>
            BLOCK {sweepHeight.toLocaleString('en-US')}
          </Text>
        </Animated.View>
      )}
      {sweep > 0 && sweepLight && (
        <Animated.View
          style={[
            styles.sweep,
            {
              width: size,
              height: size,
              opacity: light,
              transform: [{ rotate }],
            },
          ]}
        >
          <Svg width={size} height={size}>
            {/* Drawn ending at the top; the layer turns it once around. */}
            {Array.from({ length: TAIL_PARTS }, (_, i) => {
              const part = TAIL_DEG / TAIL_PARTS;
              const start = -90 - TAIL_DEG + i * part;
              return (
                <G key={i} rotation={start} origin={`${c}, ${c}`}>
                  <Circle
                    cx={c}
                    cy={c}
                    r={r}
                    fill="none"
                    stroke={colors.gold}
                    strokeOpacity={0.15 + (0.55 * (i + 1)) / TAIL_PARTS}
                    strokeWidth={3}
                    strokeDasharray={[
                      (circumference * part) / 360,
                      circumference,
                    ]}
                  />
                </G>
              );
            })}
            <Circle
              cx={c}
              cy={c - r}
              r={8}
              fill={colors.gold}
              fillOpacity={0.25}
            />
            <Circle cx={c} cy={c - r} r={3} fill={colors.gold} />
          </Svg>
        </Animated.View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  sweep: { position: 'absolute' },
  // Inside the ring, under its top and above the shackle, like on the Mac.
  label: { position: 'absolute', left: 0, alignItems: 'center' },
  labelText: {
    fontFamily: fonts.sansMedium,
    fontSize: 10,
    letterSpacing: 1.5,
    opacity: 0.8,
    fontVariant: ['tabular-nums'],
  },
});
