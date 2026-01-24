# Consommation de Données - Vérification Horaire des Rappels

## 📊 Estimation de la Consommation de Données

### Cloud Function (Serveur Firebase)
La vérification horaire s'exécute **sur les serveurs Firebase**, PAS sur le téléphone de l'utilisateur.

**✅ Impact sur le forfait téléphonique : MINIMAL**

### Détail de la Consommation Mobile

#### 1. **Vérification automatique (Cloud Function)**
- **Fréquence** : Toutes les heures (24 fois par jour)
- **Lieu d'exécution** : Serveurs Firebase ☁️
- **Consommation mobile** : **0 KB** (ne consomme pas le forfait utilisateur)

#### 2. **Notification Push (FCM)**
Quand un rappel est détecté :
- **Taille d'une notification** : ~1-2 KB
- **Fréquence** : Uniquement si un produit scanné est rappelé
- **Consommation** : Quasi-nulle (les notifications push utilisent très peu de data)

#### 3. **Utilisation manuelle de l'app**
L'utilisateur consomme de la data uniquement quand il :
- Scanne un nouveau produit : ~50-100 KB (requête API)
- Ouvre l'historique : ~10-20 KB (si données Firestore)
- Rafraîchit les données : ~50-100 KB

---

## 📈 Estimation Mensuelle

### Scénario Passif (utilisateur ne fait rien)
| Action | Fréquence | Data |
|--------|-----------|------|
| Cloud Function | 24/jour × 30 jours | **0 KB** |
| Notifications reçues | 0-5/mois | ~5-10 KB |
| **TOTAL** | | **~5-10 KB/mois** |

### Scénario Actif (5 scans/semaine)
| Action | Fréquence | Data |
|--------|-----------|------|
| Cloud Function | 24/jour × 30 jours | **0 KB** |
| Scans produits | 20/mois | ~1-2 MB |
| Notifications | 0-5/mois | ~5-10 KB |
| Ouverture app | 20/mois | ~200-400 KB |
| **TOTAL** | | **~1.5-2.5 MB/mois** |

---

## 💡 Optimisations Implémentées

### 1. **Vérification côté serveur**
✅ La Cloud Function s'exécute sur Firebase (Google Cloud)
✅ Aucune consommation de data sur le téléphone de l'utilisateur

### 2. **Notifications Push optimisées**
✅ Utilise FCM (Firebase Cloud Messaging)
✅ Taille minimale : ~1-2 KB par notification
✅ Envoyées uniquement en cas de rappel détecté

### 3. **Pagination API**
✅ Limite de 100 rappels par requête (au lieu de tous)
✅ Requête effectuée depuis le serveur, pas depuis le mobile

### 4. **Cache local**
✅ L'app stocke les données localement (SQLite)
✅ Réduit les appels API répétés

---

## 🎯 Conclusion

### Pour l'utilisateur moyen :
- **Consommation mensuelle** : ~1.5-2.5 MB
- **Équivalent** : Charger 2-3 pages web simples
- **Impact sur forfait** : Négligeable (< 0.01% d'un forfait 20 GB)

### Comparaison :
| Application | Consommation/mois |
|-------------|-------------------|
| **Eats OK** | 1.5-2.5 MB |
| Instagram (usage léger) | 500-1000 MB |
| WhatsApp (usage léger) | 100-300 MB |
| Gmail (usage léger) | 50-100 MB |

---

## ⚙️ Comment fonctionne la vérification horaire ?

```
┌─────────────────┐
│ Firebase Cloud  │  ← Toutes les heures
│   Function      │
└────────┬────────┘
         │
         ├─> 1. Interroge API Rappel Conso (serveur Firebase)
         │
         ├─> 2. Compare avec produits scannés (Firestore)
         │
         └─> 3. Si correspondance → Envoie notification push (1-2 KB)
                 │
                 v
         ┌───────────────┐
         │  Téléphone    │  ← Reçoit notification (1-2 KB)
         │  utilisateur  │
         └───────────────┘
```

**La majeure partie du travail se fait sur les serveurs Firebase, PAS sur le téléphone !**

---

## 📱 Recommandations

### Pour réduire encore la consommation :
1. ✅ **Déjà implémenté** : Vérification côté serveur
2. ✅ **Déjà implémenté** : Notifications push légères
3. ✅ **Déjà implémenté** : Cache local (SQLite)
4. 🔄 **Optionnel** : Permettre à l'utilisateur de désactiver les notifications

### Coût Firebase (pour développeur) :
- **Cloud Functions** : ~0.40€/million d'invocations
- **24 vérifications/jour** = 720/mois = ~0.0003€/mois
- **FCM Notifications** : Gratuit (usage illimité)

---

**✅ Conclusion finale : La vérification horaire consomme TRÈS PEU de data mobile (<3 MB/mois) et la majorité du traitement se fait côté serveur Firebase.**
