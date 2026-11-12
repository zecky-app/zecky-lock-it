import React from 'react';
import { Linking, Pressable, ScrollView, Text, View } from 'react-native';
import { Button } from '../components/Button';
import { PRIVACY_URL, TERMS_URL } from '../config';
import { acceptTerms } from '../lib/terms';
import { fonts, makeStyles, space } from '../theme';

// "Before you start": once, before creating or restoring a wallet, and
// again only when the terms version changes (src/lib/terms.ts). One quiet
// screen; it only scrolls when the text does not fit (small phones, large
// text sizes).

const POINTS = [
  'Your 24 words are your wallet. Nobody can recover them, not even Zecky.',
  'Payments are final. Check before you send.',
  'Zecky is in testing. Use amounts you can afford to lose.',
  'Zecky never holds your keys or your money.',
];

function Link({ label, url }: { label: string; url: string }) {
  const styles = useStyles();
  return (
    <Pressable
      accessibilityRole="link"
      accessibilityHint="Opens in Safari"
      hitSlop={10}
      onPress={() => Linking.openURL(url).catch(() => {})}
    >
      <Text style={styles.link}>{label} ›</Text>
    </Pressable>
  );
}

export function TermsScreen() {
  const styles = useStyles();
  return (
    <View style={styles.container} accessibilityViewIsModal>
      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
        bounces={false}
      >
        <View style={styles.body}>
          <Text style={styles.label}>ZECKY</Text>
          <Text style={styles.title} accessibilityRole="header">
            Before you start
          </Text>
          <View style={styles.points}>
            {POINTS.map(point => (
              <View key={point} style={styles.point}>
                <View style={styles.dot} />
                <Text style={styles.pointText}>{point}</Text>
              </View>
            ))}
          </View>
          <View style={styles.links}>
            <Link label="Read the terms" url={TERMS_URL} />
            <Link label="Privacy" url={PRIVACY_URL} />
          </View>
        </View>
        <Button label="I understand" onPress={() => acceptTerms()} />
      </ScrollView>
    </View>
  );
}

const useStyles = makeStyles(colors => ({
  container: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: colors.ink,
  },
  scroll: {
    flexGrow: 1,
    justifyContent: 'space-between',
    padding: space.lg,
  },
  body: { flex: 1, justifyContent: 'center', paddingVertical: space.lg },
  label: {
    fontFamily: fonts.sansSemiBold,
    fontSize: 11,
    letterSpacing: 4,
    color: colors.gold,
  },
  title: {
    fontFamily: fonts.serifMedium,
    fontSize: 32,
    color: colors.text,
    marginTop: space.sm,
    marginBottom: space.lg,
  },
  points: { gap: space.md },
  point: { flexDirection: 'row', alignItems: 'flex-start' },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.gold,
    marginTop: 9,
    marginRight: space.md,
  },
  pointText: {
    flex: 1,
    fontFamily: fonts.sans,
    fontSize: 16,
    lineHeight: 24,
    color: colors.text,
  },
  links: { flexDirection: 'row', gap: space.lg, marginTop: space.xl },
  link: { fontFamily: fonts.sansMedium, fontSize: 15, color: colors.gold },
}));
