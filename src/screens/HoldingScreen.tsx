import React, { useEffect, useRef, useState } from 'react';
import {
  AccessibilityInfo,
  Animated,
  Modal,
  Pressable,
  ScrollView,
  Text,
  View,
} from 'react-native';
import type { Transaction } from 'react-native-zcash';
import { Button } from '../components/Button';
import { MilestoneRing, SheetCorner, SheetHeader } from '../components/lock';
import {
  holding,
  markMomentSeen,
  milestoneLine,
  milestoneName,
  milestonePath,
  momentSeen,
  shortPath,
  stackingPace,
} from '../lib/holding';
import { heldFor } from '../lib/lockedSince';
import { milestoneState } from '../lib/milestones';
import { formatExact, Unit } from '../lib/zec';
import { fonts, makeStyles, space, useColors } from '../theme';

// Opened from "Locked for …" on Home: how long this Zcash has been in the
// lock, a few highlights and the milestone path. Everything comes from
// the wallet history on this phone; nothing is sent or stored but which
// milestone moment was already shown.

interface Props {
  visible: boolean;
  transactions: Transaction[];
  unit: Unit;
  hidden: boolean;
  onClose: () => void;
}

const date = (d: Date) =>
  d.toLocaleDateString('en-US', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });

function Line(props: { label: string; value: string; last?: boolean }) {
  const styles = useStyles();
  return (
    <View style={[styles.line, props.last !== true && styles.divider]}>
      <Text style={styles.lineLabel}>{props.label}</Text>
      <Text style={styles.lineValue}>{props.value}</Text>
    </View>
  );
}

export function HoldingScreen({
  visible,
  transactions,
  unit,
  hidden,
  onClose,
}: Props) {
  const colors = useColors();
  const styles = useStyles();
  const now = new Date();
  const h = holding(transactions, now);
  const ring = milestoneState(h?.days ?? 0);
  const reachedDays = h != null && ring.reachedToday ? h.days : null;

  // The milestone moment: once, the first time the page opens that day.
  const [moment, setMoment] = useState<number | null>(null);
  const light = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (!visible || h == null || reachedDays == null) {
      setMoment(null);
      return;
    }
    if (momentSeen(h.since, reachedDays)) {
      setMoment(reachedDays);
      light.setValue(1);
      return;
    }
    markMomentSeen(h.since, reachedDays);
    setMoment(reachedDays);
    light.setValue(0);
    AccessibilityInfo.isReduceMotionEnabled()
      .then(reduce => {
        if (reduce) light.setValue(1);
        else
          Animated.timing(light, {
            toValue: 1,
            duration: 1800,
            delay: 400,
            useNativeDriver: false,
          }).start();
      })
      .catch(() => light.setValue(1));
  }, [visible, h?.since.getTime(), reachedDays]); // eslint-disable-line react-hooks/exhaustive-deps

  const amount = (zatoshi: bigint) =>
    hidden ? '••••' : formatExact(zatoshi.toString(), unit);

  const held = h == null ? null : heldFor(h.days);
  const pace = h == null ? null : stackingPace(h.current.received, h.days);
  const [count, ...rest] = (held ?? '').replace(/^for /, '').split(' ');
  // Short: the last milestone reached and the next two. Tapped: the whole
  // path up to Legend at 4 years.
  const [all, setAll] = useState(false);
  useEffect(() => {
    if (!visible) setAll(false);
  }, [visible]);
  const fullPath = h == null ? [] : milestonePath(h.since, h.days);
  const path = all ? fullPath : shortPath(fullPath);

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <View style={styles.container}>
        <SheetCorner />
        <ScrollView
          contentContainerStyle={styles.scroll}
          showsVerticalScrollIndicator={false}
        >
          <SheetHeader
            title={h == null ? 'Nothing locked' : `Locked ${held}`}
            subtitle={h == null ? undefined : `Since ${date(h.since)}`}
          />

          {h != null && (
            <>
              <View style={styles.ringWrap}>
                <MilestoneRing
                  progress={ring.progress}
                  glow={ring.reachedToday}
                  diameter={150}
                />
                <View style={styles.ringCenter} pointerEvents="none">
                  {h.days < 1 ? (
                    <Text style={styles.ringSmall}>since today</Text>
                  ) : (
                    <>
                      <Text style={styles.ringValue}>{count}</Text>
                      <Text style={styles.ringLabel}>{rest.join(' ')}</Text>
                    </>
                  )}
                </View>
              </View>
              {moment != null && (
                <Animated.Text style={[styles.moment, { opacity: light }]}>
                  {milestoneName(moment)}. {milestoneLine(moment)}
                </Animated.Text>
              )}

              <Text style={styles.section}>Milestones</Text>
              <Pressable
                accessibilityRole="button"
                accessibilityHint={
                  all ? 'Shows fewer milestones' : 'Shows every milestone'
                }
                onPress={() => setAll(!all)}
                style={[styles.card, styles.pathCard]}
              >
                {path.map((step, i) => {
                  const next = step.progress != null;
                  const lit = moment === step.days;
                  return (
                    <View key={step.days} style={styles.step}>
                      <View style={styles.rail}>
                        <View
                          style={[
                            styles.dot,
                            step.reached && { backgroundColor: colors.gold },
                            next && styles.dotNext,
                          ]}
                        />
                        {i < path.length - 1 && (
                          <View
                            style={[
                              styles.railLine,
                              step.reached &&
                                path[i + 1].reached && {
                                  backgroundColor: colors.gold,
                                },
                            ]}
                          />
                        )}
                      </View>
                      <View style={styles.stepText}>
                        {lit && (
                          <Animated.View
                            pointerEvents="none"
                            style={[styles.stepLight, { opacity: light }]}
                          />
                        )}
                        <Text
                          style={[
                            styles.stepName,
                            !step.reached && !next && styles.dim,
                          ]}
                        >
                          {step.name}
                        </Text>
                        <Text
                          style={[
                            styles.stepSub,
                            !step.reached && !next && styles.dim,
                          ]}
                        >
                          {step.reached
                            ? `${step.length} · ${date(step.at)}`
                            : next
                            ? `${step.length} · in ${step.inDays} ${
                                step.inDays === 1 ? 'day' : 'days'
                              }`
                            : step.length}
                        </Text>
                        {next && (
                          <View style={styles.bar}>
                            <View
                              style={[
                                styles.barFill,
                                {
                                  width: `${Math.max(
                                    2,
                                    (step.progress ?? 0) * 100,
                                  )}%`,
                                },
                              ]}
                            />
                          </View>
                        )}
                      </View>
                    </View>
                  );
                })}
                <Text style={styles.more}>
                  {all ? 'Show less' : 'Show all milestones ›'}
                </Text>
              </Pressable>
              <Text style={styles.section}>Highlights</Text>
              <View style={styles.card}>
                <Line label="Since" value={date(h.since)} />
                <Line
                  label="Received since then"
                  value={amount(h.current.received)}
                />
                {pace != null && (
                  <Line
                    label="Stacking pace"
                    value={`+${amount(pace.zatoshi)} a ${pace.per}`}
                  />
                )}
                <Line
                  label="Payments in"
                  value={String(h.current.paymentsIn)}
                  last={h.current.largest == null && h.longestBefore == null}
                />
                {h.current.largest != null && (
                  <Line
                    label="Largest payment in"
                    value={`${amount(h.current.largest.zatoshi)} · ${date(
                      h.current.largest.at,
                    )}`}
                    last={h.longestBefore == null}
                  />
                )}
                {h.longestBefore != null && (
                  <Line
                    label="Longest before"
                    value={heldFor(h.longestBefore.days).replace(/^for /, '')}
                    last
                  />
                )}
              </View>
            </>
          )}

          <Text style={styles.quiet}>
            {h == null
              ? 'The count starts when Zcash comes into the lock.'
              : 'Worked out on this iPhone from your own payments. Sending or receiving more never resets it; only an empty lock does.'}
          </Text>
        </ScrollView>
        <Button label="Done" variant="back" onPress={onClose} />
      </View>
    </Modal>
  );
}

