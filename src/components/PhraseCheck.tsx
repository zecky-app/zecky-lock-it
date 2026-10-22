import React, { useMemo, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { allCorrect, makeQuestions } from '../lib/phraseCheck';
import { fonts, makeStyles, space } from '../theme';
import { Button } from './Button';

interface Props {
  mnemonic: string;
  onPassed: () => void;
  /** Back to the words, to compare them with the paper. */
  onShowPhrase: () => void;
  /** Leave the check for another day. Hidden when not given. */
  onLater?: () => void;
  busy?: boolean;
}

/** Asks for three words of the recovery phrase, each from four choices. */
export function PhraseCheck({
  mnemonic,
  onPassed,
  onShowPhrase,
  onLater,
  busy = false,
}: Props) {
  const styles = useStyles();
  const questions = useMemo(() => makeQuestions(mnemonic), [mnemonic]);
  const [picked, setPicked] = useState<(string | null)[]>([null, null, null]);
  const [wrong, setWrong] = useState(false);
  const complete = picked.every(word => word != null);

  return (
    <View>
      {questions.map((question, q) => (
        <View key={question.position} style={styles.question}>
          <Text style={styles.label}>Word {question.position}</Text>
          <View style={styles.choices}>
            {question.choices.map(word => {
              const selected = picked[q] === word;
              return (
                <Pressable
                  key={word}
                  accessibilityRole="button"
                  accessibilityState={{ selected }}
                  onPress={() => {
                    setWrong(false);
                    setPicked(prev => prev.map((p, i) => (i === q ? word : p)));
                  }}
                  style={[styles.choice, selected && styles.choiceOn]}
                >
                  <Text
                    style={[styles.choiceText, selected && styles.choiceTextOn]}
                  >
                    {word}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>
      ))}
      {wrong && (
        <Text style={styles.wrong}>
          That does not match. Check your paper against the words and try again.
        </Text>
      )}
      <View style={styles.actions}>
        <Button
          label="Confirm"
          disabled={!complete}
          busy={busy}
          onPress={() => {
            if (allCorrect(questions, picked)) onPassed();
            else setWrong(true);
          }}
        />
        <Button
          label="Show the words again"
          variant="quiet"
          onPress={onShowPhrase}
        />
        {onLater != null && (
          <Button label="Later" variant="back" onPress={onLater} />
        )}
      </View>
    </View>
  );
}

const useStyles = makeStyles(colors => ({
  question: { marginBottom: space.lg },
  label: {
    fontFamily: fonts.sans,
    fontSize: 13,
    color: colors.textMuted,
    marginBottom: space.sm,
  },
  choices: { flexDirection: 'row', flexWrap: 'wrap', marginHorizontal: -4 },
  choice: {
    width: '47%',
    margin: 4,
    paddingVertical: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.inkRaised,
    alignItems: 'center',
  },
  choiceOn: { borderColor: colors.gold },
  choiceText: { fontFamily: fonts.sans, fontSize: 16, color: colors.text },
  choiceTextOn: { color: colors.gold },
  wrong: {
    fontFamily: fonts.sans,
    fontSize: 14,
    lineHeight: 21,
    color: colors.danger,
    marginBottom: space.md,
  },
  actions: { gap: space.sm },
}));
