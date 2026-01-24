import { createContext, useContext } from 'react';

type Palette = {
  background: string;
  surface: string;
  surfaceAlt: string;
  accent: string;
  accentSoft: string;
  textPrimary: string;
  textSecondary: string;
  danger: string;
  warning: string;
  success: string;
  border: string;
};

type Typography = {
  title: number;
  headline: number;
  body: number;
  label: number;
};

export type ThemeType = {
  mode: 'light' | 'dark';
  colors: Palette;
  typography: Typography;
};

const defaultTheme: ThemeType = {
  mode: 'dark',
  colors: {
    background: '#C4DECC',
    surface: '#102D2C',
    surfaceAlt: '#173B3A',
    accent: '#35F2A9',
    accentSoft: 'rgba(53, 242, 169, 0.2)',
    textPrimary: '#F7FBFA',
    textSecondary: '#A5C9C7',
    danger: '#FF647C',
    warning: '#FFC857',
    success: '#10B981',
    border: '#1E4948'
  },
  typography: {
    title: 28,
    headline: 22,
    body: 16,
    label: 13
  }
};

export const ThemeContext = createContext<ThemeType>(defaultTheme);

export function useTheme() {
  return useContext(ThemeContext);
}
