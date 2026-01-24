import { useState, useEffect, useCallback } from 'react';
import {
  StyleSheet,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  FlatList,
  ActivityIndicator,
  Alert
} from 'react-native';
import { useTheme } from '../theme/themeContext';
import { searchBrands, addBrandToFirestore } from '../services/firestoreBrandsService';
import { addCustomBrand, searchCustomBrands } from '../services/customBrandsService';

interface BrandSuggestion {
  name: string;
  isCustom?: boolean;
  confidence?: number;
}

interface BrandAutocompleteProps {
  value: string;
  onChangeText: (text: string) => void;
  placeholder?: string;
  autoCapitalize?: 'none' | 'sentences' | 'words' | 'characters';
}

export function BrandAutocomplete({
  value,
  onChangeText,
  placeholder = "Ex: Marque X",
  autoCapitalize = "words"
}: BrandAutocompleteProps) {
  const { colors } = useTheme();
  const [suggestions, setSuggestions] = useState<BrandSuggestion[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);

  const loadSuggestions = useCallback(async (searchText: string) => {
    if (!searchText.trim() || searchText.trim().length < 2) {
      setSuggestions([]);
      setShowSuggestions(false);
      return;
    }

    setIsLoading(true);
    try {
      const results: BrandSuggestion[] = [];

      // 1. Rechercher dans les marques personnalisées
      const customBrands = await searchCustomBrands(searchText, 5);
      customBrands.forEach(cb => {
        results.push({
          name: cb.name,
          isCustom: true
        });
      });

      // 2. Rechercher dans Firestore
      const firestoreBrands = await searchBrands(searchText, 5);
      firestoreBrands.forEach(brand => {
        // Ne pas dupliquer si déjà dans les customs
        if (!results.find(r => r.name.toLowerCase() === brand.toLowerCase())) {
          results.push({
            name: brand,
            isCustom: false
          });
        }
      });

      setSuggestions(results.slice(0, 8)); // Max 8 suggestions
      setShowSuggestions(results.length > 0);
    } catch (error) {
      console.warn('Error loading brand suggestions:', error);
      setSuggestions([]);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    const timeoutId = setTimeout(() => {
      loadSuggestions(value);
    }, 300); // Debounce de 300ms

    return () => clearTimeout(timeoutId);
  }, [value, loadSuggestions]);

  const handleSelectSuggestion = (suggestion: BrandSuggestion) => {
    onChangeText(suggestion.name);
    setShowSuggestions(false);
    setSuggestions([]);
  };

  const handleAddNewBrand = async () => {
    const trimmedBrand = value.trim();

    if (!trimmedBrand || trimmedBrand.length < 2) {
      Alert.alert(
        'Marque invalide',
        'Le nom de la marque doit contenir au moins 2 caractères.'
      );
      return;
    }

    Alert.alert(
      'Nouvelle marque',
      `Voulez-vous ajouter "${trimmedBrand}" à votre liste de marques personnalisées ?`,
      [
        {
          text: 'Annuler',
          style: 'cancel'
        },
        {
          text: 'Ajouter',
          onPress: async () => {
            const success = await addCustomBrand(trimmedBrand);
            if (success) {
              // Ajouter aussi à Firestore pour partage avec autres utilisateurs
              await addBrandToFirestore(trimmedBrand);
              setShowSuggestions(false);
              Alert.alert('✓ Marque ajoutée', `"${trimmedBrand}" a été ajoutée à vos marques.`);
            } else {
              Alert.alert('Erreur', 'Cette marque existe déjà ou ne peut pas être ajoutée.');
            }
          }
        }
      ]
    );
  };

  const handleTextChange = (text: string) => {
    onChangeText(text);
    if (!text.trim()) {
      setShowSuggestions(false);
      setSuggestions([]);
    }
  };

  return (
    <View style={styles.container}>
      <View style={[styles.inputContainer, { backgroundColor: colors.surface }]}>
        <Text style={[styles.label, { color: colors.textSecondary }]}>Marque / Produit</Text>
        <TextInput
          style={[styles.input, { color: colors.textPrimary }]}
          placeholder={placeholder}
          placeholderTextColor={colors.textSecondary}
          value={value}
          onChangeText={handleTextChange}
          autoCapitalize={autoCapitalize}
          onFocus={() => value.trim().length >= 2 && setSuggestions(suggestions)}
        />
        {isLoading && (
          <ActivityIndicator
            size="small"
            color={colors.accent}
            style={styles.loadingIndicator}
          />
        )}
      </View>

      {showSuggestions && suggestions.length > 0 && (
        <View style={[styles.suggestionsContainer, { backgroundColor: colors.surface }]}>
          <FlatList
            data={suggestions}
            keyExtractor={(item, index) => `${item.name}-${index}`}
            renderItem={({ item }) => (
              <TouchableOpacity
                style={[
                  styles.suggestionItem,
                  { borderBottomColor: colors.border }
                ]}
                onPress={() => handleSelectSuggestion(item)}
              >
                <Text style={[styles.suggestionText, { color: colors.textPrimary }]}>
                  {item.name}
                </Text>
                {item.isCustom && (
                  <View style={[styles.badge, { backgroundColor: colors.accent }]}>
                    <Text style={[styles.badgeText, { color: colors.surface }]}>
                      Perso
                    </Text>
                  </View>
                )}
              </TouchableOpacity>
            )}
            ListFooterComponent={
              <TouchableOpacity
                style={[styles.addButton, { borderTopColor: colors.border }]}
                onPress={handleAddNewBrand}
              >
                <Text style={[styles.addButtonText, { color: colors.accent }]}>
                  + Ajouter "{value}" comme nouvelle marque
                </Text>
              </TouchableOpacity>
            }
          />
        </View>
      )}

      {!showSuggestions && value.trim().length >= 2 && !isLoading && (
        <TouchableOpacity
          style={[styles.addNewButton, { backgroundColor: colors.surfaceAlt }]}
          onPress={handleAddNewBrand}
        >
          <Text style={[styles.addNewButtonText, { color: colors.accent }]}>
            + Ajouter "{value}" comme nouvelle marque
          </Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'relative',
    zIndex: 10
  },
  inputContainer: {
    borderRadius: 18,
    marginTop: 20,
    padding: 16
  },
  label: {
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 1
  },
  input: {
    marginTop: 8,
    fontSize: 18,
    fontWeight: '600'
  },
  loadingIndicator: {
    position: 'absolute',
    right: 16,
    top: 40
  },
  suggestionsContainer: {
    marginTop: 8,
    borderRadius: 18,
    maxHeight: 300,
    overflow: 'hidden',
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8
  },
  suggestionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    borderBottomWidth: 1
  },
  suggestionText: {
    fontSize: 16,
    fontWeight: '500',
    flex: 1
  },
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    marginLeft: 8
  },
  badgeText: {
    fontSize: 10,
    fontWeight: '700',
    textTransform: 'uppercase'
  },
  addButton: {
    padding: 16,
    borderTopWidth: 1,
    alignItems: 'center'
  },
  addButtonText: {
    fontSize: 14,
    fontWeight: '600'
  },
  addNewButton: {
    marginTop: 8,
    padding: 12,
    alignItems: 'center',
    borderRadius: 16
  },
  addNewButtonText: {
    fontSize: 14,
    fontWeight: '600'
  }
});
