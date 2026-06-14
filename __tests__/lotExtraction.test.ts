/**
 * Corpus de RÉGRESSION pour l'extraction de numéro de lot.
 *
 * Chaque cas vient d'un produit RÉEL photographié en test terrain. On reconstitue
 * le texte tel que l'OCR (ML Kit / Vision / Claude) le restitue, puis on vérifie
 * que `extractLotNumber` :
 *   - renvoie le VRAI lot quand un signal fort existe (mot LOT, code "L…"), et
 *   - ne renvoie JAMAIS le faux positif historique (code-barres, date collée,
 *     ovale sanitaire UE, vocabulaire d'étiquette, poids).
 *
 * C'est l'équivalent "entraînement" d'un extracteur à règles : il fige le
 * comportement attendu pour qu'un correctif futur ne régresse pas un cas déjà
 * traité. L'OCR lui-même (ML Kit/Vision/Claude) n'est pas entraînable ; seule
 * cette couche d'extraction l'est, via ces cas.
 *
 * NB : les misreads purs (Vico "600TE", Métral "168027" au lieu de "168052")
 * sont des erreurs de LECTURE OCR, pas d'extraction — ils ne figurent pas ici
 * car on ne peut pas les reproduire à partir d'un texte propre.
 */

// L'extraction est pure, mais le module importe des dépendances natives au
// chargement. On les neutralise — aucune n'est appelée par extractLotNumber()
// sans `brand`.
jest.mock('@react-native-ml-kit/text-recognition', () => ({ __esModule: true, default: { recognize: jest.fn() } }));
jest.mock('expo-image-manipulator', () => ({ manipulateAsync: jest.fn(), SaveFormat: { PNG: 'png', JPEG: 'jpeg' } }));
jest.mock('expo-file-system/legacy', () => ({ readAsStringAsync: jest.fn(), deleteAsync: jest.fn(), EncodingType: { Base64: 'base64' } }));
jest.mock('../src/services/firestoreBrandsService', () => ({ searchBrands: jest.fn(async () => []) }));
jest.mock('../src/services/visionFallbackService', () => ({
  tryVisionFallback: jest.fn(),
  runVisionFallback: jest.fn(),
  isVisionAvailable: jest.fn(() => false),
  assessOcrQuality: jest.fn()
}));
jest.mock('../src/services/appCheckService', () => ({ getAppCheckToken: jest.fn(async () => null) }));

import { extractLotNumber, looksLikeNonLot } from '../src/services/ocrService';

// Cas "le vrai lot doit sortir" — un signal fort est présent.
const MUST_EXTRACT: Array<{ name: string; ocr: string; expected: string }> = [
  {
    name: 'Ferrero Nutella biscuits (L collé)',
    ocr: '10 10 2026 04:09\nL058201---6\n75321493',
    expected: 'L058201'
  },
  {
    name: 'La Vie (mot LOT explicite)',
    ocr: '24/06/2026\nLOT: 147100 10210740\n13:42',
    expected: '147100'
  },
  {
    name: 'Hari&co (LOT collé à des chiffres)',
    ocr: '07/07/2026 MD\nLOT:1531 14:24:24',
    expected: '1531'
  },
  {
    name: 'U sirop framboise — date aplatie collée au lot (cas réel Claude)',
    ocr: '0220282009L605118B',
    expected: 'L605118B'
  }
];

// Cas "ne JAMAIS renvoyer ce faux positif" — les 4 familles corrigées.
const MUST_NOT_RETURN: Array<{ name: string; ocr: string; forbidden: RegExp }> = [
  {
    name: 'U céréales — vocabulaire "Dosage : 45 g"',
    ocr: 'Dosage : 45 g de céréales dans un bol\n16/03/2027\n16106 031\n23:41',
    forbidden: /DOSAGE/
  },
  {
    name: 'U thon — poids multiplié "3 x 115 g"',
    ocr: 'Poids net : 345 g (3 x 115 g)\nE L26/1049 31.12.2029\n00713',
    forbidden: /^3X115G$/
  },
  {
    name: 'Aqualis — "sous conservation à -18°C"',
    ocr: 'à consommer de préférence avant fin (sous conservation à -18°C)\nLot n°:\n01/2028\n47306',
    forbidden: /SERVATION/
  },
  {
    name: 'Beignets — ovale sanitaire "ES 26.00298/B UE"',
    ocr: 'Numéro de Lot :\n36028 11:44\n06/2027\nES 26.00298/B UE',
    forbidden: /00298/
  },
  {
    name: 'Ethiquable lentilles — code-barres collé',
    ocr: 'N° lot / à consommer avant le :\n25/03/28\n26084/11:31\n3760091726568',
    forbidden: /60091726568/
  },
  {
    name: 'Andric saumon — code-barres EAN-13',
    ocr: 'N° Lot:\n03720\n2469431099973',
    forbidden: /469431099973/
  },
  {
    name: 'Poisson surgelé — date "2028/" collée au lot',
    ocr: 'Produit congelé le : / à consommer avant le : / N° de lot :\n05-02-2025 /\n05-02-2028 / 26104176',
    forbidden: /2028\/26104176/
  }
];

describe('extractLotNumber — corpus de régression terrain', () => {
  describe('doit extraire le vrai lot (signal fort)', () => {
    for (const c of MUST_EXTRACT) {
      it(c.name, async () => {
        const got = await extractLotNumber(c.ocr);
        expect(got.toUpperCase()).toBe(c.expected.toUpperCase());
      });
    }
  });

  describe('ne doit jamais renvoyer le faux positif historique', () => {
    for (const c of MUST_NOT_RETURN) {
      it(c.name, async () => {
        const got = (await extractLotNumber(c.ocr)).toUpperCase();
        expect(got).not.toMatch(c.forbidden);
      });
    }
  });
});

describe('looksLikeNonLot — garde-fous unitaires', () => {
  it.each([
    '3X115G', '3 X 115 G',                   // conditionnement multiplié (réel)
    '3760091726568', '60091726568LE',        // code-barres EAN / fragment
    '45G', '500ML', '12:34', '16/03/2027'    // poids / heure / date
  ])('rejette "%s"', (token) => {
    expect(looksLikeNonLot(token)).toBe(true);
  });

  it.each(['L058201', '147100', 'L605118B', '615E2VSN', 'L013204'])(
    'accepte le vrai lot "%s"',
    (token) => {
      expect(looksLikeNonLot(token)).toBe(false);
    }
  );
});
