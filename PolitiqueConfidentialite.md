# Politique de Confidentialité - Eats OK

*Dernière mise à jour : 12 décembre 2025*

**Eats OK** s'engage à protéger la vie privée et les données personnelles de ses utilisateurs. La présente Politique de Confidentialité vous informe sur la manière dont nous collectons, utilisons, stockons et protégeons vos données personnelles conformément au Règlement Général sur la Protection des Données (RGPD) et à la loi Informatique et Libertés.

---

## 1. Responsable du traitement des données

**Identité du responsable de traitement :**
- Nom : [Votre Nom/Société]
- Adresse : [Votre adresse complète]
- Email : contact@eatsok.app
- Numéro SIRET : [Votre numéro SIRET]

**Délégué à la Protection des Données (DPO) :**
- Email : dpo@eatsok.app
- Contact : privacy@eatsok.app

## 2. Principes de protection des données

Eats OK respecte les principes fondamentaux du RGPD :
- **Minimisation** : nous ne collectons que les données strictement nécessaires
- **Transparence** : vous êtes informé de l'utilisation de vos données
- **Sécurité** : vos données sont protégées par des mesures techniques appropriées
- **Conservation limitée** : vos données ne sont conservées que le temps nécessaire
- **Droits garantis** : vous pouvez exercer vos droits à tout moment

## 3. Données collectées

### 3.1 Données que nous NE collectons PAS

**Important : Eats OK est conçu pour respecter votre vie privée**

❌ **Nous ne collectons PAS :**
- Vos photos de produits (supprimées immédiatement après analyse)
- Votre historique de navigation
- Votre géolocalisation
- Vos contacts
- Vos données bancaires
- Vos identifiants de réseaux sociaux

### 3.2 Données collectées localement (sur votre appareil)

Ces données sont stockées **uniquement sur votre smartphone** et ne sont jamais transmises :

| Donnée | Finalité | Stockage |
|--------|----------|----------|
| **Prénom** (optionnel) | Personnalisation de l'interface | Local (AsyncStorage) |
| **Langue choisie** | Affichage dans votre langue | Local (AsyncStorage) |
| **Historique des scans** | Consultation des produits scannés | Local (SQLite) |
| **Préférences utilisateur** | Configuration de l'app | Local (AsyncStorage) |

### 3.3 Données techniques collectées

#### a) Identifiant d'appareil anonyme
- **Donnée** : ID d'installation Firebase (anonyme)
- **Finalité** : Envoi de notifications de rappel
- **Base légale** : Consentement (autorisation des notifications)
- **Conservation** : Jusqu'au retrait du consentement

#### b) Données de crash et performance
- **Donnée** : Rapports de crash anonymisés (via Firebase Crashlytics)
- **Finalité** : Amélioration de la stabilité de l'application
- **Base légale** : Intérêt légitime
- **Conservation** : 90 jours

#### c) Données de scan (anonymes)
- **Donnée** : Statistiques d'utilisation (nombre de scans, type de produits)
- **Finalité** : Amélioration du service
- **Base légale** : Intérêt légitime
- **Conservation** : 12 mois
- **Caractère** : Données agrégées et anonymisées

### 3.4 Données d'OCR (traitement local)

