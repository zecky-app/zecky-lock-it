import { useMemo, useSyncExternalStore } from 'react';
import { Platform, Settings, StyleSheet, useColorScheme } from 'react-native';
import type { ImageStyle, TextStyle, ViewStyle } from 'react-native';

// Zecky brand tokens. Font names are the PostScript names of the files in
// assets/fonts, which is what iOS matches on.

export interface Palette {
  /** App background. */
  ink: string;
  /** Cards and input fields. */
  inkRaised: string;
  line: string;
  /** Accent: primary buttons, links, highlights. */
  gold: string;
  goldDim: string;
  /** Text and icons drawn on top of the gold accent. */
  onGold: string;
  text: string;
  textMuted: string;
  danger: string;
  ok: string;
}

export const darkPalette: Palette = {
  ink: '#14161C',
  inkRaised: '#1C1F27',
  line: '#2A2E39',
  gold: '#D4A657',
  goldDim: '#8C7340',
  onGold: '#14161C',
  text: '#F2EFE8',
  textMuted: '#9A9CA5',
  danger: '#D9705F',
  ok: '#7FB58A',
};

// Warm paper instead of plain white, with a deeper gold so it stays
// readable on a light background.
export const lightPalette: Palette = {
  ink: '#F6F2EA',
  inkRaised: '#FFFFFF',
  line: '#E0D9CB',
  gold: '#A9792B',
  goldDim: '#B9A27A',
  onGold: '#FFFFFF',
  text: '#1B1D24',
  textMuted: '#6A6D78',
  danger: '#B4472F',
  ok: '#3C7A50',
};

export const fonts = {
  serif: 'Newsreader-Regular',
  serifMedium: 'Newsreader-Medium',
  sans: 'Inter-Regular',
  sansMedium: 'Inter-Medium',
  sansSemiBold: 'Inter-SemiBold',
};

export const space = { xs: 4, sm: 8, md: 16, lg: 24, xl: 40 };

// --- Theme choice: dark, light, or follow the phone ---

export type ThemeMode = 'dark' | 'light' | 'auto';
export const THEME_MODES: readonly ThemeMode[] = ['dark', 'light', 'auto'];
const THEME_KEY = 'zecky.theme';

function loadMode(): ThemeMode {
  if (Platform.OS !== 'ios') return 'dark';
  try {
    const stored = Settings.get(THEME_KEY);
    return stored === 'light' || stored === 'auto' ? stored : 'dark';
  } catch {
    return 'dark';
  }
}

let mode: ThemeMode | null = null;
const listeners = new Set<() => void>();
const currentMode = () => (mode ??= loadMode());

export function setThemeMode(next: ThemeMode): void {
  mode = next;
  try {
    if (Platform.OS === 'ios') Settings.set({ [THEME_KEY]: next });
  } catch {
    // The choice still applies until the app is closed.
  }
  listeners.forEach(listener => listener());
}

/** Back to the default (dark), for Erase wallet. */
export function resetThemeMode(): void {
  mode = 'dark';
  try {
    if (Platform.OS === 'ios') Settings.set({ [THEME_KEY]: 'dark' });
  } catch {
    // Applies until the app is closed.
  }
  listeners.forEach(listener => listener());
}

export function useThemeMode(): ThemeMode {
  return useSyncExternalStore(listener => {
    listeners.add(listener);
    return () => listeners.delete(listener);
  }, currentMode);
}

/** True when the app is currently drawn dark. */
export function useIsDark(): boolean {
  const chosen = useThemeMode();
  const system = useColorScheme();
  return chosen === 'auto' ? system !== 'light' : chosen === 'dark';
}

/** The colors for the current theme. */
export function useColors(): Palette {
  return useIsDark() ? darkPalette : lightPalette;
}

/**
 * Like StyleSheet.create, but the styles are rebuilt for the current theme:
 *   const useStyles = makeStyles(colors => ({ title: { color: colors.text } }));
 *   const styles = useStyles();   // inside the component
 */
type NamedStyles = Record<string, ViewStyle | TextStyle | ImageStyle>;

export function makeStyles<T extends NamedStyles>(
  build: (colors: Palette) => T & NamedStyles,
): () => T {
  return function useStyles() {
    const colors = useColors();
    return useMemo(
      () => StyleSheet.create(build(colors)) as unknown as T,
      [colors],
    );
  };
}
