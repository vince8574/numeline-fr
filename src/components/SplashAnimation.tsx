import React, { useEffect } from 'react';
import { View, StyleSheet, Dimensions, Image } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withSequence,
  withDelay,
  Easing,
  runOnJS,
} from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';

const { width, height } = Dimensions.get('window');
const LOGO_SIZE = 220; // Taille finale du logo sur la page de bienvenue

interface SplashAnimationProps {
  onAnimationComplete: () => void;
}

export function SplashAnimation({ onAnimationComplete }: SplashAnimationProps) {
  // Valeurs animées
  const scale = useSharedValue(0.1);
  const translateX = useSharedValue(0);
  const translateY = useSharedValue(0);
  const opacity = useSharedValue(1);
  const glowOpacity = useSharedValue(0);

  useEffect(() => {
    // Séquence d'animation
    const startAnimation = () => {
      // 1. Apparition et grossissement (0-1.5s)
      scale.value = withTiming(3.5, {
        duration: 1500,
        easing: Easing.out(Easing.cubic),
      });

      // Effet de lumière pendant le grossissement
      glowOpacity.value = withSequence(
        withTiming(0.8, { duration: 750 }),
        withTiming(0.3, { duration: 750 })
      );

      // 2. Réduction à la taille normale (1.5-2.5s)
      scale.value = withDelay(
        1500,
        withTiming(1, {
          duration: 1000,
          easing: Easing.inOut(Easing.cubic),
        })
      );

      // 4. Déplacement vers la position finale (2.5-3.5s)
      // Position finale : en haut de l'écran (comme sur WelcomeScreen)
      const finalY = -height * 0.2; // Monte vers le haut

      translateY.value = withDelay(
        2500,
        withTiming(finalY, {
          duration: 1000,
          easing: Easing.inOut(Easing.cubic),
        })
      );

      // Diminution de l'effet lumineux
      glowOpacity.value = withDelay(
        2500,
        withTiming(0, {
          duration: 1000,
          easing: Easing.out(Easing.cubic),
        })
      );

      // 5. Fondu final et transition (3.5-4s)
      opacity.value = withDelay(
        3500,
        withTiming(0, {
          duration: 500,
          easing: Easing.out(Easing.cubic),
        }, (finished) => {
          if (finished) {
            runOnJS(onAnimationComplete)();
          }
        })
      );
    };

    startAnimation();
  }, []);

  const animatedLogoStyle = useAnimatedStyle(() => {
    return {
      transform: [
        { translateX: translateX.value },
        { translateY: translateY.value },
        { scale: scale.value },
      ],
      opacity: opacity.value,
    };
  });

  const animatedGlowStyle = useAnimatedStyle(() => {
    return {
      opacity: glowOpacity.value,
    };
  });

  return (
    <View style={styles.container}>
      {/* Gradient de fond */}
      <LinearGradient
        colors={['#C4DECC', '#0BAE86', '#0A1F1F']}
        style={StyleSheet.absoluteFillObject}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
      />

      {/* Effet de lumière (glow) */}
      <Animated.View style={[styles.glowContainer, animatedGlowStyle]}>
        <LinearGradient
          colors={['rgba(11, 174, 134, 0.6)', 'rgba(11, 174, 134, 0.3)', 'rgba(11, 174, 134, 0)']}
          style={styles.glow}
          start={{ x: 0.5, y: 0.5 }}
          end={{ x: 1, y: 1 }}
        />
      </Animated.View>

      {/* Logo animé */}
      <Animated.View style={[styles.logoContainer, animatedLogoStyle]}>
        <Image
          source={require('../../assets/pomme.png')}
          style={styles.logo}
          resizeMode="contain"
        />
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#C4DECC',
  },
  logoContainer: {
    width: LOGO_SIZE,
    height: LOGO_SIZE,
    justifyContent: 'center',
    alignItems: 'center',
  },
  logo: {
    width: '100%',
    height: '100%',
    borderRadius: 40,
  },
  glowContainer: {
    position: 'absolute',
    justifyContent: 'center',
    alignItems: 'center',
  },
  glow: {
    width: width * 1.2,
    height: width * 1.2,
    borderRadius: width * 0.6,
  },
});
