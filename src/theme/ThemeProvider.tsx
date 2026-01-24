import { PropsWithChildren, useMemo } from 'react';
import { ColorSchemeName, useColorScheme } from 'react-native';
import { ThemeContext, ThemeType } from './themeContext';
import { lightPalette, palette } from './colors';

function getTheme(scheme: ColorSchemeName): ThemeType {
  if (scheme === 'light') {
    return {
      mode: 'light',
      colors: lightPalette,
      typography: {
        title: 28,
        headline: 22,
        body: 16,
        label: 13
      }
    };
  }

  return {
    mode: 'dark',
    colors: palette,
    typography: {
      title: 28,
      headline: 22,
      body: 16,
      label: 13
    }
  };
}

export function ThemeProvider({ children }: PropsWithChildren) {
  const scheme = useColorScheme();
  const theme = useMemo(() => getTheme(scheme), [scheme]);

  return <ThemeContext.Provider value={theme}>{children}</ThemeContext.Provider>;
}
