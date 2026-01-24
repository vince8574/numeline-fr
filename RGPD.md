# Note RGPD - EatSafe

**Modele de cadrage a completer et valider avec votre DPO/juriste.**

## 1. Base juridique et finalites
- Contrat : fourniture de l'application et des services de scan/OCR.
- Interet legitime : securite, prevention de la fraude, amelioration produit.
- Consentement : acces camera, notifications push, eventuels traitements facultatifs.

## 2. Minimisation et proportionnalite
- Ne collecter que les donnees strictement necessaires.  
- Images OCR traitees localement, supprimees apres extraction. Adapter si un upload serveur est implemente.

## 3. Registre des traitements
Tenir un registre indiquant : categorie de donnees, finalites, bases legales, destinataires, duree de conservation, mesures de securite.

## 4. Droits des personnes
- Acces, rectification, effacement, limitation, opposition, portabilite, retrait du consentement.  
- Point de contact : `privacy@example.com` (a remplacer).
- Delai de reponse : 1 mois (RGPD art. 12).

## 5. Sous-traitants et transferts
- Lister les prestataires (ex. hebergeur, crash reporting, push).  
- Formaliser les contrats de sous-traitance (art. 28) et les clauses de transfert si hors UE (SCC, TIA).

## 6. Conservation
- Compte : pendant la vie du compte + purge/anonymisation.  
- Journaux techniques : duree limitee (ex. 90 jours).  
- Donnees OCR : stockage local temporaire uniquement, sauf si backend -> definir la duree et la finalite.

## 7. Securite
- Chiffrement en transit, controle d'acces, separation des environnements, journalisation des acces, politique de mots de passe/cles API.  
- Tests de securite periodiques (revues de code, pentest si expose).

## 8. Violation de donnees
- Procedure interne d'alerte et de qualification.  
- Notification a l'autorite de controle sous 72h si risque (art. 33) et aux personnes concernees si risque eleve (art. 34).

## 9. DPIA (analyse d'impact)
- Evaluer la necessite d'une DPIA si traitement systematique a grande echelle ou categories particulieres.  
- Documenter les mesures de mitigation.

## 10. Gouvernance
- Designation d'un DPO si requis.  
- Formation des equipes, gestion des habilitations, revue periodique des prestataires.
