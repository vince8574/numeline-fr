import { useMemo, useState, useCallback } from 'react';
import { FlatList, StyleSheet, Text, View, TouchableOpacity, Image, ActivityIndicator, Pressable } from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useScannedProducts } from '../hooks/useScannedProducts';
import { useTheme } from '../theme/themeContext';
import { ScannedProduct } from '../types';
import { useI18n } from '../i18n/I18nContext';
import { StatusTag } from '../components/StatusTag';
import { GradientBackground } from '../components/GradientBackground';
import { usePreferencesStore } from '../stores/usePreferencesStore';
import { checkAllProductsForRecalls } from '../services/recallCheckService';
import * as Notifications from 'expo-notifications';

type Filter = 'all' | 'recalled' | 'safe' | 'unknown';

export function HistoryScreen() {
  const { colors } = useTheme();
  const { t, locale } = useI18n();
  const router = useRouter();
  const { products, updateRecall } = useScannedProducts();
  const country = usePreferencesStore((state) => state.country);
  const [filter, setFilter] = useState<Filter>('all');
  const [isCheckingRecalls, setIsCheckingRecalls] = useState(false);

  const formatDate = useCallback(
    (value: string | number) => {
      const date = new Date(value);
      return {
        date: date.toLocaleDateString(locale || undefined),
        time: date.toLocaleTimeString(locale || undefined, { hour: '2-digit', minute: '2-digit' })
      };
    },
    [locale]
  );

  const statusLabels: Record<ScannedProduct['recallStatus'], string> = {
    safe: t('recallStatus.safe'),
    recalled: t('recallStatus.recalled'),
    unknown: t('recallStatus.unknown'),
    warning: t('recallStatus.warning')
  };

  // Automatic recall checking when screen is focused
  useFocusEffect(
    useCallback(() => {
      async function checkForNewRecalls() {
        if (products.length === 0) return;

        setIsCheckingRecalls(true);
        console.log('[HistoryScreen] Checking for new recalls...');

        try {
          const results = await checkAllProductsForRecalls(products, country);

          if (results.length > 0) {
            console.log(`[HistoryScreen] Found ${results.length} products with status changes`);

            for (const result of results) {
              if (result.newRecalls.length > 0) {
                const product = products.find((p) => p.id === result.productId);
                if (product) {
                  updateRecall(product, result.newRecalls);
                }

                if (product) {
                  await Notifications.scheduleNotificationAsync({
                    content: {
                      title: t('notifications.newRecallTitle'),
                      body: t('notifications.newRecallBody', {
                        brand: product.brand,
                        lot: product.lotNumber
                      })
                    },
                    trigger: null
                  });
                }
              } else {
                console.log(
                  `[HistoryScreen] Product ${result.productId} is no longer recalled`
                );
              }
            }
          } else {
            console.log('[HistoryScreen] No status changes detected');
          }
        } catch (error) {
          console.error('[HistoryScreen] Error checking recalls:', error);
        } finally {
          setIsCheckingRecalls(false);
        }
      }

      checkForNewRecalls();
    }, [products, country, updateRecall, t])
  );

  const filtered = useMemo(() => {
    if (filter === 'all') {
      return products;
    }
    return products.filter((product) => product.recallStatus === filter);
  }, [filter, products]);

  const renderItem = ({ item }: { item: ScannedProduct }) => {
    const scannedAt = formatDate(item.scannedAt);

    return (
      <Pressable
        style={({ pressed }) => [
          styles.item,
          {
            backgroundColor: colors.surface,
            transform: [{ scale: pressed ? 0.98 : 1 }],
          },
        ]}
        onPress={() => {
          router.push({ pathname: '/details/[id]', params: { id: item.id } });
        }}
      >
        <View style={styles.itemContent}>
          {item.productImage ? (
            <Image
              source={{ uri: item.productImage }}
              style={styles.productThumbnail}
              resizeMode="contain"
            />
          ) : null}
          <View style={styles.itemDetails}>
            {item.productName ? (
              <Text style={[styles.productName, { color: colors.textPrimary }]} numberOfLines={2}>
                {item.productName}
              </Text>
            ) : null}
            <View style={styles.itemHeader}>
              <Text style={[styles.brand, { color: colors.textPrimary }]}>{item.brand}</Text>
              <StatusTag status={item.recallStatus} label={statusLabels[item.recallStatus]} />
            </View>
            <Text style={[styles.dataDisclaimer, { color: colors.textSecondary }]}>
              {t('common.dataDisclaimer')}
            </Text>
            <Text style={[styles.lot, { color: colors.textSecondary }]}>
              {t('productCard.lot', { lot: item.lotNumber })}
            </Text>
            <Text style={[styles.date, { color: colors.textSecondary }]}>
              {t('productCard.scannedAt', scannedAt)}
            </Text>
            <Text style={[styles.noRecallDisclaimer, { color: colors.textSecondary }]}>
              {t('common.noRecallDisclaimer')}
            </Text>
          </View>
        </View>
      </Pressable>
    );
  };

  return (
    <GradientBackground>
      <FlatList
        data={filtered}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        ListHeaderComponent={
          <View>
            <View style={styles.titleContainer}>
              <Image
                source={require('../../assets/logo_numelineFR.png')}
                style={styles.logo}
                resizeMode="cover"
              />
              <Text style={[styles.title, { color: colors.textPrimary }]}>
                {t('history.fullTitle')}
              </Text>
              {isCheckingRecalls && (
                <ActivityIndicator size="small" color={colors.accent} style={styles.spinner} />
              )}
            </View>
            <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
              {t('history.subtitle')}
            </Text>

            <View style={styles.filters}>
              {(['all', 'recalled', 'safe', 'unknown'] as Filter[]).map((item) => (
                <TouchableOpacity
                  key={item}
                  onPress={() => setFilter(item)}
                  style={[
                    styles.filterChip,
                    {
                      backgroundColor: filter === item ? colors.accent : colors.surfaceAlt,
                      borderColor: filter === item ? colors.accent : colors.surfaceAlt
                    }
                  ]}
                >
                  <Text
                    style={[
                      styles.filterText,
                      { color: filter === item ? colors.surface : colors.textSecondary }
                    ]}
                  >
                    {t(`history.filters.${item}`)}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        }
        renderItem={renderItem}
        ListEmptyComponent={
          <View style={styles.empty}>
            <View style={styles.emptyIconContainer}>
              <Ionicons name="scan-outline" size={48} color={colors.textSecondary} style={{ opacity: 0.4 }} />
            </View>
            <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
              {t('history.emptyStateDetailed')}
            </Text>
          </View>
        }
        ListFooterComponent={
          <View style={[styles.appDisclaimerBox, { backgroundColor: colors.surfaceAlt, borderColor: 'rgba(255,255,255,0.06)' }]}>
            <Ionicons name="information-circle-outline" size={16} color={colors.textSecondary} />
            <Text style={[styles.appDisclaimerText, { color: colors.textPrimary }]}>
              {t('common.appDisclaimer')}
            </Text>
          </View>
        }
      />
    </GradientBackground>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1
  },
  list: {
    padding: 24
  },
  titleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12
  },
  logo: {
    width: 36,
    height: 36,
    borderRadius: 18,
    overflow: 'hidden'
  },
  spinner: {
    marginLeft: 8
  },
  title: {
    fontSize: 26,
    fontWeight: '700'
  },
  subtitle: {
    fontSize: 16,
    marginTop: 8,
    marginBottom: 18
  },
  filters: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginBottom: 24
  },
  filterChip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: 1
  },
  filterText: {
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase'
  },
  item: {
    marginBottom: 16,
    borderRadius: 24,
    padding: 18,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 4
  },
  itemHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 6
  },
  brand: {
    fontSize: 18,
    fontWeight: '700',
    flex: 1,
    marginRight: 8
  },
  lot: {
    fontSize: 16
  },
  dataDisclaimer: {
    fontSize: 11,
    fontStyle: 'italic',
    marginTop: 4,
    marginBottom: 4
  },
  date: {
    fontSize: 13,
    marginTop: 8
  },
  noRecallDisclaimer: {
    fontSize: 12,
    fontStyle: 'italic',
    marginTop: 8
  },
  empty: {
    marginTop: 60,
    alignItems: 'center',
    paddingHorizontal: 24
  },
  emptyIconContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: 'rgba(255,255,255,0.06)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16
  },
  emptyText: {
    textAlign: 'center',
    fontSize: 15,
    lineHeight: 22
  },
  itemContent: {
    flexDirection: 'row',
    gap: 12
  },
  productThumbnail: {
    width: 70,
    height: 70,
    borderRadius: 12,
    backgroundColor: '#f5f5f5'
  },
  itemDetails: {
    flex: 1
  },
  productName: {
    fontSize: 15,
    fontWeight: '600',
    marginBottom: 6
  },
  appDisclaimerBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    borderRadius: 16,
    padding: 16,
    marginTop: 24,
    borderWidth: 1
  },
  appDisclaimerText: {
    fontSize: 12,
    lineHeight: 18,
    flex: 1
  }
});
