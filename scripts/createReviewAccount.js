// Crée (ou réutilise) le compte démo "store reviewer" et lui force un accès
// premium via le doc Firestore users/{uid}.subscription.overridePremium = true.
//
// Usage : node scripts/createReviewAccount.js
//
// Le compte sert aux équipes de revue Apple / Google Play (login requis).
// NE PAS supprimer ce compte : les stores le réutilisent à chaque mise à jour.

const admin = require('firebase-admin');

// --- Identifiants du compte (override via args : node scripts/createReviewAccount.js <email> <password> [displayName]) ---
const REVIEW_EMAIL = process.argv[2] || 'review@numeline.app';
const REVIEW_PASSWORD = process.argv[3] || 'NumelineReview2026!';
const DISPLAY_NAME = process.argv[4] || 'Store Reviewer';

try {
  const serviceAccount = require('../firebase-admin-key.json');
  admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
} catch (error) {
  console.error('❌ firebase-admin-key.json introuvable à la racine du projet.');
  process.exit(1);
}

const auth = admin.auth();
const db = admin.firestore();

async function getOrCreateUser() {
  try {
    const existing = await auth.getUserByEmail(REVIEW_EMAIL);
    console.log(`ℹ️  Compte déjà existant — UID: ${existing.uid}`);
    // S'assurer que le mot de passe et la vérification sont à jour
    await auth.updateUser(existing.uid, {
      password: REVIEW_PASSWORD,
      emailVerified: true,
      displayName: DISPLAY_NAME,
    });
    console.log('   Mot de passe réinitialisé + email marqué vérifié.');
    return existing.uid;
  } catch (err) {
    if (err.code === 'auth/user-not-found') {
      const created = await auth.createUser({
        email: REVIEW_EMAIL,
        password: REVIEW_PASSWORD,
        displayName: DISPLAY_NAME,
        emailVerified: true,
      });
      console.log(`✅ Compte créé — UID: ${created.uid}`);
      return created.uid;
    }
    throw err;
  }
}

async function main() {
  const uid = await getOrCreateUser();

  const subscription = {
    overridePremium: true,   // accès reviewer forcé, non écrasé par l'IAP
    isPremium: true,
    planType: 'enterprise',  // limite de scans la plus haute (500)
    // IMPORTANT : l'app dérive le planType depuis productId (AppInitializer),
    // PAS depuis le champ planType. Sans un productId enterprise, le compte
    // retombe en 'free' (5 scans). On met donc l'ID de l'abonnement le plus gros.
    productId: 'com.numeline.app.enterprise_yearly',
    purchaseToken: null,
    bonusScans: 0,           // NOMBRE, pas string
    expiresAt: null,
    updatedAt: Date.now(),
  };

  await db.collection('users').doc(uid).set({ subscription }, { merge: true });

  console.log('\n✅ Document Firestore écrit : users/' + uid);
  console.log('   subscription =', JSON.stringify(subscription, null, 2));
  console.log('\n──────────── À reporter dans App Store Connect / Play Console ────────────');
  console.log('   Nom d’utilisateur :', REVIEW_EMAIL);
  console.log('   Mot de passe      :', REVIEW_PASSWORD);
  console.log('──────────────────────────────────────────────────────────────────────────');

  process.exit(0);
}

main().catch((err) => {
  console.error('❌ Erreur:', err);
  process.exit(1);
});
