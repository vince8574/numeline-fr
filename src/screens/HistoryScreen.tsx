import { useMemo, useState, useCallback } from 'react';
import { FlatList, StyleSheet, Text, View, TouchableOpacity, Image, ActivityIndicator } from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
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
    (value: string | number) => new Date(value).toLocaleString(locale || undefined),
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

            // Update each product with new recalls
            for (const result of results) {
              if (result.newRecalls.length > 0) {
                // Product now has recalls
                const product = products.find((p) => p.id === result.productId);
                if (product) {
                  updateRecall(product, result.newRecalls);
                }

                // Send notification
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
                // Product no longer recalled (rare case)
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

  const renderItem = ({ item }: { item: ScannedProduct }) => (
    <TouchableOpacity
      style={[styles.item, { backgroundColor: colors.surface }]}
      onPress={() => router.push({ pathname: '/details/[id]', params: { id: item.id } })}
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
          <Text style={[styles.lot, { color: colors.textSecondary }]}>
            {t('productCard.lot', { lot: item.lotNumber })}
          </Text>
          <Text style={[styles.date, { color: colors.textSecondary }]}>
            {t('productCard.scannedAt', { date: formatDate(item.scannedAt) })}
          </Text>
        </View>
      </View>
    </TouchableOpacity>
  );

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
                      backgroundColor: filter === item ? colors.accentSoft : colors.surfaceAlt,
                      borderColor: filter === item ? colors.accent : colors.surfaceAlt
                    }
                  ]}
                >
                  <Text
                    style={[
                      styles.filterText,
                      { color: filter === item ? colors.accent : colors.textSecondary }
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
            <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
              {t('history.emptyStateDetailed')}
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
    borderRadius: 10,
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
    padding: 18
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
  date: {
    fontSize: 13,
    marginTop: 8
  },
  empty: {
    marginTop: 80,
    alignItems: 'center',
    paddingHorizontal: 24
  },
  emptyText: {
    textAlign: 'center',
    fontSize: 16,
    lineHeight: 24
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
  }
});