#### Photos de produits
- **Traitement** : 100% local sur votre appareil (Google ML Kit)
- **Transmission** : AUCUNE - les photos ne quittent jamais votre smartphone
- **Stockage** : AUCUN - suppression immédiate après extraction du texte
- **Durée de vie** : Quelques secondes (temps d'analyse uniquement)

**Garantie de confidentialité** : Vos photos de produits sont traitées exclusivement par votre appareil et ne sont jamais envoyées à nos serveurs ni à des tiers.

## 4. Finalités et bases légales du traitement

### 4.1 Fourniture du service (Base légale : Exécution du contrat)
- Scanner et reconnaître les produits alimentaires
- Vérifier le statut de rappel des produits
- Afficher l'historique des scans
- Consulter les rappels officiels

### 4.2 Amélioration du service (Base légale : Intérêt légitime)
- Analyser les performances de l'application
- Corriger les bugs et erreurs
- Optimiser l'expérience utilisateur
- Développer de nouvelles fonctionnalités

### 4.3 Notifications de sécurité (Base légale : Consentement)
- Vous alerter en cas de rappel d'un produit scanné
- Vous informer des mises à jour importantes de sécurité

**Vous pouvez retirer votre consentement à tout moment** dans les paramètres de votre smartphone.

### 4.4 Obligations légales (Base légale : Obligation légale)
- Répondre aux demandes des autorités compétentes
- Respecter les décisions de justice

## 5. Durée de conservation des données

| Type de donnée | Durée de conservation | Justification |
|----------------|----------------------|---------------|
| **Prénom et préférences** | Jusqu'à désinstallation de l'app | Nécessaire au fonctionnement |
| **Historique des scans** | Jusqu'à désinstallation ou suppression manuelle | Conservation locale uniquement |
| **Token de notification** | Jusqu'au retrait du consentement | Nécessaire pour les alertes |
| **Rapports de crash** | 90 jours | Résolution des bugs |
| **Statistiques anonymes** | 12 mois | Amélioration du service |
| **Photos de produits** | 0 seconde (suppression immédiate) | Pas de stockage |

**Après désinstallation :** Toutes vos données locales sont automatiquement supprimées de votre appareil.

## 6. Destinataires des données

### 6.1 Services tiers utilisés

Nous faisons appel à des sous-traitants conformes RGPD pour le fonctionnement de l'application :

#### Google Firebase (Hébergeur)
- **Services utilisés** : Firestore (base de données), Cloud Messaging (notifications), Crashlytics (rapports de crash)
- **Localisation** : Union Européenne et États-Unis
- **Conformité RGPD** : Clauses Contractuelles Types (SCC), Certification ISO 27001
- **Politique de confidentialité** : https://firebase.google.com/support/privacy

#### Google ML Kit (OCR)
- **Service** : Reconnaissance de texte (OCR)
- **Traitement** : 100% local sur l'appareil (aucune transmission)
- **Politique** : https://developers.google.com/ml-kit/terms

#### Expo (Infrastructure de déploiement)
- **Service** : Distribution et mises à jour de l'application
- **Données traitées** : Métadonnées techniques anonymes
- **Politique** : https://expo.dev/privacy

### 6.2 Pas de vente de données

**Garantie formelle** : Nous ne vendons, ne louons et ne transférons JAMAIS vos données personnelles à des tiers à des fins commerciales ou marketing.

### 6.3 Partage avec les autorités

Vos données peuvent être communiquées aux autorités compétentes uniquement dans les cas suivants :
- Réquisition judiciaire
- Demande légale d'une autorité de contrôle
- Protection des droits et de la sécurité d'Eats OK ou de tiers
- Prévention de fraudes ou d'infractions

## 7. Transferts internationaux de données

### 7.1 Transferts vers les États-Unis

Certains de nos sous-traitants (Google Firebase, Expo) peuvent transférer vos données vers les États-Unis.

**Garanties mises en place** :
- ✅ Clauses Contractuelles Types (SCC) approuvées par la Commission Européenne
- ✅ Certification ISO 27001 et SOC 2
- ✅ Évaluation d'impact sur les transferts (TIA)
- ✅ Mesures techniques supplémentaires (chiffrement end-to-end)

### 7.2 Vos droits concernant les transferts

Vous pouvez obtenir une copie des garanties mises en place en nous contactant à : dpo@eatsok.app

## 8. Sécurité des données

### 8.1 Mesures techniques

Pour protéger vos données, nous mettons en œuvre :

**Chiffrement** :
- ✅ Chiffrement des communications (HTTPS/TLS)
- ✅ Chiffrement des données au repos (AES-256)
- ✅ Chiffrement des sauvegardes

**Contrôle d'accès** :
- ✅ Authentification forte pour l'accès aux systèmes
- ✅ Principe du moindre privilège
- ✅ Journalisation des accès

**Sécurité applicative** :
- ✅ Analyse de sécurité du code
- ✅ Tests de pénétration réguliers
- ✅ Mises à jour de sécurité automatiques

### 8.2 Mesures organisationnelles

- Formation du personnel à la protection des données
- Politique de sécurité des systèmes d'information
- Procédures de gestion des incidents
- Audits réguliers de sécurité

### 8.3 Notification des violations

En cas de violation de données susceptible de porter atteinte à vos droits et libertés :
- Notification à la CNIL sous 72 heures
- Information directe aux personnes concernées si risque élevé
- Mesures correctives immédiates

## 9. Vos droits (RGPD)

Conformément au RGPD, vous disposez des droits suivants :

### 9.1 Droit d'accès (Article 15)
Vous pouvez obtenir :
- La confirmation que vos données sont traitées
- Une copie de vos données personnelles
- Des informations sur le traitement

### 9.2 Droit de rectification (Article 16)
Vous pouvez corriger vos données inexactes ou incomplètes.

### 9.3 Droit à l'effacement / "Droit à l'oubli" (Article 17)
Vous pouvez demander la suppression de vos données dans les cas suivants :
- Les données ne sont plus nécessaires
- Vous retirez votre consentement
- Vous vous opposez au traitement
- Les données ont été collectées illégalement

**Pour Eats OK** : Désinstallez simplement l'application pour supprimer toutes vos données locales.

### 9.4 Droit à la limitation du traitement (Article 18)
Vous pouvez demander la limitation du traitement dans certains cas.

### 9.5 Droit à la portabilité (Article 20)
Vous pouvez récupérer vos données dans un format structuré et réutilisable.

### 9.6 Droit d'opposition (Article 21)
Vous pouvez vous opposer au traitement de vos données fondé sur l'intérêt légitime.

### 9.7 Droit de retirer votre consentement (Article 7)
Pour les notifications : désactivez-les dans les paramètres de votre smartphone.

### 9.8 Droit de définir des directives post-mortem (Article 85 de la loi I&L)
Vous pouvez définir des directives concernant vos données après votre décès.

### 9.9 Comment exercer vos droits ?

**Par email** : privacy@eatsok.app

**Informations à fournir** :
- Votre nom et prénom
- Le droit que vous souhaitez exercer
- Une pièce d'identité en cas de doute sur votre identité

**Délai de réponse** : 1 mois (prolongeable à 3 mois en cas de complexité)

### 9.10 Droit de réclamation auprès de la CNIL

Si vous estimez que vos droits ne sont pas respectés, vous pouvez introduire une réclamation auprès de la CNIL :

**Commission Nationale de l'Informatique et des Libertés (CNIL)**
- Adresse : 3 Place de Fontenoy, TSA 80715, 75334 PARIS CEDEX 07
- Téléphone : 01 53 73 22 22
- Site web : https://www.cnil.fr
- Formulaire de plainte : https://www.cnil.fr/fr/plaintes

## 10. Cookies et traceurs

### 10.1 Cookies utilisés

**Eats OK n'utilise PAS de cookies publicitaires ou de tracking.**

Les seuls "traceurs" utilisés sont :
- **AsyncStorage** : Stockage local des préférences (langue, prénom)
- **SQLite** : Base de données locale pour l'historique

Ces technologies ne permettent pas de vous identifier ni de vous pister.

### 10.2 Pas de publicité ciblée

Nous ne pratiquons aucune publicité ciblée et ne partageons aucune donnée avec des régies publicitaires.

## 11. Utilisation par les mineurs

### 11.1 Âge minimum

L'application Eats OK est accessible aux personnes de **tous âges**, y compris les mineurs.

### 11.2 Consentement parental

Conformément au RGPD (Article 8), pour les enfants de moins de 15 ans :
- Aucun consentement parental n'est requis (l'app ne collecte pas de données personnelles sensibles)
- Les parents peuvent exercer les droits RGPD au nom de leur enfant

