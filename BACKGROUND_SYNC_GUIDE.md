# Guide - Vérification Automatique des Rappels

## 🎯 Fonctionnement

L'application vérifie **automatiquement toutes les heures** si vos produits scannés ont été rappelés.

### Comment ça marche ?

```
┌──────────────────────────────────┐
│  📱 Téléphone (stockage local)   │
│                                  │
│  ┌────────────────────────────┐ │
│  │  Base de données SQLite    │ │
│  │  - Produits scannés        │ │
│  │  - Marques et n° de lot    │ │
│  └────────────────────────────┘ │
│              ↓                   │
│  ┌────────────────────────────┐ │
│  │  Tâche de fond (1h)        │ │
│  │  ↓ Interroge API Rappel    │ │
│  │  ↓ Compare avec scans      │ │
│  │  ↓ Envoie notification     │ │
│  └────────────────────────────┘ │
└──────────────────────────────────┘
```

## ✅ Ce qui a été implémenté

### 1. **Vérification automatique locale**
- ⏰ **Fréquence** : Toutes les heures
- 📦 **Données** : Stockées localement (SQLite)
- 🔒 **Vie privée** : Rien n'est envoyé sur le cloud
- 🔋 **Batterie** : Optimisé pour économiser la batterie

### 2. **Notifications avec logo**
- 🎨 **Logo numelineFR** : Affiché dans la notification
- 🔊 **Son** : Notification sonore
- 🚨 **Priorité haute** : Pour les rappels importants
- 📱 **Badge** : Indicateur sur l'icône de l'app

### 3. **Gestion intelligente**
- ✅ Ne notifie que pour les **nouveaux** rappels
- ✅ Met à jour le statut en arrière-plan
- ✅ Fonctionne même si l'app est fermée
- ✅ Démarre automatiquement au démarrage du téléphone

## 📊 Consommation de Données

### Par vérification (toutes les heures)
- **API Rappel Conso** : ~10-15 KB
- **Traitement local** : 0 KB (SQLite local)

### Par jour (24 vérifications)
- **Total** : ~240-360 KB/jour
- **Équivalent** : 1-2 photos Instagram compressées

### Par mois
- **Total** : ~7-11 MB/mois
- **% d'un forfait 20 GB** : < 0.1%

### Optimisations
✅ Utilise `minimumInterval` (Android optimise l'exécution)
✅ Requêtes API limitées à 100 rappels récents
✅ Cache local pour éviter requêtes inutiles
✅ Aucune synchronisation cloud

## 🔧 Configuration

### Permissions Android
```json
"android.permission.RECEIVE_BOOT_COMPLETED"  → Démarrage automatique
```

### Paramètres de la tâche de fond
```typescript
minimumInterval: 60 * 60  // 1 heure (3600 secondes)
stopOnTerminate: false    // Continue après fermeture app
startOnBoot: true         // Démarre au boot du téléphone
```

## 📬 Format des Notifications

### Titre
```
⚠️ Rappel produit détecté
```

### Corps
```
[Nom du produit] fait l'objet d'un rappel sanitaire.
```

### Données incluses
- Type : `recall`
- ID du produit
- ID du rappel
- Marque
- Numéro de lot

### Apparence
- ✅ Logo numelineFR
- ✅ Couleur verte (#0BAE86)
- ✅ Son de notification
- ✅ Priorité haute
- ✅ Badge sur l'icône

## 🧪 Tests

### Test manuel
Pour tester immédiatement sans attendre 1 heure :

1. Scanner un produit dans l'app
2. Ouvrir les paramètres développeur Android
3. Forcer l'exécution de la tâche de fond
4. Vérifier les logs dans Logcat

### Logs à surveiller
```
[BackgroundSync] Starting recall check...
[BackgroundSync] Found X scanned products
[BackgroundSync] Fetched Y recalls from API
[BackgroundSync] New recall detected for [brand] - [lot]
[BackgroundSync] Notification sent for [brand]
[BackgroundSync] Complete in Xms - Y notifications sent
```

## ⚡ Optimisations Android

Android peut ajuster la fréquence réelle selon :
- 🔋 Niveau de batterie
- 📡 Connexion réseau
- ⚙️ Mode économie d'énergie
- 📊 Utilisation de l'app

**Note** : L'intervalle de 1 heure est un **minimum**. Android peut espacer les vérifications pour économiser la batterie.

## 🐛 Dépannage

### La tâche ne s'exécute pas
1. Vérifier que l'app n'est pas en mode "Économie de batterie stricte"
2. Autoriser l'exécution en arrière-plan dans les paramètres
3. Vérifier les permissions

### Pas de notification
1. Vérifier que les notifications sont autorisées
2. Vérifier le canal de notification "recall-alerts"
3. Vérifier les logs pour voir si un rappel a été détecté

### Consommation data excessive
1. Vérifier les logs de fréquence d'exécution
2. Android devrait respecter le `minimumInterval`
3. Vérifier qu'il n'y a pas de doublons de tâches

## 📱 Commandes utiles

### Vérifier l'état de la tâche
```typescript
await TaskManager.isTaskRegisteredAsync('recall-background-sync');
```

### Désactiver la tâche
```typescript
await unregisterBackgroundTask();
```

### Forcer une exécution (développement)
```bash
adb shell cmd jobscheduler run -f com.numelinefr.app <job-id>
```

## ✨ Avantages de cette solution

| Critère | Résultat |
|---------|----------|
| **Vie privée** | ✅ Données 100% locales |
| **Coût** | ✅ Gratuit (pas de serveur) |
| **Batterie** | ✅ Optimisé par Android |
| **Data mobile** | ✅ ~10 MB/mois |
| **Fiabilité** | ✅ Indépendant du cloud |
| **Temps réel** | ⚠️ Max 1h de délai |

---

**🎉 Les utilisateurs recevront automatiquement une notification avec le logo numelineFR dès qu'un produit scanné est rappelé !**
