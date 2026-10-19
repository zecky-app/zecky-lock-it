import React, { useState } from 'react';
import { ScrollView, Text, View } from 'react-native';
import { PhraseCheck } from '../components/PhraseCheck';
import { PhraseConfirmed } from '../components/PhraseConfirmed';
import { fonts, makeStyles, space } from '../theme';

interface Props {
  mnemonic: string;
  onPassed: () => void;
  onBack: () => void;
  onLater: () => void;
  busy: boolean;
}

export function ConfirmPhraseScreen(props: Props) {
  const styles = useStyles();
  const [passed, setPassed] = useState(false);
  if (passed) {
    return (
      <View style={styles.container}>
        <ScrollView contentContainerStyle={styles.scroll}>
          <PhraseConfirmed onDone={props.onPassed} busy={props.busy} />
        </ScrollView>
      </View>
    );
  }
  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <Text style={styles.title}>Check your paper</Text>
        <Text style={styles.body}>
          Pick three of your words, so you know the paper is right before any
          funds arrive.
        </Text>
        <PhraseCheck
          mnemonic={props.mnemonic}
          onPassed={() => setPassed(true)}
          onShowPhrase={props.onBack}
          onLater={props.onLater}
          busy={props.busy}
        />
      </ScrollView>
    </View>
  );
}

const useStyles = makeStyles(colors => ({
  container: { flex: 1, padding: space.lg },
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
}));
