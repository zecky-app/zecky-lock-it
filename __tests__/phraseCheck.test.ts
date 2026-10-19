jest.mock('react-native-keychain', () => ({}));

import { allCorrect, makeQuestions } from '../src/lib/phraseCheck';
import { generateMnemonic } from '@scure/bip39';
import { wordlist } from '@scure/bip39/wordlists/english.js';

test('asks three different words with the answer among four choices', () => {
  const mnemonic = generateMnemonic(wordlist, 256);
  const words = mnemonic.split(' ');
  for (let run = 0; run < 50; run++) {
    const questions = makeQuestions(mnemonic);
    expect(questions).toHaveLength(3);
    expect(new Set(questions.map(q => q.position)).size).toBe(3);
    for (const q of questions) {
      expect(words[q.position - 1]).toBe(q.answer);
      expect(new Set(q.choices).size).toBe(4);
      expect(q.choices).toContain(q.answer);
      // Wrong choices never appear in the phrase itself.
      expect(q.choices.filter(c => words.includes(c))).toEqual([q.answer]);
    }
    expect(
      allCorrect(
        questions,
        questions.map(q => q.answer),
      ),
    ).toBe(true);
    const wrongPick = questions[0].choices.find(c => c !== questions[0].answer);
    expect(
      allCorrect(questions, [
        wrongPick ?? null,
        questions[1].answer,
        questions[2].answer,
      ]),
    ).toBe(false);
    expect(allCorrect(questions, [null, null, null])).toBe(false);
  }
});
