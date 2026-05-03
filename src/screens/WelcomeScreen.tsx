import { useState, useEffect, useRef, useCallback } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Image, Dimensions, AppState } from 'react-native';
import { useRouter } from 'expo-router';
import { useTheme } from '../theme/themeContext';
import { useI18n } from '../i18n/I18nContext';
import { useUserStore } from '../stores/useUserStore';
import { NamePromptModal } from '../components/NamePromptModal';
import { SplashAnimation } from '../components/SplashAnimation';
import { GradientBackground } from '../components/GradientBackground';
import { useFocusEffect } from '@react-navigation/native';

const { width } = Dimensions.get('window');

export function WelcomeScreen() {
  const { colors } = useTheme();
  const { t } = useI18n();
  const router = useRouter();
  const { firstName, setFirstName } = useUserStore();
  const [showNamePrompt, setShowNamePrompt] = useState(false);
  const [showSplash, setShowSplash] = useState(true);
  const appState = useRef(AppState.currentState);

  // Gérer le retour au premier plan de l'application
  useEffect(() => {
    const subscription = AppState.addEventListener('change', nextAppState => {
      if (
        appState.current.match(/inactive|background/) &&
        nextAppState === 'active'
      ) {
        // L'app revient au premier plan, relancer l'animation
        setShowSplash(true);
      }
      appState.current = nextAppState;
    });

    return () => {
      subscription.remove();
    };
  }, []);

  // Relancer l'animation quand l'écran reçoit le focus
  useFocusEffect(
    useCallback(() => {
      // Relancer l'animation à chaque fois que l'écran reçoit le focus
      setShowSplash(true);
    }, [])
  );

  // Gérer l'affichage du prompt de nom après l'animation
  useEffect(() => {
    if (!firstName && !showSplash) {
      const timer = setTimeout(() => {
        setShowNamePrompt(true);
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [firstName, showSplash]);

  const handleSaveName = (name: string) => {
    setFirstName(name);
    setShowNamePrompt(false);
  };

  const handleSkipName = () => {
    setShowNamePrompt(false);
  };

  const handleStartScanning = () => {
    router.push('/(tabs)/scan');
  };

  const handleGoToHome = () => {
    router.push('/(tabs)/home');
  };

  const displayName = firstName || t('common.unknown');

  // Afficher l'animation de démarrage
  if (showSplash) {
    return (
      <SplashAnimation
        onAnimationComplete={() => {
          setShowSplash(false);
        }}
      />
    );
  }

  return (
    <GradientBackground>
      <View style={styles.content}>
        {/* Logo */}
        <View style={styles.logoContainer}>
          <Image
            source={require('../../assets/pomme.png')}
            style={styles.logo}
            resizeMode="contain"
          />
        </View>

        {/* Greeting */}
        <Text style={[styles.greeting, { color: colors.textPrimary }]}>
          {t('welcomeScreen.greeting', { name: displayName })}
        </Text>

        {/* Question */}
        <Text style={[styles.question, { color: colors.textSecondary }]}>
          {t('welcomeScreen.question')}
        </Text>

        {/* Start Button */}
        <TouchableOpacity
          style={[styles.startButton, { backgroundColor: colors.accent }]}
          onPress={handleStartScanning}
          activeOpacity={0.8}
        >
          <Text style={[styles.startButtonText, { color: colors.surface }]}>
            {t('welcomeScreen.startScanning')}
          </Text>
        </TouchableOpacity>

        {/* Home Button */}
        <TouchableOpacity
          style={[styles.homeButton, { backgroundColor: colors.surface, borderColor: colors.accent }]}
          onPress={handleGoToHome}
          activeOpacity={0.8}
        >
          <Text style={[styles.homeButtonText, { color: colors.accent }]}>
            {t('navigation.home')}
          </Text>
        </TouchableOpacity>
      </View>

      {/* Name Prompt Modal */}
      <NamePromptModal
        visible={showNamePrompt}
        onSave={handleSaveName}
        onSkip={handleSkipName}
      />
    </GradientBackground>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
    paddingVertical: 60
  },
  logoContainer: {
    marginBottom: 60,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.15,
    shadowRadius: 16,
    elevation: 12
  },
  logo: {
    width: width * 0.5,
    height: width * 0.5,
    maxWidth: 220,
    maxHeight: 220,
    borderRadius: 40
  },
  greeting: {
    fontFamily: 'Lora_700Bold',
    fontSize: 38,
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: 20,
    letterSpacing: 0.5
  },
  question: {
    fontSize: 20,
    fontWeight: '600',
    textAlign: 'center',
    lineHeight: 32,
    marginBottom: 48,
    paddingHorizontal: 20
  },
  startButton: {
    paddingVertical: 18,
    paddingHorizontal: 48,
    borderRadius: 28,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.2,
    shadowRadius: 12,
    elevation: 8,
    minWidth: 260
  },
  startButtonText: {
    fontSize: 18,
    fontWeight: '800',
    textAlign: 'center',
    letterSpacing: 0.5
  },
  homeButton: {
    marginTop: 16,
    paddingVertical: 14,
    paddingHorizontal: 48,
    borderRadius: 28,
    borderWidth: 2,
    minWidth: 260
  },
  homeButtonText: {
    fontSize: 16,
    fontWeight: '700',
    textAlign: 'center',
    letterSpacing: 0.5
  }
});
