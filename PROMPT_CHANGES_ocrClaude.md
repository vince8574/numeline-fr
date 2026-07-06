# Changements de prompt `ocrClaude` à appliquer (porté depuis eatSafe US)

Contexte : Claude (lecture du numéro de lot) faisait deux erreurs sur des images
pourtant nettes :
1. il **raisonnait à voix haute** dans sa réponse (« 6256216? Wait, let me re-read: 62562167 »)
   au lieu de renvoyer juste le code ;
2. il **collait les chiffres de l'heure** au lot (cas réel : `LOT: 62562167 08:28` → `6256216702`).

Corrigé et vérifié sur les vraies images (device-free) : saucisses `62562167`,
beurre `L10` (pas de régression), boîte `16170007812`.

Dans le prompt système de `ocrClaude` (le gros template texte, section exemples + format) :

---

## 1. Ajouter ces 2 exemples

Juste **après** l'exemple existant `"07/27/2026 19:54 / F128 L3 M2" -> F128` :

```
- "DLC: 28/07/26 / LOT: 62562167 08:28 M6 7" -> 62562167
  (explicit "LOT:" label; return EXACTLY the code after it. "08:28" is a TIME and
  "M6 7" is a machine/counter — NEVER append their digits: never "6256216708",
  never "6256216702". "28/07/26" is the date. Count the code's digits carefully.)
- "S28/07/26 / 149 09:28 L10" -> L10
  (the "L"-marked code "L10" is the lot, EVEN THOUGH it comes AFTER the time. "149"
  is the julian production day (a bare number is NOT the lot when an L-marked code
  exists), "09:28" is a time, "S28/07/26" the date. A number sitting before a time
  is NOT automatically the lot.)
```

## 2. Remplacer TOUT le bloc `OUTPUT FORMAT:`

Ancien :
```
OUTPUT FORMAT:
- Respond with ONLY the lot code, no quotes, no labels.
- Strip spaces and special chars ("L 693 A" -> "L693A", "2 493 34315" -> "249334315").
- Max 22 chars.
- If no lot code is visible, respond with exactly: NONE
```

Nouveau :
```
OUTPUT FORMAT — follow EXACTLY:
- Your ENTIRE reply is the lot code alone (or the word NONE). Nothing before or after.
- NO reasoning, NO explanation, NO alternatives, NO "let me re-read", NO restating,
  NO showing your work. Decide silently and output the final code ONCE.
- No quotes, no labels.
- Strip spaces and special chars ("L 693 A" -> "L693A", "2 493 34315" -> "249334315").
- Never MERGE a neighbouring time/date into the lot: output only the lot's own
  characters (lot "62562167" beside time "08:28" -> "62562167", never "6256216708").
  A number printed next to a time is NOT automatically the lot — a "LOT:" label or an
  "L"-marked code still decides WHICH token is the lot.
- Max 22 chars.
- If no lot code is visible, respond with exactly: NONE
```

## 3. Redéployer

La fonction FR tourne en `europe-west1`. Après avoir modifié le prompt, redéployer
la fonction `ocrClaude` de la région `europe-west1` (le déploiement côté eatSafe US
ne touche QUE `us-central1`).

---

Note : ces changements ne concernent QUE le prompt (aucune logique de code). Ils
supposent que le reste du prompt (règles "L"/"LOT", exemples date/heure/machine
`F128 L3 M2`, garde anti-hallucination) est déjà aligné avec eatSafe US.