const useStyles = makeStyles(colors => ({
  container: {
    flex: 1,
    backgroundColor: colors.ink,
    padding: space.lg,
    paddingBottom: space.xl + space.sm,
    overflow: 'hidden',
  },
  scroll: { paddingBottom: space.lg },
  ringWrap: {
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: space.sm,
  },
  ringCenter: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
  },
  ringValue: {
    fontFamily: fonts.serifMedium,
    fontSize: 36,
    color: colors.text,
    fontVariant: ['tabular-nums'],
  },
  ringLabel: { fontFamily: fonts.sans, fontSize: 13, color: colors.textMuted },
  ringSmall: { fontFamily: fonts.serif, fontSize: 20, color: colors.text },
  moment: {
    fontFamily: fonts.serif,
    fontSize: 17,
    color: colors.gold,
    textAlign: 'center',
    marginBottom: space.sm,
  },
  section: {
    fontFamily: fonts.sansSemiBold,
    fontSize: 11,
    letterSpacing: 1,
    textTransform: 'uppercase',
    color: colors.textMuted,
    marginTop: space.lg,
    marginBottom: space.xs,
  },
  card: {
    backgroundColor: colors.inkRaised,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.line,
    paddingHorizontal: space.md,
  },
  divider: { borderBottomWidth: 0.5, borderBottomColor: colors.line },
  line: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 13,
  },
  lineLabel: { fontFamily: fonts.sans, fontSize: 15, color: colors.text },
  lineValue: {
    fontFamily: fonts.sansMedium,
    fontSize: 14,
    color: colors.text,
    fontVariant: ['tabular-nums'],
    flexShrink: 1,
    textAlign: 'right',
    marginLeft: space.md,
  },
  pathCard: { paddingTop: space.md, paddingBottom: space.sm },
  more: {
    fontFamily: fonts.sansMedium,
    fontSize: 13,
    color: colors.gold,
    textAlign: 'center',
    paddingVertical: space.xs,
  },
  step: { flexDirection: 'row', minHeight: 56 },
  rail: { width: 22, alignItems: 'center' },
  dot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    marginTop: 4,
    borderWidth: 1.5,
    borderColor: colors.gold,
    backgroundColor: 'transparent',
  },
  dotNext: { borderWidth: 2.5 },
  railLine: {
    flex: 1,
    width: 1.5,
    marginVertical: 4,
    backgroundColor: colors.line,
  },
  stepText: { flex: 1, paddingLeft: space.sm, paddingBottom: space.md },
  stepLight: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: -6,
    bottom: 6,
    borderRadius: 10,
    // A faint gold wash; the animation only fades it in.
    backgroundColor: `${colors.gold}24`,
  },
  stepName: { fontFamily: fonts.serifMedium, fontSize: 18, color: colors.text },
  stepSub: {
    fontFamily: fonts.sans,
    fontSize: 13,
    color: colors.textMuted,
    marginTop: 2,
  },
  dim: { opacity: 0.45 },
  bar: {
    height: 3,
    borderRadius: 2,
    backgroundColor: colors.line,
    marginTop: space.sm,
    overflow: 'hidden',
  },
  barFill: { height: 3, backgroundColor: colors.gold },
  quiet: {
    fontFamily: fonts.sans,
    fontSize: 13,
    lineHeight: 19,
    color: colors.textMuted,
    marginTop: space.lg,
  },
}));
