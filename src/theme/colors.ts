export const palette = {
  background: '#C4DECC',
  surface: '#102D2C',
  surfaceAlt: '#173B3A',
  accent: '#35F2A9',
  accentSoft: 'rgba(53, 242, 169, 0.2)',
  onAccent: '#102D2C',
  textPrimary: '#F7FBFA',
  // BUG-006 : contraste renforcé pour WCAG AA (précédemment #A5C9C7)
  textSecondary: '#D0E4E1',
  text: '#F7FBFA',
  danger: '#FF647C',
  warning: '#FFC857',
  success: '#10B981',
  border: '#1E4948',
  glass: 'rgba(255, 255, 255, 0.08)',
  glassAlt: 'rgba(255, 255, 255, 0.16)'
};

export const lightPalette = {
  background: '#C4DECC',
  surface: '#FFFFFF',
  surfaceAlt: '#EEF6F4',
  accent: '#0BAE86',
  accentSoft: 'rgba(11, 174, 134, 0.15)',
  // BUG-007 : #FFFFFF sur #0BAE86 = 2.7:1 (échec WCAG AA). #102D2C donne 4.7:1.
  onAccent: '#102D2C',
  textPrimary: '#1A2D2B',
  // BUG-006 : contraste renforcé pour WCAG AA (précédemment #476562)
  textSecondary: '#32504D',
  text: '#1A2D2B',
  danger: '#D84961',
  warning: '#E5A700',
  success: '#059669',
  border: '#D1E3E0',
  glass: 'rgba(16, 45, 44, 0.08)',
  glassAlt: 'rgba(16, 45, 44, 0.16)'
};

// Mode malvoyant — contraste WCAG AAA (ratio >= 7:1)
export const highContrastDarkPalette = {
  background: '#000000',
  surface: '#0A0A0A',
  surfaceAlt: '#1A1A1A',
  accent: '#FFE600',
  accentSoft: 'rgba(255, 230, 0, 0.25)',
  onAccent: '#000000',
  textPrimary: '#FFFFFF',
  textSecondary: '#F5F5F5',
  text: '#FFFFFF',
  danger: '#FF3B30',
  warning: '#FFCC00',
  success: '#30D158',
  border: '#FFFFFF',
  glass: 'rgba(255, 255, 255, 0.18)',
  glassAlt: 'rgba(255, 255, 255, 0.28)'
};

export const highContrastLightPalette = {
  background: '#FFFFFF',
  surface: '#FFFFFF',
  surfaceAlt: '#F0F0F0',
  accent: '#0040A0',
  accentSoft: 'rgba(0, 64, 160, 0.15)',
  onAccent: '#FFFFFF',
  textPrimary: '#000000',
  textSecondary: '#1A1A1A',
  text: '#000000',
  danger: '#A50000',
  warning: '#A56400',
  success: '#005C2C',
  border: '#000000',
  glass: 'rgba(0, 0, 0, 0.12)',
  glassAlt: 'rgba(0, 0, 0, 0.22)'
};
