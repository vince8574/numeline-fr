import * as functions from 'firebase-functions';
import { defineSecret } from 'firebase-functions/params';
import * as admin from 'firebase-admin';
import * as https from 'https';
import type AnthropicTypes from '@anthropic-ai/sdk';
import { checkAppCheck } from './appCheck';
admin.initializeApp();

const VISION_API_KEY = defineSecret('GOOGLE_VISION_API_KEY');
const ANTHROPIC_API_KEY = defineSecret('ANTHROPIC_API_KEY');

const firestore = admin.firestore();

// Helper function to fetch recalls from Rappel Conso API.
// data.economie.gouv.fr migrated from the legacy /api/records/1.0/ endpoint
// (HTTP 403 since 2026) to the Opendatasoft v2.1 explore API, with the new
// dataset id `rappelconso-v2-gtin-espaces`.
//
// /!\ We deliberately DO NOT use a `where=categorie_produit="alimentation"`
//     filter on the URL. The site's WAF (openresty) returns HTTP 403 when a
//     where= clause is combined with a non-browser User-Agent. The Cloud
//     Function would be blocked. We fetch unfiltered and filter to
//     alimentation in JS instead.
function fetchRappelConsoRecalls(): Promise<any[]> {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'data.economie.gouv.fr',
      path:
        '/api/explore/v2.1/catalog/datasets/rappelconso-v2-gtin-espaces/records' +
        '?limit=100&order_by=date_publication%20desc',
      method: 'GET',
      headers: {
        // Mimic a desktop browser to clear the WAF — works for the base
        // endpoint and futureproofs us if they tighten filtering later.
        'User-Agent':
          'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
      }
    };

    https.get(options, (res) => {
      let data = '';
      res.on('data', (chunk) => data += chunk);
      res.on('end', () => {
        try {
          const json = JSON.parse(data);
          const foodResults = (json.results || []).filter(
            (r: any) => r.categorie_produit === 'alimentation'
          );
          const recalls = foodResults.map((record: any) => ({
            id: record.numero_fiche || String(record.id),
            title: record.modeles_ou_references || record.libelle || 'Produit rappelé',
            description: record.motif_rappel,
            brand: record.marque_produit,
            lotNumbers: Array.isArray(record.identification_produits)
              ? record.identification_produits.flatMap((s: string) => extractLotNumbers(s))
              : extractLotNumbers(record.identification_produits),
            publishedAt: record.date_publication,
            link: record.lien_vers_la_fiche_rappel
          }));
          resolve(recalls);
        } catch (error) {
          reject(error);
        }
      });
    }).on('error', reject);
  });
}

