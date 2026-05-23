import { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  Image,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useTheme } from '../../src/theme/themeContext';
import {
  signInWithEmail,
  signInWithGoogle,
  signInWithApple,
  isAppleSignInAvailable,
  AuthServiceError,
} from '../../src/services/authService';

export default function LoginScreen() {
  const { colors } = useTheme();
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [appleAvailable, setAppleAvailable] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    isAppleSignInAvailable().then(setAppleAvailable);
  }, []);

  async function handleEmailLogin() {
    if (!email.trim() || !password) {
      setError('Veuillez renseigner votre email et mot de passe.');
      return;
    }
    setError('');
    setLoading(true);
    try {
      await signInWithEmail(email.trim(), password);
      router.replace('/');
    } catch (e) {
      if (e instanceof AuthServiceError) {
        setError(e.message);
      } else {
        setError('Une erreur est survenue.');
      }
    } finally {
      setLoading(false);
    }
  }

  async function handleGoogleLogin() {
    setError('');
    setLoading(true);
    try {
      await signInWithGoogle();
      router.replace('/');
    } catch (e) {
      if (e instanceof AuthServiceError && e.code !== 'cancelled') {
        setError(e.message);
      }
    } finally {
      setLoading(false);
    }
  }

  async function handleAppleLogin() {
    setError('');
    setLoading(true);
    try {
      await signInWithApple();
      router.replace('/');
    } catch (e) {
      if (e instanceof AuthServiceError && e.code !== 'cancelled') {
        setError(e.message);
      }
    } finally {
      setLoading(false);
    }
  }

  const s = styles(colors);

  return (
    <KeyboardAvoidingView
      style={s.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <View style={s.content}>
        <Image
          source={require('../../assets/logo_numelineFR.png')}
          style={s.logo}
          resizeMode="contain"
        />
        <Text style={s.title}>Connexion</Text>
        <Text style={s.subtitle}>
          Connectez-vous pour retrouver votre abonnement sur tous vos appareils.
        </Text>

        {/* Email / Password */}
        <View style={s.inputGroup}>
          <TextInput
            value={email}
            onChangeText={setEmail}
            placeholder="Email"
            placeholderTextColor={colors.textSecondary}
            style={s.input}
            autoCapitalize="none"
            keyboardType="email-address"
            returnKeyType="next"
          />
          <TextInput
            value={password}
            onChangeText={setPassword}
            placeholder="Mot de passe"
            placeholderTextColor={colors.textSecondary}
            style={s.input}
            secureTextEntry
            returnKeyType="done"
            onSubmitEditing={handleEmailLogin}
          />
          {error ? <Text style={s.error}>{error}</Text> : null}

          <TouchableOpacity onPress={() => router.push('/auth/forgot-password')}>
            <Text style={s.link}>Mot de passe oublié ?</Text>
          </TouchableOpacity>
        </View>

        <TouchableOpacity style={s.primaryButton} onPress={handleEmailLogin} disabled={loading}>
          {loading ? (
            <ActivityIndicator color={colors.surface} />
          ) : (
            <Text style={s.primaryButtonText}>Se connecter</Text>
          )}
        </TouchableOpacity>

        <View style={s.divider}>
          <View style={s.dividerLine} />
          <Text style={s.dividerText}>ou</Text>
          <View style={s.dividerLine} />
        </View>

        {/* Google */}
        <TouchableOpacity style={s.socialButton} onPress={handleGoogleLogin} disabled={loading}>
          <Text style={s.socialButtonText}>Continuer avec Google</Text>
        </TouchableOpacity>

        {/* Apple — iOS uniquement */}
        {appleAvailable && (
          <TouchableOpacity style={[s.socialButton, s.appleButton]} onPress={handleAppleLogin} disabled={loading}>
            <Text style={[s.socialButtonText, { color: '#fff' }]}>Continuer avec Apple</Text>
          </TouchableOpacity>
        )}

        <TouchableOpacity onPress={() => router.push('/auth/signup')}>
          <Text style={s.link}>Pas encore de compte ? <Text style={{ fontWeight: '700' }}>Créer un compte</Text></Text>
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = (colors: ReturnType<typeof import('../../src/theme/themeContext').useTheme>['colors']) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
      padding: 24,
    },
    content: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      gap: 16,
    },
    logo: {
      width: 80,
      height: 80,
      borderRadius: 20,
    },
    title: {
      fontSize: 24,
      fontWeight: '800',
      color: colors.textPrimary,
    },
    subtitle: {
      fontSize: 14,
      lineHeight: 20,
      textAlign: 'center',
      color: colors.textSecondary,
    },
    inputGroup: {
      width: '100%',
      gap: 10,
    },
    input: {
      width: '100%',
      borderRadius: 14,
      borderWidth: 1,
      borderColor: colors.border,
      paddingHorizontal: 14,
      paddingVertical: 12,
      fontSize: 16,
      color: colors.textPrimary,
      backgroundColor: colors.surface,
    },
    error: {
      fontSize: 13,
      color: colors.danger,
    },
    link: {
      fontSize: 14,
      color: colors.accent,
      textAlign: 'center',
    },
    primaryButton: {
      width: '100%',
      borderRadius: 16,
      paddingVertical: 14,
      alignItems: 'center',
      backgroundColor: colors.accent,
    },
    primaryButtonText: {
      fontSize: 16,
      fontWeight: '700',
      color: colors.surface,
    },
    divider: {
      flexDirection: 'row',
      alignItems: 'center',
      width: '100%',
      gap: 10,
    },
    dividerLine: {
      flex: 1,
      height: 1,
      backgroundColor: colors.border,
    },
    dividerText: {
      fontSize: 13,
      color: colors.textSecondary,
    },
    socialButton: {
      width: '100%',
      borderRadius: 16,
      paddingVertical: 14,
      alignItems: 'center',
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surface,
    },
    appleButton: {
      backgroundColor: '#000',
      borderColor: '#000',
    },
    socialButtonText: {
      fontSize: 16,
      fontWeight: '600',
      color: colors.textPrimary,
    },
  });
