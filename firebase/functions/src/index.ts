import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';
import * as https from 'https';
admin.initializeApp();

const firestore = admin.firestore();

// Helper function to fetch recalls from Rappel Conso API
function fetchRappelConsoRecalls(): Promise<any[]> {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'data.economie.gouv.fr',
      path: '/api/records/1.0/search/?dataset=rappelconso0&rows=100&sort=-date_de_publication',
      method: 'GET',
      headers: { 'User-Agent': 'EatsOK/1.0' }
    };

    https.get(options, (res) => {
      let data = '';
      res.on('data', (chunk) => data += chunk);
      res.on('end', () => {
        try {
          const json = JSON.parse(data);
          const recalls = (json.records || []).map((record: any) => ({
            id: record.recordid,
            title: record.fields?.noms_des_modeles_ou_references || record.fields?.libelle || 'Produit rappelé',
            description: record.fields?.motif_du_rappel,
            brand: record.fields?.nom_de_la_marque_du_produit,
            lotNumbers: extractLotNumbers(record.fields?.identification_des_produits),
            publishedAt: record.fields?.date_de_publication,
            link: record.fields?.lien_vers_la_fiche_rappel
          }));
          resolve(recalls);
        } catch (error) {
          reject(error);
        }
      });
    }).on('error', reject);
  });
}

// Helper function to extract lot numbers
function extractLotNumbers(identificationText: string | undefined): string[] {
  if (!identificationText) return [];
  const parts = identificationText.split(/[\n,;]/);
  const lotNumbers: string[] = [identificationText];
  parts.forEach(part => {
    const trimmed = part.trim();
    if (trimmed.length > 0) {
      lotNumbers.push(trimmed);
    }
  });
  return lotNumbers;
}

// Helper function to check if a product matches a recall
function matchesRecall(product: any, recall: any): boolean {
  // Normalize brand names
  const productBrand = product.brand?.toLowerCase().trim() || '';
  const recallBrand = recall.brand?.toLowerCase().trim() || '';

  // Check brand match (fuzzy matching)
  if (productBrand && recallBrand && !productBrand.includes(recallBrand) && !recallBrand.includes(productBrand)) {
    return false;
  }

  // Check lot number match
  if (product.lotNumber && recall.lotNumbers) {
    const productLot = product.lotNumber.toLowerCase().trim();
    return recall.lotNumbers.some((recallLot: string) => {
      const normalizedRecallLot = recallLot.toLowerCase().trim();
      return productLot.includes(normalizedRecallLot) || normalizedRecallLot.includes(productLot);
    });
  }

  return false;
}

export const purgeOldScans = functions
  .region('europe-west1')
  .pubsub.schedule('every 24 hours')
  .timeZone('Europe/Paris')
  .onRun(async () => {
    const snapshot = await firestore.collection('scans').get();

    const batch = firestore.batch();
    let deleted = 0;

    snapshot.forEach((doc: FirebaseFirestore.QueryDocumentSnapshot) => {
      const data = doc.data();
      const scannedAt = data.scannedAt ? new Date(data.scannedAt) : null;

      if (scannedAt && monthsBetween(scannedAt, new Date()) >= 6) {
        batch.delete(doc.ref);
        deleted += 1;
      }
    });

    if (deleted > 0) {
      await batch.commit();
    }

    return { deleted };
  });

function monthsBetween(start: Date, end: Date) {
  return (end.getFullYear() - start.getFullYear()) * 12 + (end.getMonth() - start.getMonth());
}

export const notifyRecallMatch = functions
  .region('europe-west1')
  .https.onCall(async ({ productId, recall }: { productId: string; recall: { id: string; title: string } }) => {
    const productRef = firestore.collection('scans').doc(productId);
    const productSnap = await productRef.get();

    if (!productSnap.exists) {
      throw new functions.https.HttpsError('not-found', 'Produit introuvable');
    }

    await productRef.update({
      recallStatus: 'recalled',
      recallReference: recall.id,
      lastCheckedAt: Date.now()
    });

    const messaging = admin.messaging();
    await messaging.sendToTopic(`recall-${recall.id}`, {
      notification: {
        title: 'Rappel produit détecté',
        body: `${recall.title} fait l'objet d'un rappel.`
      },
      data: {
        productId,
        recallId: recall.id
      }
    });

    return { success: true };
  });

// New function: Check recalls every hour and send notifications
export const checkRecallsHourly = functions
  .region('europe-west1')
  .pubsub.schedule('every 1 hours')
  .timeZone('Europe/Paris')
  .onRun(async () => {
    console.log('Starting hourly recall check...');

    try {
      // Fetch latest recalls from API
      const recalls = await fetchRappelConsoRecalls();
      console.log(`Fetched ${recalls.length} recalls from API`);

      // Get all scanned products from Firestore
      const scansSnapshot = await firestore.collection('scans').get();
      console.log(`Found ${scansSnapshot.size} scanned products in database`);

      let notificationsSent = 0;
      let productsUpdated = 0;
      const messaging = admin.messaging();

      // Check each product against recalls
      for (const scanDoc of scansSnapshot.docs) {
        const product = scanDoc.data();

        // Skip if already marked as recalled
        if (product.recallStatus === 'recalled') {
          continue;
        }

        // Check if product matches any recall
        for (const recall of recalls) {
          if (matchesRecall(product, recall)) {
            console.log(`Match found: ${product.brand} - ${product.lotNumber} matches recall ${recall.id}`);

            // Update product in Firestore
            await scanDoc.ref.update({
              recallStatus: 'recalled',
              recallReference: recall.id,
              lastCheckedAt: Date.now()
            });
            productsUpdated++;

            // Send push notification if user has FCM token
            if (product.fcmToken) {
              try {
                await messaging.send({
                  token: product.fcmToken,
                  notification: {
                    title: '⚠️ Rappel produit détecté',
                    body: `${recall.title} fait l'objet d'un rappel sanitaire.`
                  },
                  data: {
                    type: 'recall',
                    productId: scanDoc.id,
                    recallId: recall.id,
                    brand: product.brand || '',
                    lotNumber: product.lotNumber || ''
                  },
                  android: {
                    priority: 'high',
                    notification: {
                      channelId: 'recall-alerts',
                      priority: 'high',
                      sound: 'default'
                    }
                  }
                });
                notificationsSent++;
                console.log(`Notification sent for product ${scanDoc.id}`);
              } catch (notifError) {
                console.error(`Failed to send notification for ${scanDoc.id}:`, notifError);
              }
            }

            break; // Only match first recall
          }
        }
      }

      console.log(`Hourly check complete: ${productsUpdated} products updated, ${notificationsSent} notifications sent`);

      return {
        success: true,
        recallsChecked: recalls.length,
        productsScanned: scansSnapshot.size,
        productsUpdated,
        notificationsSent
      };
    } catch (error) {
      console.error('Error in hourly recall check:', error);
      return {
        success: false,
        error: String(error)
      };
    }
  });