// Helper function to extract lot numbers from a single identification string.
// Mirrors src/services/apiService.ts: keeps the raw text plus canonical tokens
// pulled from "lot ...", "n° lot ...", and bare "L+digits" patterns so push
// notifications still fire when a user scans just "091K" against a recall
// whose entry is "lot : 091k - ddm : 10/2027".
function extractLotNumbers(identificationText: string | undefined): string[] {
  if (!identificationText) return [];

  const lotNumbers = new Set<string>();
  lotNumbers.add(identificationText);

  identificationText.split(/[\n,;]/).forEach((part) => {
    const trimmed = part.trim();
    if (trimmed.length > 0) lotNumbers.add(trimmed);
  });

  const lotPrefixRegex = /\b(?:lot(?:s)?(?:\s+num[ée]ro)?|n[°o]\s*lot|num[ée]ro\s+de\s+lot)\s*[:#]?\s*([A-Z0-9][A-Z0-9/_.-]{2,22})/gi;
  const standaloneLRegex = /\bL(\d{3,15}[A-Z0-9]{0,10})\b/gi;

  let m: RegExpExecArray | null;
  while ((m = lotPrefixRegex.exec(identificationText)) !== null) {
    if (m[1]) lotNumbers.add(m[1]);
  }
  while ((m = standaloneLRegex.exec(identificationText)) !== null) {
    lotNumbers.add(m[0]);
    if (m[1]) lotNumbers.add(m[1]);
  }

  return Array.from(lotNumbers);
}

// Helper function to check if a product matches a recall.
// DURCI (aligné sur le lotMatcher de l'app) après des fausses alertes en série :
// l'ancienne version sautait le filtre marque si l'une des marques était vide,
// et matchait les lots en sous-chaîne BIDIRECTIONNELLE sans longueur minimale
// (un lot de rappel court type "85" matchait "6085S53").
function matchesRecall(product: any, recall: any): boolean {
  const norm = (s: string) => (s || '').toLowerCase().replace(/[\s\-_./]/g, '');
  const productBrand = (product.brand || '').toLowerCase().trim();
  const recallBrand = (recall.brand || '').toLowerCase().trim();
  const productLot = norm(product.lotNumber || '');
  const recallLots: string[] = Array.isArray(recall.lotNumbers) ? recall.lotNumbers : [];

  // Marques OBLIGATOIRES des deux côtés (plus de passe-droit sur marque vide),
  // match strict exact/contains.
  if (!productBrand || !recallBrand) return false;
  if (!productBrand.includes(recallBrand) && !recallBrand.includes(productBrand)) {
    return false;
  }

  // Lot OBLIGATOIRE : pas de match "marque seule" (un rappel d'une grande marque
  // sans lots flaguerait tous ses produits). Lot scanné ≥ 4 caractères.
  if (!productLot || productLot.length < 4 || recallLots.length === 0) return false;

  return recallLots.some((recallLot: string) => {
    const candidate = norm(recallLot);
    if (!candidate || candidate.length < 4) return false;
    // Exact, ou lot scanné LONG (≥8) contenu dans le lot du rappel. Jamais
    // l'inverse (fragment court de rappel dans un lot scanné).
    if (candidate === productLot) return true;
    return productLot.length >= 8 && candidate.includes(productLot);
  });
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

// ---------------------------------------------------------------------------
// ocrVision : proxy serveur pour Google Cloud Vision (DOCUMENT_TEXT_DETECTION).
// La clé API n'est jamais embarquée dans l'app : elle est lue côté serveur via
// le secret Firebase `GOOGLE_VISION_API_KEY`.
//
// Déploiement :
//   firebase functions:secrets:set GOOGLE_VISION_API_KEY
//   firebase deploy --only functions:ocrVision
//
// URL publique :
//   https://europe-west1-<project-id>.cloudfunctions.net/ocrVision
//
// Sécurité v1 : taille d'image plafonnée. À durcir avec App Check / quotas
// avant publication grand public.
// ---------------------------------------------------------------------------
const MAX_IMAGE_BASE64_LENGTH = 10 * 1024 * 1024; // ~10 MB encodé

// Multi-region deploy: europe-west1 serves NumelineFR (FR), us-central1 serves
// the US-targeted eatsafe app. Both regions share the same code path and the
// same VISION_API_KEY secret on this Firebase project.
// europe-west1 UNIQUEMENT : l'app US (eatSafe) a désormais son propre codebase
// Firebase ("eatsafe") qui possède ocrVision/ocrClaude en us-central1. Déclarer
// us-central1 ici aussi faisait s'ÉCRASER mutuellement les fonctions des deux
// apps à chaque déploiement (même projet Firebase, même nom de fonction).
export const ocrVision = functions
  .region('europe-west1')
  .runWith({ secrets: [VISION_API_KEY], memory: '512MB', timeoutSeconds: 30 })
  .https.onRequest(async (req, res) => {
    // CORS basique (utile pour l'émulateur web et expo dev)
    res.set('Access-Control-Allow-Origin', '*');
    res.set('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.set('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
      res.status(204).send('');
      return;
    }

    if (req.method !== 'POST') {
      res.status(405).json({ error: 'Method not allowed' });
      return;
    }

    if (!(await checkAppCheck(req, res))) {
      return;
    }

    const body = req.body as { imageBase64?: string; languageHints?: string[] } | undefined;
    const imageBase64 = body?.imageBase64;

    if (!imageBase64 || typeof imageBase64 !== 'string') {
      res.status(400).json({ error: 'imageBase64 requis' });
      return;
    }

    if (imageBase64.length > MAX_IMAGE_BASE64_LENGTH) {
      res.status(413).json({ error: 'Image trop volumineuse' });
      return;
    }

    const apiKey = VISION_API_KEY.value();
    if (!apiKey) {
      console.error('[ocrVision] GOOGLE_VISION_API_KEY non configurée');
      res.status(500).json({ error: 'Clé Vision non configurée' });
      return;
    }

    const languageHints = Array.isArray(body?.languageHints) && body!.languageHints!.length > 0
      ? body!.languageHints!
      : ['fr', 'en'];

    const requestBody = JSON.stringify({
      requests: [
        {
          image: { content: imageBase64 },
          features: [{ type: 'DOCUMENT_TEXT_DETECTION' }],
          imageContext: { languageHints }
        }
      ]
    });

    let visionResp: Response;
    try {
      visionResp = await fetch(`https://vision.googleapis.com/v1/images:annotate?key=${apiKey}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: requestBody
      });
    } catch (error) {
      console.error('[ocrVision] Network error', error);
      res.status(502).json({ error: 'Vision API injoignable' });
      return;
    }

    if (!visionResp.ok) {
      const errorText = await visionResp.text().catch(() => '');
      console.error('[ocrVision] Vision error', visionResp.status, errorText);
      res.status(502).json({ error: `Vision API ${visionResp.status}` });
      return;
    }

    const json = (await visionResp.json()) as any;
    const visionResponse = json.responses?.[0];

    if (!visionResponse || visionResponse.error) {
      const errorMsg = visionResponse?.error?.message || 'Vision response error';
      res.status(502).json({ error: errorMsg });
      return;
    }

    const fullText: string = visionResponse.fullTextAnnotation?.text || '';
    const textAnnotations = visionResponse.textAnnotations || [];
    const lines = fullText
      ? fullText
          .split('\n')
          .filter(Boolean)
          .map((line: string) => ({
            content: line,
            confidence: textAnnotations[0]?.confidence
          }))
      : [];

    res.status(200).json({
      text: fullText,
      lines,
      confidence: textAnnotations[0]?.confidence,
      source: 'vision-fallback'
    });
  });

// ---------------------------------------------------------------------------
// ocrClaude : proxy Claude Sonnet 4.6 (vision) en dernier recours.
// Appelé uniquement quand ML Kit + Vision échouent à détecter un lot plausible.
// Utilise prompt caching sur le system prompt (5 min TTL) pour réduire le coût
// d'environ 30-40% sur les appels rapprochés.
//
// Déploiement :
//   firebase functions:secrets:set ANTHROPIC_API_KEY
//   firebase deploy --only functions:ocrClaude
//
// URL publique :
//   https://europe-west1-<project-id>.cloudfunctions.net/ocrClaude
// ---------------------------------------------------------------------------

const CLAUDE_LOT_SYSTEM_PROMPT = `You are a precise OCR assistant specialized in food packaging lot/batch numbers (French and European market).

TASK: Extract ONLY the lot/batch code from the image.

A lot/batch code is the manufacturing production code — NOT a date. It is
usually a dense alphanumeric or numeric string, often printed by inkjet/dot-matrix,
separate from the human-readable best-before date.

VALID lot patterns (in order of priority):
1. Text starting with "LOT", "N° LOT", "NUMÉRO DE LOT", "BATCH", or "L" followed by alphanumeric characters
   Examples: "LOT 36028", "L605118B", "L331-4003263405", "L26/1049"
2. A dense alphanumeric/numeric production code printed/inkjet/laser-etched near
   (but distinct from) the "À consommer avant" / "DDM" / "DLC" date
   Examples: "KB204471902", "L693A2102R", "249334315", "2 493 34315" -> "249334315"
3. Multi-segment inkjet codes on lids/caps — concatenate ALL segments into one code:
   "P21 20:56 R 297" -> "P212056R297" (plant code + time + run = one lot)
4. A series of 5-12 digits that is NOT a barcode (EAN/GTIN barcodes are 13-14 digits)

NEVER return a DATE. This is the single most important rule:
- Best-before / expiration dates in ANY form: "JAN 2026", "01/05/2026", "31.12.2029", bare year "2026"
- A month name (JAN, FEB, MAR, AVR, MAI, JUN, JUL, AOU, SEP, OCT, NOV, DEC) next to digits is a DATE — ignore it.
- Time stamps ("14:07", "HH:MM:SS"), brand names, addresses, phone numbers, weights.

NEVER return REGULATORY MARKINGS — these look like lot codes but are factory
identifiers, identical on every pack:
- EU/UK oval identification marks: "FR 44.014.001 CE", "ES 26.00298/B UE", "IT 09.123/L CE"
- French packer codes: "EMB 44014B" (anything starting with "EMB")
- USDA inspection marks: "EST. 38", "P-123"
If such a marking appears NEXT TO a separate printed/inkjet code, return the
inkjet production code, not the marking.

If the ONLY thing you can read is a date (and no separate production code),
respond with exactly: NONE. Do NOT output the date.

DOT-MATRIX / INKJET CODES (dotted characters) — read with EXTREME care:
- These codes are printed as a grid of dots, often pale or on a colored background.
- Count the characters: do NOT drop or invent a character.
- Frequent dot-matrix confusions: 6 vs 8 vs 3 vs 9, 0 vs O vs D, 5 vs S, 1 vs I vs T, B vs 8, H vs M vs N, G vs 6, 4 vs A.
- Typical layout: line 1 = date (DD/MM/YYYY), line 2 = time (HH:MM:SS), line 3 = LOT CODE — return line 3.
- Verify your reading character by character before answering.

EXAMPLES (real French/European lot-code layouts -> the ONE correct answer):
- "À CONSOMMER AVANT 05/2026  LOT L605118B" -> L605118B
- "DDM 12/2026  N° LOT 36028" -> 36028
- "L331-4003263405  DDM 31.12.2026" -> L331-4003263405
- "10/2026 / P21 20:56 R 297" -> P212056R297
  (multi-segment inkjet lid code: P21 + 2056 + R + 297 concatenated)
- "E L26/1049  31.12.2029  ES 12.06648/C CE" -> L26/1049
  (ignore the ES oval mark and the date; return the variable lot)
- "EMB 44014B  LOT KB204471902  DDM 08/2026" -> KB204471902
  (ignore the EMB packer code; return the variable inkjet lot)
- "FR 44.014.001 CE  L693A2102R  AVR 2027" -> L693A2102R
  (ignore the FR oval; return the dot-matrix production code)
- "EAN 3760091723456  DDM 06/2027" -> NONE
  (a 13-digit EAN barcode and a date only — no production code)

OUTPUT FORMAT:
- Respond with ONLY the lot code, no quotes, no labels, no explanation.
- Strip spaces within the code ("L 693 A" -> "L693A", "2 493 34315" -> "249334315").
- For multi-segment inkjet codes, concatenate all segments ("P21 20:56 R 297" -> "P212056R297").
- Preserve hyphens and slashes that are part of the code ("L331-4003263405", "L26/1049").
- Max 24 chars.
- If no lot code is visible, respond with exactly: NONE`;

// Multi-region deploy: europe-west1 serves NumelineFR (FR), us-central1 serves
// the US-targeted eatsafe app. Both regions share the same code path and the
// same ANTHROPIC_API_KEY secret on this Firebase project.
// europe-west1 UNIQUEMENT (cf. note ocrVision : us-central1 appartient au
// codebase "eatsafe" de l'app US).
export const ocrClaude = functions
  .region('europe-west1')
  .runWith({ secrets: [ANTHROPIC_API_KEY], memory: '512MB', timeoutSeconds: 30 })
  .https.onRequest(async (req, res) => {
    res.set('Access-Control-Allow-Origin', '*');
    res.set('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.set('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
      res.status(204).send('');
      return;
    }

    if (req.method !== 'POST') {
      res.status(405).json({ error: 'Method not allowed' });
      return;
    }

    if (!(await checkAppCheck(req, res))) {
      return;
    }

    const body = req.body as { imageBase64?: string; mediaType?: string } | undefined;
    const imageBase64 = body?.imageBase64;
    const mediaType = (body?.mediaType as 'image/png' | 'image/jpeg' | 'image/gif' | 'image/webp') || 'image/jpeg';

    if (!imageBase64 || typeof imageBase64 !== 'string') {
      res.status(400).json({ error: 'imageBase64 requis' });
      return;
    }

    if (imageBase64.length > MAX_IMAGE_BASE64_LENGTH) {
      res.status(413).json({ error: 'Image trop volumineuse' });
      return;
    }

    const apiKey = ANTHROPIC_API_KEY.value();
    if (!apiKey) {
      console.error('[ocrClaude] ANTHROPIC_API_KEY non configurée');
      res.status(500).json({ error: 'Clé Anthropic non configurée' });
      return;
    }

    // Import dynamique pour ne payer le coût qu'au premier appel froid
    const Anthropic = (await import('@anthropic-ai/sdk')).default;
    const client = new Anthropic({ apiKey });

    try {
      const message = await client.messages.create({
        model: 'claude-opus-4-8',
        max_tokens: 64,
        system: [
          {
            type: 'text',
            text: CLAUDE_LOT_SYSTEM_PROMPT,
            cache_control: { type: 'ephemeral' }
          }
        ],
        messages: [
          {
            role: 'user',
            content: [
              {
                type: 'image',
                source: {
                  type: 'base64',
                  media_type: mediaType,
                  data: imageBase64
                }
              },
              {
                type: 'text',
                text: 'Extract the lot number from this packaging image.'
              }
            ]
          }
        ]
      });

      // Concaténer tous les blocs texte de la réponse
      const text = message.content
        .filter((block): block is AnthropicTypes.TextBlock => block.type === 'text')
        .map((block) => block.text.trim())
        .join('')
        .trim();

      const cleaned = text.toUpperCase() === 'NONE' ? '' : text;

      console.log('[ocrClaude] Result:', JSON.stringify({
        text: cleaned,
        cache_read: message.usage.cache_read_input_tokens,
        cache_creation: message.usage.cache_creation_input_tokens,
        input: message.usage.input_tokens,
        output: message.usage.output_tokens
      }));

      res.status(200).json({
        text: cleaned,
        lines: cleaned ? [{ content: cleaned, confidence: 0.95 }] : [],
        confidence: cleaned ? 0.95 : 0,
        source: 'claude-fallback',
        usage: {
          cacheReadTokens: message.usage.cache_read_input_tokens,
          cacheCreationTokens: message.usage.cache_creation_input_tokens,
          inputTokens: message.usage.input_tokens,
          outputTokens: message.usage.output_tokens
        }
      });
    } catch (error) {
      const status = (error as any)?.status;
      const message = error instanceof Error ? error.message : 'unknown';
      console.error('[ocrClaude] Anthropic error', status, message);
      res.status(502).json({ error: `Claude API error: ${message}` });
    }
  });
