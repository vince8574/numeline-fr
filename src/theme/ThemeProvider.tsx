import { PropsWithChildren, useMemo } from 'react';
import { ColorSchemeName, useColorScheme } from 'react-native';
import { ThemeContext, ThemeType, useTheme } from './themeContext';
import { highContrastDarkPalette, highContrastLightPalette, lightPalette, palette } from './colors';
import { usePreferencesStore } from '../stores/usePreferencesStore';

const baseTypography = { title: 28, headline: 22, body: 16, label: 13 };
const accessibleTypography = { title: 36, headline: 29, body: 21, label: 17 };

function getTheme(scheme: ColorSchemeName, accessible: boolean): ThemeType {
  const isLight = scheme === 'light';
  const typography = accessible ? accessibleTypography : baseTypography;

  if (accessible) {
    return {
      mode: isLight ? 'light' : 'dark',
      accessible: true,
      colors: isLight ? highContrastLightPalette : highContrastDarkPalette,
      typography
    };
  }

  return {
    mode: isLight ? 'light' : 'dark',
    accessible: false,
    colors: isLight ? lightPalette : palette,
    typography
  };
}

export function ThemeProvider({ children }: PropsWithChildren) {
  const scheme = useColorScheme();
  const accessibilityMode = usePreferencesStore((s) => s.accessibilityMode);
  const theme = useMemo(() => getTheme(scheme, accessibilityMode), [scheme, accessibilityMode]);

  return <ThemeContext.Provider value={theme}>{children}</ThemeContext.Provider>;
}

export { useTheme };
