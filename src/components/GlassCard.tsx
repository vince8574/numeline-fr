import { ReactNode } from 'react';
import { StyleSheet, View, ViewStyle } from 'react-native';
import { BlurView } from 'expo-blur';
import { useTheme } from '../theme/themeContext';

type GlassCardProps = {
  children: ReactNode;
  style?: ViewStyle;
  intensity?: number;
  variant?: 'primary' | 'secondary';
};

export function GlassCard({ children, style, intensity = 20, variant = 'primary' }: GlassCardProps) {
  const { colors } = useTheme();

  return (
    <View style={[styles.container, style]}>
      <BlurView
        intensity={intensity}
        tint="dark"
        style={[
          styles.blur,
          {
            backgroundColor: variant === 'primary' ? colors.glass : colors.glassAlt,
            borderColor: colors.border
          }
        ]}
      >
        {children}
      </BlurView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    borderRadius: 24,
    overflow: 'hidden'
  },
  blur: {
    borderRadius: 24,
    borderWidth: 1,
    overflow: 'hidden'
  }
});
