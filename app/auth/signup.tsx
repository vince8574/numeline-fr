import { useState } from 'react';
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
  ScrollView,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useTheme } from '../../src/theme/themeContext';
import { signUpWithEmail, AuthServiceError } from '../../src/services/authService';

export default function SignupScreen() {
  const { colors } = useTheme();
  const router = useRouter();
  const [displayName, setDisplayName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [sent, setSent] = useState(false);

  async function handleSignup() {
    if (!displayName.trim() || !email.trim() || !password) {
      setError('Tous les champs sont obligatoires.');
      return;
    }
    setError('');
    setLoading(true);
    try {
      await signUpWithEmail(email.trim(), password, displayName.trim());
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
        <Text style={s.title}>Vérifiez vos emails</Text>
        <Text style={[s.subtitle, { textAlign: 'center' }]}>
          Un email de vérification a été envoyé à {email.trim()}.{'\n'}
          Vérifiez votre boîte de réception puis connectez-vous.
        </Text>
        <TouchableOpacity style={s.primaryButton} onPress={() => router.replace('/auth/login')}>
          <Text style={s.primaryButtonText}>Se connecter</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={s.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView contentContainerStyle={s.content} keyboardShouldPersistTaps="handled">
        <Image
          source={require('../../assets/logo_numelineFR.png')}
          style={s.logo}
          resizeMode="contain"
        />
        <Text style={s.title}>Créer un compte</Text>
        <Text style={s.subtitle}>
          Créez un compte pour accéder à votre abonnement sur tous vos appareils.
        </Text>

        <View style={s.inputGroup}>
          <TextInput
            value={displayName}
            onChangeText={setDisplayName}
            placeholder="Prénom"
            placeholderTextColor={colors.textSecondary}
            style={s.input}
            autoCapitalize="words"
            returnKeyType="next"
          />
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
            placeholder="Mot de passe (6 caractères min)"
            placeholderTextColor={colors.textSecondary}
            style={s.input}
            secureTextEntry
            returnKeyType="done"
            onSubmitEditing={handleSignup}
          />
          {error ? <Text style={s.error}>{error}</Text> : null}
        </View>

        <TouchableOpacity style={s.primaryButton} onPress={handleSignup} disabled={loading}>
          {loading ? (
            <ActivityIndicator color={colors.surface} />
          ) : (
            <Text style={s.primaryButtonText}>Créer le compte</Text>
          )}
        </TouchableOpacity>

        <TouchableOpacity onPress={() => router.back()}>
          <Text style={s.link}>Déjà un compte ? <Text style={{ fontWeight: '700' }}>Se connecter</Text></Text>
        </TouchableOpacity>
      </ScrollView>
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
      flexGrow: 1,
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
