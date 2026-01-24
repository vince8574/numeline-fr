# Guide de test sur téléphone

## 📱 Méthodes de connexion

### Option 1 : Expo Go (rapide mais limité)

✅ **Fonctionne :**
- Scan et OCR
- Autocomplete des marques
- Saisie manuelle
- Base de données
- Interface RecallAlert

❌ **Ne fonctionne PAS :**
- Notifications push
- Tâches en arrière-plan

**Instructions :**
```bash
# 1. Installer Expo Go sur votre téléphone
# Android: Play Store → "Expo Go"
# iOS: App Store → "Expo Go"

# 2. Démarrer le serveur
npm start

# 3. Scanner le QR code
# Android: Avec l'app Expo Go
# iOS: Avec l'appareil photo, puis ouvrir dans Expo Go
```

---

### Option 2 : Build de développement (RECOMMANDÉ - tout fonctionne)

✅ **Tout fonctionne !**
- Notifications push ✨
- Tâches en arrière-plan ✨
- Toutes les fonctionnalités natives ✨

#### Android (USB)

**Prérequis :**
- Câble USB
- Mode développeur activé sur le téléphone

**Étapes :**

1. **Activer le mode développeur sur votre téléphone :**
   ```
   Paramètres
   → À propos du téléphone
   → Appuyez 7 fois sur "Numéro de build"
   → Retour aux Paramètres
   → Options pour les développeurs
   → Activer "Débogage USB"
   ```

2. **Brancher le téléphone en USB**
   - Accepter le message "Autoriser le débogage USB ?"

3. **Vérifier la connexion :**
   ```bash
   adb devices
   # Doit afficher votre appareil
   ```

4. **Installer l'app (première fois) :**
   ```bash
   # Générer les fichiers natifs
   npx expo prebuild

   # Installer sur le téléphone
   npx expo run:android
   ```
   ⏱️ Cette étape prend 10-15 minutes la première fois

5. **Pour les sessions suivantes :**
   ```bash
   npm start
   # L'app se reconnectera automatiquement
   ```

#### iOS (USB - nécessite un Mac)

```bash
# 1. Brancher l'iPhone en USB

# 2. Première installation
npx expo prebuild
npx expo run:ios

# 3. Sessions suivantes
npm start
```

---

## 🧪 Comment tester les fonctionnalités

### Test 1 : Scan et reconnaissance de marques

1. Lancer l'app
2. Aller dans l'onglet "Scan"
3. Pointer vers un emballage alimentaire
4. L'app devrait :
   - ✅ Détecter la marque parmi les 800
   - ✅ Proposer des suggestions si non reconnue
   - ✅ Extraire le numéro de lot

**Marques à tester :**
- Danone
- Président
- Nestlé
- Lu
- Coca-Cola

### Test 2 : Saisie manuelle avec autocomplete

1. Aller dans l'onglet "Saisie manuelle"
2. Taper "Dan" dans le champ Marque
3. Vérifier que l'autocomplete propose :
   - Danone
   - Danonino
   - Danette
4. Sélectionner une marque
5. Entrer un numéro de lot
6. Enregistrer

### Test 3 : Ajout d'une nouvelle marque

1. Saisie manuelle
2. Taper une marque qui n'existe pas : "Ma Marque Test"
3. Cliquer sur "+ Ajouter comme nouvelle marque"
4. Confirmer
5. La marque apparaît maintenant dans les suggestions

### Test 4 : Notifications (BUILD NATIF UNIQUEMENT)

**Accéder à l'écran de test :**
```
Dans votre navigateur (pendant que npm start tourne) :
http://localhost:8081/test-notifications
```

Ou ajouter un bouton dans l'app pour naviguer vers `/test-notifications`

**Sur l'écran de test :**

1. Sélectionner un type de rappel
2. Appuyer sur "Envoyer la notification"
3. Vérifier :
   - ✅ La notification apparaît
   - ✅ Le titre est "🚨 ALERTE PRODUIT CONTAMINÉ"
   - ✅ Le message contient la raison
   - ✅ Les numéros 15 et 112 sont mentionnés
