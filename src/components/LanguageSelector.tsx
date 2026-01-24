import { useState } from 'react';
import { StyleSheet, View, Text, TouchableOpacity, Modal, ScrollView, Pressable } from 'react-native';
import { useTheme } from '../theme/themeContext';
import { SUPPORTED_LANGUAGES, LANGUAGE_FLAGS, SupportedLanguage } from '../i18n/i18n';
import { useI18n } from '../i18n/I18nContext';

export function LanguageSelector() {
  const { colors } = useTheme();
  const { locale, setLocale, t } = useI18n();
  const [modalVisible, setModalVisible] = useState(false);

  const handleLanguageChange = async (lang: SupportedLanguage) => {
    await setLocale(lang);
    setModalVisible(false);
  };

  const currentLanguageName = t(`languages.${locale}`);
  const currentFlag = LANGUAGE_FLAGS[locale as SupportedLanguage] || '🌐';

  return (
    <>
      <TouchableOpacity
        style={[styles.button, { backgroundColor: colors.surface }]}
        onPress={() => setModalVisible(true)}
      >
        <Text style={styles.flag}>{currentFlag}</Text>
        <Text style={[styles.buttonText, { color: colors.textPrimary }]}>{currentLanguageName}</Text>
        <Text style={[styles.arrow, { color: colors.textSecondary }]}>▾</Text>
      </TouchableOpacity>

      <Modal
        visible={modalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setModalVisible(false)}
      >
        <Pressable style={styles.modalOverlay} onPress={() => setModalVisible(false)}>
          <View style={[styles.modalContent, { backgroundColor: colors.background }]}>
            <Text style={[styles.modalTitle, { color: colors.textPrimary }]}>
              {t('settings.language')}
            </Text>

            <ScrollView style={styles.languageList}>
              {SUPPORTED_LANGUAGES.map((lang) => {
                const isSelected = lang === locale;
                return (
                  <TouchableOpacity
                    key={lang}
                    style={[
                      styles.languageOption,
                      {
                        backgroundColor: isSelected ? colors.surfaceAlt : colors.surface,
                        borderColor: isSelected ? colors.accent : 'transparent'
                      }
                    ]}
                    onPress={() => handleLanguageChange(lang)}
                  >
                    <Text style={styles.languageFlag}>{LANGUAGE_FLAGS[lang]}</Text>
                    <Text
                      style={[
                        styles.languageName,
                        { color: isSelected ? colors.accent : colors.textPrimary }
                      ]}
                    >
                      {t(`languages.${lang}`)}
                    </Text>
                    {isSelected && <Text style={[styles.checkmark, { color: colors.accent }]}>✓</Text>}
                  </TouchableOpacity>
                );
              })}
            </ScrollView>

            <TouchableOpacity
              style={[styles.closeButton, { backgroundColor: colors.surface }]}
              onPress={() => setModalVisible(false)}
            >
              <Text style={[styles.closeButtonText, { color: colors.textPrimary }]}>
                {t('common.cancel')}
              </Text>
            </TouchableOpacity>
          </View>
        </Pressable>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 12,
    gap: 8
  },
  flag: {
    fontSize: 24
  },
  buttonText: {
    fontSize: 16,
    fontWeight: '600',
    flex: 1
  },
  arrow: {
    fontSize: 12
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center'
  },
  modalContent: {
    width: '85%',
    maxHeight: '80%',
    borderRadius: 20,
    padding: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8
  },
  modalTitle: {
    fontSize: 22,
    fontWeight: '700',
    marginBottom: 20,
    textAlign: 'center'
  },
  languageList: {
    marginBottom: 16
  },
  languageOption: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 12,
    marginBottom: 8,
    borderWidth: 2
  },
  languageFlag: {
    fontSize: 28,
    marginRight: 12
  },
  languageName: {
    fontSize: 16,
    fontWeight: '600',
    flex: 1
  },
  checkmark: {
    fontSize: 20,
    fontWeight: '700'
  },
  closeButton: {
    padding: 14,
    borderRadius: 12,
    alignItems: 'center'
  },
  closeButtonText: {
    fontSize: 16,
    fontWeight: '600'
  }
});
