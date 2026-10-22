import React, { useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Button } from '../components/Button';
import { SheetCorner, SheetHeader } from '../components/lock';
import { Tools } from 'react-native-zcash';
import { EARLIEST_BIRTHDAY_HEIGHT } from '../config';
import { estimateBirthdayHeight, estimateTipHeight } from '../lib/birthday';
import { getServer } from '../lib/server';
import { fonts, makeStyles, space, useColors } from '../theme';
import {
  isValidMnemonic,
  normalizeMnemonic,
  StoredWallet,
} from '../wallet/seed';

interface Props {
  onRestore: (wallet: StoredWallet) => void;
  onBack: () => void;
  busy: boolean;
}

const FIRST_YEAR = 2018;
const MONTHS = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec',
];

function Chip(props: { label: string; on: boolean; onPress: () => void }) {
  const styles = useStyles();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected: props.on }}
      onPress={props.onPress}
      style={[styles.chip, props.on && styles.chipOn]}
    >
      <Text style={[styles.chipLabel, props.on && styles.chipLabelOn]}>
        {props.label}
      </Text>
    </Pressable>
  );
}

export function RestoreScreen({ onRestore, onBack, busy }: Props) {
  const colors = useColors();
  const styles = useStyles();
  const [phrase, setPhrase] = useState('');
  const [birthday, setBirthday] = useState('');
  const [error, setError] = useState<string | null>(null);

  const wordCount =
    phrase.trim() === '' ? 0 : phrase.trim().split(/\s+/).length;

  // When the wallet was first created: a month, an exact block, or unknown.
  const [year, setYear] = useState<number | null>(null);
  const [month, setMonth] = useState<number | null>(null);
  const [useBlock, setUseBlock] = useState(false);
  const [working, setWorking] = useState(false);
  const thisYear = new Date().getFullYear();
  const years = Array.from(
    { length: thisYear - FIRST_YEAR + 1 },
    (_, i) => FIRST_YEAR + i,
  );

  const submit = async () => {
    if (!isValidMnemonic(phrase)) {
      setError(
        'That recovery phrase is not valid. Check the spelling and the order of the words.',
      );
      return;
    }
    let birthdayHeight = EARLIEST_BIRTHDAY_HEIGHT;
    if (useBlock && birthday.trim() !== '') {
      // Accept the number as Zecky shows it (3,533,600) or as written on
      // paper with dots or spaces.
      const parsed = Number(birthday.replace(/[\s,.'’]/g, ''));
      if (!Number.isInteger(parsed) || parsed < EARLIEST_BIRTHDAY_HEIGHT) {
        setError(
          `The block height must be a whole number of ${EARLIEST_BIRTHDAY_HEIGHT} or higher. Leave it empty if you are unsure.`,
        );
        return;
      }
      birthdayHeight = parsed;
    } else if (!useBlock && year != null) {
      setWorking(true);
      const now = Date.now();
      let tip = estimateTipHeight(now);
      try {
        // The real chain height makes the estimate more accurate.
        const server = getServer();
        tip = await Tools.getBirthdayHeight(server.host, server.port);
      } catch {
        // Offline: the calculated height is close enough to start from.
      }
      birthdayHeight = estimateBirthdayHeight(year, month ?? 0, tip, now);
      setWorking(false);
    }
    setError(null);
    onRestore({ mnemonic: normalizeMnemonic(phrase), birthdayHeight });
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <SheetCorner />
      <ScrollView
        contentContainerStyle={styles.scroll}
        keyboardShouldPersistTaps="handled"
      >
        <SheetHeader
          title="Restore your wallet"
          subtitle="Enter your 24 words, with a space between each word."
        />

        <TextInput
          style={[styles.input, styles.phrase]}
          value={phrase}
          onChangeText={setPhrase}
          multiline
          autoCapitalize="none"
          autoCorrect={false}
          spellCheck={false}
          autoComplete="off"
          keyboardType={
            Platform.OS === 'android' ? 'visible-password' : 'default'
          }
          placeholder="word one, word two…"
          placeholderTextColor={colors.goldDim}
          selectionColor={colors.gold}
        />
        <Text style={styles.hint}>{wordCount} words</Text>

        <Text style={styles.label}>When was this wallet created?</Text>
        {useBlock ? (
          <>
            <TextInput
              style={styles.input}
              value={birthday}
              onChangeText={setBirthday}
              keyboardType="number-pad"
              placeholder="Block height"
              placeholderTextColor={colors.goldDim}
              selectionColor={colors.gold}
            />
            <Text style={styles.hint}>
              The wallet birthday block, as written under your words or shown in
              Settings, About.
            </Text>
          </>
        ) : (
          <>
            <View style={styles.chips}>
              {years.map(y => (
                <Chip
                  key={y}
                  label={String(y)}
                  on={y === year}
                  onPress={() => setYear(y === year ? null : y)}
                />
              ))}
            </View>
            {year != null && (
              <View style={styles.chips}>
                {MONTHS.map((name, i) => (
                  <Chip
                    key={name}
                    label={name}
                    on={i === month}
                    onPress={() => setMonth(i === month ? null : i)}
                  />
                ))}
              </View>
            )}
            <Text style={styles.hint}>
              {year == null
                ? 'Pick the year, and the month if you know it. It makes syncing much faster. If you are not sure, leave it open: Zecky then checks the whole history, which can take hours.'
                : 'If in doubt, pick an earlier date. Starting too late would miss older payments.'}
            </Text>
          </>
        )}
        <Pressable
          accessibilityRole="button"
          hitSlop={10}
          onPress={() => setUseBlock(!useBlock)}
          style={styles.switchLink}
        >
          <Text style={styles.switchLabel}>
            {useBlock ? 'Pick a date instead' : 'Enter a block height instead'}
          </Text>
        </Pressable>

        {error != null && <Text style={styles.error}>{error}</Text>}
      </ScrollView>
      <Button label="Restore wallet" onPress={submit} busy={busy || working} />
      <View style={styles.gap} />
      <Button label="Back" onPress={onBack} variant="back" disabled={busy} />
    </KeyboardAvoidingView>
  );
}

const useStyles = makeStyles(colors => ({
  container: { flex: 1, padding: space.lg, overflow: 'hidden' },
  scroll: { paddingBottom: space.lg },
  title: { fontFamily: fonts.serifMedium, fontSize: 30, color: colors.text },
  body: {
    fontFamily: fonts.sans,
    fontSize: 15,
    lineHeight: 23,
    color: colors.textMuted,
    marginTop: space.sm,
    marginBottom: space.lg,
  },
  label: {
    fontFamily: fonts.sansMedium,
    fontSize: 14,
    color: colors.text,
    marginTop: space.lg,
    marginBottom: space.sm,
  },
  input: {
    backgroundColor: colors.inkRaised,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.line,
    padding: space.md,
    fontFamily: fonts.sans,
    fontSize: 16,
    color: colors.text,
  },
  phrase: { minHeight: 130, textAlignVertical: 'top', lineHeight: 24 },
  hint: {
    fontFamily: fonts.sans,
    fontSize: 13,
    lineHeight: 19,
    color: colors.textMuted,
    marginTop: space.sm,
  },
  error: {
    fontFamily: fonts.sans,
    fontSize: 14,
    lineHeight: 20,
    color: colors.danger,
    marginTop: space.lg,
  },
  gap: { height: space.sm },
  chips: { flexDirection: 'row', flexWrap: 'wrap', marginBottom: space.xs },
  chip: {
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.line,
    paddingVertical: 8,
    paddingHorizontal: 12,
    marginRight: space.sm,
    marginBottom: space.sm,
  },
  chipOn: { backgroundColor: colors.gold, borderColor: colors.gold },
  chipLabel: {
    fontFamily: fonts.sansMedium,
    fontSize: 14,
    color: colors.textMuted,
  },
  chipLabelOn: { color: colors.onGold },
  switchLink: { alignSelf: 'flex-start', marginTop: space.md },
  switchLabel: {
    fontFamily: fonts.sansMedium,
    fontSize: 14,
    color: colors.gold,
  },
}));