4. Taper sur la notification
5. L'app devrait s'ouvrir

**Types de notifications à tester :**
- Salmonelles (gravité élevée)
- Listeria (gravité élevée)
- Allergène (gravité moyenne)
- Verre (gravité élevée)

### Test 5 : Écran de détails avec alerte

1. Créer un produit rappelé (via l'écran de test)
2. Aller dans "Historique"
3. Ouvrir le produit rappelé
4. Vérifier :
   - ✅ Alerte rouge en haut de l'écran
   - ✅ Titre "PRODUIT CONTAMINÉ"
   - ✅ Raison du rappel affichée
   - ✅ Message "NE PAS CONSOMMER"
   - ✅ Bouton "Appeler le 15 (SAMU)"
   - ✅ Bouton "Appeler le 112 (Urgences)"

5. **ATTENTION** : Ne cliquez PAS sur les boutons d'appel sauf si vous êtes en mode avion !

### Test 6 : Appel d'urgence (EN MODE AVION)

1. **Activer le mode avion sur le téléphone**
2. Ouvrir un produit rappelé
3. Taper sur "Appeler le 15"
4. Vérifier que l'interface d'appel s'ouvre avec le numéro 15
5. **Raccrocher immédiatement** (mode avion = pas d'appel réel)

---

## 🔍 Checklist complète

### Fonctionnalités de base
- [ ] Scan d'emballage
- [ ] OCR de la marque
- [ ] OCR du numéro de lot
- [ ] Reconnaissance parmi 800 marques
- [ ] Saisie manuelle
- [ ] Autocomplete des marques
- [ ] Ajout d'une nouvelle marque
- [ ] Sauvegarde en base de données
- [ ] Historique des scans
- [ ] Suppression d'un scan

### Système de rappel
- [ ] Vérification des rappels
- [ ] Statut "Rappelé" affiché en rouge
- [ ] Statut "Sécuritaire" affiché en vert
- [ ] RecallAlert visible sur produit rappelé
- [ ] Raison du rappel extraite
- [ ] Boutons d'urgence présents
- [ ] Lien vers fiche officielle

### Notifications (BUILD NATIF)
- [ ] Permission demandée au lancement
- [ ] Notification envoyée lors d'un rappel
- [ ] Titre "ALERTE PRODUIT CONTAMINÉ"
- [ ] Raison dans le corps du message
- [ ] Message "NE PAS CONSOMMER"
- [ ] Numéros 15 et 112 mentionnés
- [ ] Tap sur notification → ouvre l'app
- [ ] Son et vibration activés

### Interface
- [ ] Dark mode fonctionne
- [ ] Light mode fonctionne
- [ ] Couleurs d'alerte bien visibles
- [ ] Texte lisible
- [ ] Boutons accessibles
- [ ] Scroll fluide
- [ ] Animations fluides

---

## 🐛 Dépannage

### "adb: command not found"
```bash
# Installer Android Studio et ajouter au PATH
# Ou installer adb séparément
```

### "No devices found"
1. Vérifier que le câble USB fonctionne
2. Réactiver le débogage USB
3. Essayer un autre port USB
4. Redémarrer adb :
   ```bash
   adb kill-server
   adb start-server
   ```

### "App keeps crashing"
```bash
# Nettoyer et rebuilder
npx expo prebuild --clean
npx expo run:android
```

### "Notifications ne s'affichent pas"
1. Vérifier que vous N'ÊTES PAS dans Expo Go
2. Vérifier les permissions :
   ```
   Paramètres → Apps → EatSafe → Notifications
   → Activer les notifications
   ```
3. Redémarrer l'app
4. Réessayer d'envoyer une notification

### "Metro bundler ne se connecte pas"
1. Vérifier que téléphone et PC sont sur le même WiFi
2. Ou utiliser le mode USB :
   ```bash
   adb reverse tcp:8081 tcp:8081
   npm start
   ```

---

## 📊 Scénarios de test recommandés

### Scénario 1 : Premier scan
```
1. Lancer l'app
2. Accepter les permissions caméra
3. Scanner un produit Danone
4. Vérifier que "Danone" est détecté
5. Confirmer le scan
6. Vérifier dans l'historique
```

### Scénario 2 : Produit non reconnu
```
1. Scanner un produit de marque inconnue
2. La marque n'est pas reconnue
3. Saisir manuellement
4. Utiliser l'autocomplete
5. Ou ajouter une nouvelle marque
6. Enregistrer
```

### Scénario 3 : Rappel détecté
```
1. (En build natif) Aller sur /test-notifications
2. Envoyer une notification de rappel Salmonelles
3. Notification apparaît
4. Taper dessus
5. App s'ouvre sur l'alerte rouge
6. Lire les informations
7. (Mode avion) Tester les boutons d'appel
```

### Scénario 4 : Gestion de l'historique
```
1. Scanner plusieurs produits
2. Aller dans l'historique
3. Vérifier que tous sont là
4. Ouvrir les détails d'un produit
5. Supprimer un produit
6. Vérifier qu'il disparaît de l'historique
```

---

## ⏱️ Temps estimés

| Étape | Temps |
|-------|-------|
| Installation Expo Go | 2 min |
| Premier test avec Expo Go | 1 min |
| Setup build natif Android | 15-30 min (première fois) |
| Rebuilds suivants | 2-5 min |
| Test complet des fonctionnalités | 20-30 min |

---

## 📝 Notes importantes

1. **Expo Go vs Build natif :**
   - Expo Go = test rapide sans notifications
   - Build natif = test complet avec toutes les fonctionnalités

2. **Notifications :**
   - NE FONCTIONNENT PAS dans Expo Go
   - Nécessitent un build natif
   - Nécessitent les permissions

3. **Appels d'urgence :**
   - Testez en mode avion !
   - Ne composez pas réellement le 15/112
   - Vérifiez juste que l'interface d'appel s'ouvre

4. **Performance :**
   - Le premier build est lent (15-30 min)
   - Les rebuilds sont beaucoup plus rapides
   - Le hot reload fonctionne après le build

5. **Base de données :**
   - Persistante entre les sessions
   - Pour reset : désinstaller et réinstaller l'app

---

## 🎯 Ce que vous devriez voir

### Notification de rappel
```
┌─────────────────────────────────┐
│ EatSafe                         │
│ 🚨 ALERTE PRODUIT CONTAMINÉ     │
│                                 │
│ ⚠️ Danone - Lot L12345          │
│ Raison: Présence de salmonelles│
│                                 │
│ 🚫 NE PAS CONSOMMER             │
│ En cas de consommation,         │
│ contactez les urgences          │
│ (15 ou 112)                     │
└─────────────────────────────────┘
```

### Écran d'alerte
```
┌─────────────────────────────────┐
│         🚨                      │
│   PRODUIT CONTAMINÉ             │
│                                 │
│  ┌──────────────────────────┐  │
│  │ 🚫 NE PAS CONSOMMER      │  │
│  │ Ce produit fait l'objet  │  │
│  │ d'un rappel officiel...  │  │
│  └──────────────────────────┘  │
│                                 │
│  Raison du rappel :             │
│  Présence de salmonelles        │
│                                 │
│  ┌──────────────────────────┐  │
│  │ ⚕️ En cas de consommation│  │
│  │ [ 📞 Appeler le 15 ]     │  │
│  │ [ 📞 Appeler le 112 ]    │  │
│  └──────────────────────────┘  │
└─────────────────────────────────┘
```

---

**Bon test ! 🚀**

Si vous rencontrez des problèmes, vérifiez d'abord ce guide.
Pour les notifications, n'oubliez pas : **build natif obligatoire** !
