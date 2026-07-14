import { useState } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, Image, KeyboardAvoidingView, Platform } from 'react-native';
import { useRouter } from 'expo-router';
import { useTheme } from '../src/theme/themeContext';
import { usePreferencesStore } from '../src/stores/usePreferencesStore';
import { useDietaryProfileStore } from '../src/stores/useDietaryProfileStore';

export default function OnboardingScreen() {
  const { colors } = useTheme();
  const router = useRouter();
  const [step, setStep] = useState<'name' | 'diet'>('name');
  const [name, setName] = useState('');
  const [error, setError] = useState('');
  const setFirstName = usePreferencesStore((state) => state.setFirstName);
  const setHasSeenWelcome = usePreferencesStore((state) => state.setHasSeenWelcome);

  // Étape 1 : prénom → on passe à la proposition de configurer le régime AVANT le
  // 1er scan (pour que le premier scan produise un résultat personnalisé « qui peut
  // manger ça » plutôt qu'un simple « aucun rappel »).
  const handleContinue = () => {
    const trimmed = name.trim();
    if (!trimmed) {
      setError('Merci de renseigner votre prénom pour continuer.');
      return;
    }
    setError('');
    setFirstName(trimmed);
    setHasSeenWelcome(false);
    setStep('diet');
  };

  // Étape 2 : « Configurer maintenant » → pré-crée une personne (nommée avec le
  // prénom) et ouvre son éditeur de régime. « Plus tard » → entrée normale.
  const handleConfigureDiet = () => {
    const id = useDietaryProfileStore.getState().addPerson(name.trim());
    router.replace(`/dietary-person?id=${id}` as any);
  };
  const handleSkipDiet = () => {
    router.replace('/welcome');
  };

  return (
    <KeyboardAvoidingView style={[styles.container, { backgroundColor: colors.background }]} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <View style={styles.content}>
        <Image source={require('../assets/logo_numelineFR.png')} style={styles.logo} resizeMode="contain" />

        {step === 'name' ? (
          <>
            <Text style={[styles.title, { color: colors.textPrimary }]}>Bienvenue !</Text>
            <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
              L'application fournit des alertes préventives mais ne garantit pas la consommabilité des produits. Vous restez seul responsable en cas d'ingestion d'un produit contaminé.
            </Text>

            <View style={styles.inputGroup}>
              <Text style={[styles.label, { color: colors.textSecondary }]}>Votre prénom</Text>
              <TextInput
                value={name}
                onChangeText={setName}
                placeholder="Ex : Marie"
                placeholderTextColor={colors.textSecondary}
                style={[
                  styles.input,
                  {
                    color: colors.textPrimary,
                    backgroundColor: colors.surface,
                    borderColor: colors.border
                  }
                ]}
                autoCapitalize="words"
                returnKeyType="done"
                onSubmitEditing={handleContinue}
              />
              {error ? <Text style={[styles.error, { color: colors.danger }]}>{error}</Text> : null}
            </View>

            <TouchableOpacity style={[styles.button, { backgroundColor: colors.accent }]} onPress={handleContinue} activeOpacity={0.85}>
              <Text style={[styles.buttonText, { color: colors.surface }]}>Continuer</Text>
            </TouchableOpacity>
          </>
        ) : (
          <>
            <Text style={[styles.title, { color: colors.textPrimary }]}>Personnalisez vos scans</Text>
            <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
              Renseignez vos allergènes et ceux de votre famille (grossesse, régime…). Dès votre premier scan, l'app vous dira qui, chez vous, peut consommer le produit — pas seulement s'il est rappelé.
            </Text>

            <TouchableOpacity style={[styles.button, { backgroundColor: colors.warning }]} onPress={handleConfigureDiet} activeOpacity={0.85}>
              <Text style={[styles.buttonText, { color: colors.onAccent }]}>Configurer mon régime</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.linkButton} onPress={handleSkipDiet} activeOpacity={0.7}>
              <Text style={[styles.linkButtonText, { color: colors.textSecondary }]}>Plus tard</Text>
            </TouchableOpacity>
          </>
        )}
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 24
  },
  content: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 20
  },
  logo: {
    width: 120,
    height: 120,
    borderRadius: 32
  },
  title: {
    fontSize: 24,
    fontWeight: '800'
  },
  subtitle: {
    fontSize: 14,
    lineHeight: 20,
    textAlign: 'center'
  },
  inputGroup: {
    width: '100%',
    gap: 6
  },
  label: {
    fontSize: 14,
    fontWeight: '600'
  },
  input: {
    width: '100%',
    borderRadius: 14,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16
  },
  error: {
    marginTop: 4,
    fontSize: 13
  },
  button: {
    width: '100%',
    borderRadius: 16,
    paddingVertical: 14,
    alignItems: 'center'
  },
  buttonText: {
    fontSize: 16,
    fontWeight: '700'
  },
  linkButton: {
    paddingVertical: 8
  },
  linkButtonText: {
    fontSize: 15,
    fontWeight: '600'
  }
});
