import { StyleSheet, View, Text, TouchableOpacity, Linking } from 'react-native';
import { useTheme } from '../theme/themeContext';
import { useI18n } from '../i18n/I18nContext';
import { RecallRecord } from '../types';

interface RecallAlertProps {
  recall: RecallRecord;
  reason?: string;
}

export function RecallAlert({ recall, reason }: RecallAlertProps) {
  const { colors } = useTheme();
  const { t } = useI18n();

  const openEmergencyCall = () => {
    Linking.openURL('tel:15');
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.danger }]}>
      <View style={styles.header}>
        <Text style={styles.icon}>🚨</Text>
        <Text style={styles.title}>{t('recallAlert.title')}</Text>
      </View>

      <View style={[styles.warningBox, { backgroundColor: 'rgba(0,0,0,0.15)' }]}>
        <Text style={styles.warningTitle}>🚫 {t('recallAlert.doNotConsume')}</Text>
        <Text style={styles.warningText}>
          {t('recallAlert.warning')}
        </Text>
      </View>

      {reason && (
        <View style={styles.reasonBox}>
          <Text style={styles.reasonLabel}>{t('recallAlert.reasonLabel')}</Text>
          <Text style={styles.reasonText}>{reason}</Text>
        </View>
      )}

      <View style={styles.recallDetails}>
        <Text style={styles.recallTitle}>{recall.title}</Text>
        {recall.description && (
          <Text style={styles.recallDescription}>{recall.description}</Text>
        )}
      </View>

      <View style={[styles.emergencyBox, { backgroundColor: 'rgba(0,0,0,0.2)' }]}>
        <Text style={styles.emergencyTitle}>⚕️ {t('recallAlert.emergencyTitle')}</Text>
        <Text style={styles.emergencyText}>
          {t('recallAlert.emergencyText')}
        </Text>
        <View style={styles.emergencyNumbers}>
          <TouchableOpacity
            style={[styles.emergencyButton, { backgroundColor: '#FFF' }]}
            onPress={openEmergencyCall}
          >
            <Text style={[styles.emergencyButtonText, { color: colors.danger }]}>
              📞 {t('recallAlert.callSamu')}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.emergencyButton, { backgroundColor: '#FFF', marginTop: 8 }]}
            onPress={() => Linking.openURL('tel:112')}
          >
            <Text style={[styles.emergencyButtonText, { color: colors.danger }]}>
              📞 {t('recallAlert.callEmergency')}
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      {recall.link && (
        <TouchableOpacity
          style={[styles.linkButton, { backgroundColor: 'rgba(255,255,255,0.9)' }]}
          onPress={() => Linking.openURL(recall.link!)}
        >
          <Text style={[styles.linkText, { color: colors.danger }]}>
            📋 {t('recallAlert.viewOfficialNotice')}
          </Text>
        </TouchableOpacity>
      )}

      <View style={styles.footer}>
        <Text style={styles.footerText}>
          {t('recallAlert.returnForRefund')}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    borderRadius: 24,
    padding: 24,
    gap: 16
  },
  header: {
    alignItems: 'center',
    gap: 8
  },
  icon: {
    fontSize: 48
  },
  title: {
    fontSize: 24,
    fontWeight: '900',
    color: '#FFF',
    textAlign: 'center',
    letterSpacing: 1
  },
  warningBox: {
    padding: 16,
    borderRadius: 16,
    gap: 8
  },
  warningTitle: {
    fontSize: 20,
    fontWeight: '900',
    color: '#FFF',
    textAlign: 'center'
  },
  warningText: {
    fontSize: 16,
    color: '#FFF',
    textAlign: 'center',
    lineHeight: 24,
    fontWeight: '600'
  },
  reasonBox: {
    gap: 8
  },
  reasonLabel: {
    fontSize: 14,
    fontWeight: '700',
    color: '#FFF',
    textTransform: 'uppercase',
    letterSpacing: 1
  },
  reasonText: {
    fontSize: 18,
    fontWeight: '700',
    color: '#FFF'
  },
  recallDetails: {
    gap: 8
  },
  recallTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFF'
  },
  recallDescription: {
    fontSize: 15,
    color: '#FFF',
    lineHeight: 22,
    opacity: 0.95
  },
  emergencyBox: {
    padding: 16,
    borderRadius: 16,
    gap: 12
  },
  emergencyTitle: {
    fontSize: 18,
    fontWeight: '900',
    color: '#FFF',
    textAlign: 'center'
  },
  emergencyText: {
    fontSize: 15,
    color: '#FFF',
    textAlign: 'center',
    lineHeight: 22,
    fontWeight: '500'
  },
  emergencyNumbers: {
    marginTop: 8
  },
  emergencyButton: {
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderRadius: 12,
    alignItems: 'center'
  },
  emergencyButtonText: {
    fontSize: 17,
    fontWeight: '800',
    letterSpacing: 0.5
  },
  linkButton: {
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderRadius: 12,
    alignItems: 'center'
  },
  linkText: {
    fontSize: 16,
    fontWeight: '700'
  },
  footer: {
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.3)'
  },
  footerText: {
    fontSize: 14,
    color: '#FFF',
    textAlign: 'center',
    fontWeight: '600',
    opacity: 0.9
  }
});
