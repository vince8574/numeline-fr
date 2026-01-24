/**
 * Script de test pour les notifications de rappel
 *
 * Utilisation:
 * 1. Ouvrir l'app sur un appareil physique (pas Expo Go)
 * 2. Scanner un produit ou en créer un manuellement
 * 3. Marquer le produit comme rappelé en base de données
 * 4. Déclencher une notification
 *
 * Pour tester rapidement, vous pouvez :
 * - Créer un produit avec le numéro de lot "TEST-RECALL"
 * - L'app devrait détecter qu'il est rappelé
 */

import { scheduleRecallNotification } from '../src/services/notificationService';
import { ScannedProduct, RecallRecord } from '../src/types';

// Produit de test
const testProduct: ScannedProduct = {
  id: 'test-notification-001',
  brand: 'Danone',
  lotNumber: 'L12345-TEST',
  scannedAt: Date.now(),
  recallStatus: 'recalled',
  recallReference: 'test-recall-001',
  lastCheckedAt: Date.now()
};

// Rappel de test avec différentes raisons
const testRecalls: RecallRecord[] = [
  {
    id: 'test-recall-001',
    title: 'Rappel de yaourts - Présence de salmonelles',
    description: 'Des analyses ont révélé la présence de salmonelles dans certains lots. Ne pas consommer et rapporter le produit au magasin.',
    lotNumbers: ['L12345-TEST'],
    brand: 'Danone',
    productCategory: 'Produits laitiers',
    country: 'FR',
    publishedAt: new Date().toISOString(),
    link: 'https://rappel.conso.gouv.fr/fiche-rappel/12345/Interne'
  },
  {
    id: 'test-recall-002',
    title: 'Fromage contaminé - Listeria monocytogenes détectée',
    description: 'Présence de listeria pouvant provoquer de graves infections.',
    lotNumbers: ['L67890-TEST'],
    brand: 'Président',
    country: 'FR',
    publishedAt: new Date().toISOString()
  },
  {
    id: 'test-recall-003',
    title: 'Allergène non déclaré - Présence de traces de noix',
    description: 'Risque pour les personnes allergiques aux fruits à coque.',
    lotNumbers: ['L99999-TEST'],
    brand: 'Lu',
    country: 'FR',
    publishedAt: new Date().toISOString()
  },
  {
    id: 'test-recall-004',
    title: 'Présence de morceaux de verre dans les pots de confiture',
    description: 'Risque de blessures. Ne pas consommer.',
    lotNumbers: ['L55555-TEST'],
    brand: 'Bonne Maman',
    country: 'FR',
    publishedAt: new Date().toISOString()
  }
];

/**
 * Fonction pour tester une notification
 * À appeler depuis un écran de l'app
 */
export async function testRecallNotification(recallIndex: number = 0) {
  const recall = testRecalls[recallIndex];

  const testProductForRecall: ScannedProduct = {
    ...testProduct,
    brand: recall.brand || 'Test Brand',
    lotNumber: recall.lotNumbers[0],
    recallReference: recall.id
  };

  try {
    console.log('🧪 Test de notification pour:', recall.title);
    await scheduleRecallNotification(testProductForRecall, recall);
    console.log('✅ Notification envoyée avec succès');
    return true;
  } catch (error) {
    console.error('❌ Erreur lors de l\'envoi de la notification:', error);
    return false;
  }
}

/**
 * Tester tous les types de rappels
 */
export async function testAllNotificationTypes() {
  console.log('🧪 Test de tous les types de notifications...');

  for (let i = 0; i < testRecalls.length; i++) {
    console.log(`\n📱 Test ${i + 1}/${testRecalls.length}...`);
    await testRecallNotification(i);

    // Attendre 2 secondes entre chaque notification
    await new Promise(resolve => setTimeout(resolve, 2000));
  }

  console.log('\n✅ Tous les tests terminés');
}

// Pour utilisation dans l'app
export const TEST_PRODUCTS = testRecalls.map((recall, index) => ({
  id: `test-${index}`,
  brand: recall.brand || 'Test Brand',
  lotNumber: recall.lotNumbers[0],
  scannedAt: Date.now(),
  recallStatus: 'recalled' as const,
  recallReference: recall.id,
  lastCheckedAt: Date.now()
}));

export const TEST_RECALLS = testRecalls;
