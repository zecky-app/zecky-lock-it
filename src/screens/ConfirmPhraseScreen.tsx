import React, { useState } from 'react';
import { ScrollView, View } from 'react-native';
import { PhraseCheck } from '../components/PhraseCheck';
import { PhraseConfirmed } from '../components/PhraseConfirmed';
import { SheetCorner, SheetHeader } from '../components/lock';
import { makeStyles, space } from '../theme';

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
      <SheetCorner />
      <ScrollView contentContainerStyle={styles.scroll}>
        <SheetHeader
          title="Check your paper"
          subtitle="Pick three of your words, so you know the paper is right before any Zcash arrives."
        />
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

const useStyles = makeStyles(() => ({
  container: { flex: 1, padding: space.lg, overflow: 'hidden' },
  scroll: { paddingBottom: space.lg, paddingTop: space.sm },
}));
