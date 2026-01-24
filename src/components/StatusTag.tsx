import { LinearGradient } from 'expo-linear-gradient';
import { StyleSheet, Text, View, ViewStyle } from 'react-native';
import { RecallStatus } from '../types';

type StatusTagProps = {
  status: RecallStatus;
  label: string;
};

const gradients: Record<RecallStatus, [string, string]> = {
  safe: ['#5CFFD2', '#0BAE86'],
  recalled: ['#FFA0B2', '#E14261'],
  warning: ['#FFD989', '#E5A200'],
  unknown: ['#B5C7C4', '#546866']
};

const shadows: Record<RecallStatus, ViewStyle> = {
  safe: {
    shadowColor: '#0BAE86',
    shadowOpacity: 0.4,
    shadowOffset: { width: 0, height: 4 },
    shadowRadius: 12,
    elevation: 10
  },
  recalled: {
    shadowColor: '#C62842',
    shadowOpacity: 0.45,
    shadowOffset: { width: 0, height: 4 },
    shadowRadius: 12,
    elevation: 10
  },
  warning: {
    shadowColor: '#C88A16',
    shadowOpacity: 0.35,
    shadowOffset: { width: 0, height: 4 },
    shadowRadius: 10,
    elevation: 8
  },
  unknown: {
    shadowColor: '#243533',
    shadowOpacity: 0.25,
    shadowOffset: { width: 0, height: 3 },
    shadowRadius: 8,
    elevation: 6
  }
};

export function StatusTag({ status, label }: StatusTagProps) {
  const gradient = gradients[status] ?? gradients.unknown;
  const shadow = shadows[status] ?? shadows.unknown;

  return (
    <LinearGradient
      colors={gradient}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={[styles.tag, shadow]}
    >
      <View style={styles.shine} pointerEvents="none" />
      <View style={styles.bottomGlow} pointerEvents="none" />
      <Text style={styles.text}>{label}</Text>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  tag: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.4)',
    overflow: 'hidden',
    minWidth: 100,
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'flex-start'
  },
  text: {
    fontSize: 11,
    fontWeight: '900',
    color: '#0C1413',
    textTransform: 'uppercase',
    letterSpacing: 0.6
  },
  shine: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: '50%',
    backgroundColor: 'rgba(255,255,255,0.35)',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20
  },
  bottomGlow: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: 12,
    backgroundColor: 'rgba(0,0,0,0.08)',
    borderBottomLeftRadius: 20,
    borderBottomRightRadius: 20
  }
});
