import React from 'react';
import { Text } from 'react-native';
import renderer, { act } from 'react-test-renderer';
import { Button } from '../src/components/Button';
import { PinPad } from '../src/components/PinPad';
import { TransactionRow } from '../src/components/TransactionRow';
import {
  darkPalette,
  lightPalette,
  makeStyles,
  setThemeMode,
} from '../src/theme';

const useStyles = makeStyles(colors => ({ label: { color: colors.text } }));
function Probe() {
  const styles = useStyles();
  return <Text style={styles.label}>x</Text>;
}

test('styles follow the chosen theme', async () => {
  let tree!: renderer.ReactTestRenderer;
  await act(async () => {
    tree = renderer.create(<Probe />);
  });
  const color = () =>
    (tree.root.findByType(Text).props.style as { color: string }).color;
  expect(color()).toBe(darkPalette.text);
  await act(async () => setThemeMode('light'));
  expect(color()).toBe(lightPalette.text);
  await act(async () => setThemeMode('dark'));
  expect(color()).toBe(darkPalette.text);
});

test('themed components render', async () => {
  await act(async () => {
    renderer.create(
      <>
        <Button label="Send" onPress={() => {}} />
        <Button label="Back" variant="quiet" busy onPress={() => {}} />
        <PinPad title="Code" onComplete={() => {}} />
        <TransactionRow
          unit="ZEC"
          hidden={false}
          onPress={() => {}}
          tx={{
            rawTransactionId: 'a',
            blockTimeInSeconds: 1700000000,
            minedHeight: 10,
            value: '100000',
            isShielding: false,
            isExpired: false,
            memos: ['hello'],
          }}
        />
      </>,
    );
  });
});
