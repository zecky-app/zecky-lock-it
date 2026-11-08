import React, { useEffect, useRef, useState } from 'react';
import {
  AccessibilityInfo,
  Modal,
  NativeModules,
  ScrollView,
  Text,
  View,
} from 'react-native';
import { Button } from '../components/Button';
import { MilestoneRing, SheetCorner, SheetHeader } from '../components/lock';
import { WALLET_ALIAS } from '../config';
import { serverLabel, useServer } from '../lib/server';
import {
  checkedShare,
  onSyncProblems,
  ringPercent,
  ScanOverview,
  syncProblems,
  unscannedSegments,
} from '../lib/syncProblems';
import type { TorStatus } from '../lib/tor';
import type { WalletState } from '../wallet/useSynchronizer';
import { fonts, makeStyles, space, useColors } from '../theme';

// Sync details, opened from the status line on the main screen: where the
// network is, how far this wallet has checked, and what went wrong lately.
// Read-only: it only asks the engine on this phone.

interface Props {
  visible: boolean;
  state: WalletState;
  birthdayHeight: number;
  /** The same text as the status line on the main screen. */
  statusText: string;
  onClose: () => void;
}

const CONNECTION: Record<TorStatus, string> = {
  off: 'Direct',
  starting: 'Tor, connecting',
  on: 'Over Tor',
  failed: 'Tor could not connect',
  unavailable: 'Tor not available',
  ownNode: 'Direct, to your own node',
};

const POLL_MS = 2000;

const n = (v: number) => v.toLocaleString('en-US');

const GLIDE_MS = 500;

/**
 * Follows a number with a short ease-out instead of jumping, so the ring
 * moves calmly between the engine's two-second readings. Jumps straight
 * there when Reduce Motion is on.
 */
function useGlide(target: number): number {
  const [shown, setShown] = useState(target);
  const from = useRef(target);
  const reduce = useRef(false);
  useEffect(() => {
    AccessibilityInfo.isReduceMotionEnabled()
      .then(on => {
        reduce.current = on;
      })
      .catch(() => {});
  }, []);
  useEffect(() => {
    if (reduce.current) {
      from.current = target;
      setShown(target);
      return;
    }
    const start = Date.now();
    const begin = from.current;
    let frame = 0;
    const step = () => {
      const t = Math.min(1, (Date.now() - start) / GLIDE_MS);
      const eased = 1 - Math.pow(1 - t, 3);
      const value = begin + (target - begin) * eased;
      from.current = value;
      setShown(value);
      if (t < 1) frame = requestAnimationFrame(step);
    };
    frame = requestAnimationFrame(step);
    return () => cancelAnimationFrame(frame);
  }, [target]);
  return shown;
}
const clock = (at: number) =>
  new Date(at).toLocaleTimeString('en-GB', {
    hour: '2-digit',
    minute: '2-digit',
  });

function Line(props: { label: string; value: string; last?: boolean }) {
  const styles = useStyles();
  return (
    <View style={[styles.line, props.last !== true && styles.divider]}>
      <Text style={styles.lineLabel}>{props.label}</Text>
      <Text style={styles.lineValue} selectable>
        {props.value}
      </Text>
    </View>
  );
}

