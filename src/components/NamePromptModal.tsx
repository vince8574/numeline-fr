import { useState } from 'react';
import { Modal, View, Text, TextInput, TouchableOpacity, StyleSheet, KeyboardAvoidingView, Platform } from 'react-native';
import { useTheme } from '../theme/themeContext';
import { useI18n } from '../i18n/I18nContext';
import { GradientBackground } from './GradientBackground';

interface NamePromptModalProps {
  visible: boolean;
  onSave: (name: string) => void;
  onSkip: () => void;
}

export function NamePromptModal({ visible, onSave, onSkip }: NamePromptModalProps) {
  const { colors } = useTheme();
  const { t } = useI18n();
  const [name, setName] = useState('');

  const handleSave = () => {
    if (name.trim()) {
      onSave(name.trim());
      setName('');
    }
  };

  const handleSkip = () => {
    setName('');
    onSkip();
  };

  return (
    <Modal
      visible={visible}
      transparent={false}
      animationType="fade"
      onRequestClose={handleSkip}
    >
      <GradientBackground>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.overlay}
        >
          <View style={[styles.modalContent, { backgroundColor: 'rgba(255, 255, 255, 0.95)' }]}>
            <Text style={[styles.title, { color: colors.textPrimary }]}>
              {t('welcomeScreen.namePromptTitle')}
            </Text>
            <Text style={[styles.message, { color: colors.textSecondary }]}>
              {t('welcomeScreen.namePromptMessage')}
            </Text>

            <TextInput
              style={[
                styles.input,
                {
                  backgroundColor: colors.surfaceAlt,
                  color: colors.textPrimary,
                  borderColor: colors.border
                }
              ]}
              placeholder={t('welcomeScreen.namePromptPlaceholder')}
              placeholderTextColor={colors.textSecondary}
              value={name}
              onChangeText={setName}
              autoCapitalize="words"
              autoFocus
              onSubmitEditing={handleSave}
            />

            <View style={styles.buttons}>
              <TouchableOpacity
                style={[styles.button, styles.skipButton, { backgroundColor: colors.surfaceAlt }]}
                onPress={handleSkip}
              >
                <Text style={[styles.buttonText, { color: colors.textSecondary }]}>
                  {t('welcomeScreen.namePromptSkip')}
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.button,
                  styles.saveButton,
                  {
                    backgroundColor: colors.accent,
                    opacity: name.trim() ? 1 : 0.5
                  }
                ]}
                onPress={handleSave}
                disabled={!name.trim()}
              >
                <Text style={[styles.buttonText, { color: colors.surface }]}>
                  {t('welcomeScreen.namePromptSave')}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </GradientBackground>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24
  },
  modalContent: {
    width: '100%',
    maxWidth: 400,
    borderRadius: 24,
    padding: 28,
    gap: 20
  },
  title: {
    fontSize: 24,
    fontWeight: '800',
    textAlign: 'center'
  },
  message: {
    fontSize: 16,
    lineHeight: 24,
    textAlign: 'center'
  },
  input: {
    borderRadius: 16,
    paddingHorizontal: 20,
    paddingVertical: 14,
    fontSize: 18,
    fontWeight: '600',
    borderWidth: 2,
    marginTop: 8
  },
  buttons: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 8
  },
  button: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center'
  },
  skipButton: {
    flex: 0.8
  },
  saveButton: {
    flex: 1.2
  },
  buttonText: {
    fontSize: 16,
    fontWeight: '700'
  }
});