### 11.3 Recommandation

Nous recommandons aux parents de :
- Superviser l'utilisation de l'application par les enfants
- Vérifier ensemble les résultats des scans
- Consulter les fiches de rappel en cas d'alerte

## 12. Modifications de la Politique de Confidentialité

### 12.1 Mises à jour

Cette Politique de Confidentialité peut être modifiée pour :
- S'adapter aux évolutions légales (RGPD, ePrivacy, etc.)
- Refléter les changements dans nos pratiques
- Améliorer la transparence

### 12.2 Information des utilisateurs

En cas de modification substantielle, vous serez informé par :
- ✅ Une notification push
- ✅ Un message à l'ouverture de l'application
- ✅ Un email si vous avez fourni votre adresse

### 12.3 Date de mise à jour

La date de dernière mise à jour est indiquée en haut de ce document.

## 13. Analyse d'impact (DPIA)

Conformément à l'Article 35 du RGPD, nous avons réalisé une Analyse d'Impact relative à la Protection des Données (DPIA).

**Conclusion** : Le traitement des données par Eats OK présente un **risque faible** pour les droits et libertés des utilisateurs car :
- Aucune donnée sensible n'est collectée
- Le traitement OCR est 100% local
- Minimisation des données collectées
- Pas de profilage ni de décision automatisée

## 14. Contact et questions

Pour toute question relative à la protection de vos données personnelles :

**Délégué à la Protection des Données (DPO) :**
- Email : **dpo@eatsok.app**

**Service de protection de la vie privée :**
- Email : **privacy@eatsok.app**

**Contact général :**
- Email : contact@eatsok.app
- Adresse : [Votre adresse]

**Délai de réponse** : Nous nous engageons à vous répondre sous 7 jours ouvrés.

---

## 15. Récapitulatif - Vos garanties de confidentialité

✅ **Aucune photo n'est stockée** - Suppression immédiate après analyse
✅ **Traitement 100% local** - L'OCR fonctionne sur votre appareil
✅ **Pas de vente de données** - Vos données ne sont jamais vendues
✅ **Pas de publicité ciblée** - Aucun tracking publicitaire
✅ **Minimisation des données** - Nous collectons le strict minimum
✅ **Conformité RGPD** - Respect total de vos droits
✅ **Sécurité renforcée** - Chiffrement et protection des données
✅ **Transparence totale** - Cette politique détaillée et accessible

---

**Date d'entrée en vigueur** : 12 décembre 2025
**Version** : 1.0
**Dernière modification** : 12 décembre 2025

**Votre vie privée est notre priorité. Merci de faire confiance à Eats OK.**
