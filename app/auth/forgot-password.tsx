import { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useTheme } from '../../src/theme/themeContext';
import { sendPasswordResetEmail, AuthServiceError } from '../../src/services/authService';

export default function ForgotPasswordScreen() {
  const { colors } = useTheme();
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [sent, setSent] = useState(false);

  async function handleReset() {
    if (!email.trim()) {
      setError('Veuillez renseigner votre email.');
      return;
    }
    setError('');
    setLoading(true);
    try {
      await sendPasswordResetEmail(email.trim());
      setSent(true);
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

  const s = styles(colors);

  if (sent) {
    return (
      <View style={[s.container, { justifyContent: 'center', alignItems: 'center', gap: 20 }]}>
        <Text style={s.title}>Email envoyé</Text>
        <Text style={[s.subtitle, { textAlign: 'center' }]}>
          Si un compte existe pour {email.trim()}, vous recevrez un email pour réinitialiser votre mot de passe.
        </Text>
        <TouchableOpacity style={s.primaryButton} onPress={() => router.replace('/auth/login')}>
          <Text style={s.primaryButtonText}>Retour à la connexion</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={s.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <View style={s.content}>
        <Text style={s.title}>Mot de passe oublié</Text>
        <Text style={s.subtitle}>
          Renseignez votre email et nous vous enverrons un lien pour réinitialiser votre mot de passe.
        </Text>

        <View style={s.inputGroup}>
          <TextInput
            value={email}
            onChangeText={setEmail}
            placeholder="Email"
            placeholderTextColor={colors.textSecondary}
            style={s.input}
            autoCapitalize="none"
            keyboardType="email-address"
            returnKeyType="done"
            onSubmitEditing={handleReset}
          />
          {error ? <Text style={s.error}>{error}</Text> : null}
        </View>

        <TouchableOpacity style={s.primaryButton} onPress={handleReset} disabled={loading}>
          {loading ? (
            <ActivityIndicator color={colors.surface} />
          ) : (
            <Text style={s.primaryButtonText}>Envoyer le lien</Text>
          )}
        </TouchableOpacity>

        <TouchableOpacity onPress={() => router.back()}>
          <Text style={s.link}>Retour</Text>
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
    title: {
      fontSize: 24,
      fontWeight: '800',
      color: colors.textPrimary,
    },
    subtitle: {
      fontSize: 14,
      lineHeight: 20,
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
  });