export function SyncScreen({
  visible,
  state,
  birthdayHeight,
  statusText,
  onClose,
}: Props) {
  const colors = useColors();
  const styles = useStyles();
  const server = useServer();
  const [overview, setOverview] = useState<ScanOverview | null>(null);
  const [problems, setProblems] = useState(syncProblems());
  // Recent (time, wallet height) samples, for a rough time to go.
  const samples = useRef<{ at: number; height: number }[]>([]);

  useEffect(() => onSyncProblems(() => setProblems(syncProblems())), []);

  useEffect(() => {
    if (!visible) {
      samples.current = [];
      return;
    }
    let alive = true;
    const read = () => {
      const native = NativeModules.RNZcash;
      if (typeof native?.getScanOverview !== 'function') return;
      native
        .getScanOverview(WALLET_ALIAS)
        .then((o: ScanOverview) => {
          if (!alive) return;
          setOverview(o);
          if (o.fullyScanned != null) {
            const list = [
              ...samples.current,
              { at: Date.now(), height: o.fullyScanned },
            ];
            samples.current = list.slice(-15);
          }
        })
        .catch(() => {});
    };
    read();
    const timer = setInterval(read, POLL_MS);
    return () => {
      alive = false;
      clearInterval(timer);
    };
  }, [visible]);

  const synced = state.status === 'SYNCED';
  const tip = state.networkHeight;
  const walletHeight =
    overview?.fullyScanned ?? (synced && tip > 0 ? tip : null);
  const behind =
    tip > 0 && walletHeight != null ? Math.max(0, tip - walletHeight) : null;
  // The ring counts every block from the birthday to the network block, so
  // after a night closed it starts near the top instead of at zero. The
  // engine's own scanProgress only covers its current batch.
  const share =
    overview != null ? checkedShare(overview, birthdayHeight, tip) : null;
  const progress =
    share != null ? ringPercent(share, synced) : synced ? 100 : null;
  const glided = useGlide(progress ?? 0);

  // Blocks per second over the recent samples.
  let minutesLeft: number | null = null;
  const s = samples.current;
  if (behind != null && behind > 0 && s.length >= 3) {
    const first = s[0];
    const last = s[s.length - 1];
    const rate = (last.height - first.height) / ((last.at - first.at) / 1000);
    if (rate > 0) minutesLeft = Math.max(1, Math.round(behind / rate / 60));
  }

  const span = tip - birthdayHeight;
  const gaps =
    overview != null && tip > 0
      ? unscannedSegments(overview, birthdayHeight, tip)
      : [];

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
          <SheetHeader title="Sync" subtitle={statusText} />

          <View style={styles.ringWrap}>
            <MilestoneRing progress={glided / 100} diameter={170} />
            <View style={styles.ringCenter} pointerEvents="none">
              <Text style={styles.ringValue}>
                {progress == null
                  ? '…'
                  : progress === 100
                  ? '100%'
                  : `${(Math.floor(glided * 10) / 10).toFixed(1)}%`}
              </Text>
              <Text style={styles.ringLabel}>
                {synced ? 'up to date' : 'checked'}
              </Text>
            </View>
          </View>
          <Text style={styles.ringNote}>
            {progress == null
              ? 'Waiting for the network block'
              : synced
              ? 'Every block since the wallet birthday'
              : behind != null && behind > 0
              ? `Of all blocks since the wallet birthday. Catching up ${n(
                  behind,
                )} new ${behind === 1 ? 'block' : 'blocks'}.`
              : 'Of all blocks since the wallet birthday'}
          </Text>

          <Text style={styles.section}>Blocks</Text>
          <View style={styles.card}>
            <Line label="Network" value={tip > 0 ? n(tip) : '…'} />
            <Line
              label="This wallet"
              value={walletHeight != null ? n(walletHeight) : '…'}
            />
            <Line
              label="Behind"
              value={
                behind == null
                  ? '…'
                  : behind === 0
                  ? 'Nothing'
                  : `${n(behind)} blocks${
                      minutesLeft != null ? `, about ${minutesLeft} min` : ''
                    }`
              }
            />
            <Line
              label="Wallet birthday"
              value={`Block ${n(birthdayHeight)}`}
              last
            />
          </View>

          <Text style={styles.section}>Checked so far</Text>
          <View style={[styles.card, styles.mapCard]}>
            <View
              style={styles.map}
              accessibilityLabel={
                gaps.length === 0
                  ? 'Every block since the birthday is checked'
                  : `${gaps.length} parts still to check`
              }
            >
              <View
                style={[styles.mapFill, { backgroundColor: colors.gold }]}
              />
              {span > 0 &&
                gaps.map((g, i) => (
                  <View
                    key={i}
                    style={[
                      styles.mapGap,
                      {
                        left: `${g.from * 100}%`,
                        width: `${Math.max(0.6, (g.to - g.from) * 100)}%`,
                      },
                    ]}
                  />
                ))}
            </View>
            <View style={styles.mapEnds}>
              <Text style={styles.mapEnd}>{n(birthdayHeight)}</Text>
              <Text style={styles.mapEnd}>{tip > 0 ? n(tip) : '…'}</Text>
            </View>
            <Text style={styles.mapNote}>
              Gold is checked. Dark parts are still to check; Zecky checks the
              newest blocks first.
            </Text>
          </View>

          <Text style={styles.section}>Server</Text>
          <View style={styles.card}>
            <Line label="Server" value={serverLabel(server)} />
            <Line label="Connection" value={CONNECTION[state.tor]} last />
          </View>

          <Text style={styles.section}>Recent problems</Text>
          <View style={styles.card}>
            {problems.length === 0 ? (
              <Text style={styles.none}>None since Zecky opened.</Text>
            ) : (
              problems.map((p, i) => (
                <View
                  key={`${p.at}-${i}`}
                  style={[
                    styles.problem,
                    i < problems.length - 1 && styles.divider,
                  ]}
                >
                  <Text style={styles.problemTime}>{clock(p.at)}</Text>
                  <Text style={styles.problemText}>{p.message}</Text>
                </View>
              ))
            )}
          </View>
          <Text style={styles.quiet}>
            Kept on this iPhone only while Zecky is open.
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
  ringNote: {
    fontFamily: fonts.sans,
    fontSize: 13,
    color: colors.textMuted,
    textAlign: 'center',
    marginBottom: space.md,
  },
  ringLabel: {
    fontFamily: fonts.sans,
    fontSize: 12.5,
    color: colors.textMuted,
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
  mapCard: { paddingVertical: space.md },
  map: {
    height: 10,
    borderRadius: 5,
    overflow: 'hidden',
    backgroundColor: colors.ink,
  },
  mapFill: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: 0,
    right: 0,
    opacity: 0.85,
  },
  mapGap: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    backgroundColor: colors.ink,
  },
  mapEnds: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 6,
  },
  mapEnd: {
    fontFamily: fonts.sans,
    fontSize: 11.5,
    color: colors.textMuted,
    fontVariant: ['tabular-nums'],
  },
  mapNote: {
    fontFamily: fonts.sans,
    fontSize: 12.5,
    lineHeight: 18,
    color: colors.textMuted,
    marginTop: space.sm,
  },
  none: {
    fontFamily: fonts.sans,
    fontSize: 14,
    color: colors.textMuted,
    paddingVertical: 13,
  },
  problem: { flexDirection: 'row', paddingVertical: 11 },
  problemTime: {
    fontFamily: fonts.sansMedium,
    fontSize: 13,
    color: colors.goldDim,
    width: 52,
    fontVariant: ['tabular-nums'],
  },
  problemText: {
    flex: 1,
    fontFamily: fonts.sans,
    fontSize: 13.5,
    lineHeight: 19,
    color: colors.text,
  },
  quiet: {
    fontFamily: fonts.sans,
    fontSize: 12.5,
    color: colors.textMuted,
    marginTop: space.sm,
    textAlign: 'center',
  },
}));
