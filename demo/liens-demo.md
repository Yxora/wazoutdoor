# Démo : positions pour signaler en direct

Parcours : `vallee_de_la_wormsa-23732754-1791705273-266.gpx` (boucle d'environ 12 km, départ à 48.00396, 7.03341).
Le paramètre `?pos=lat,lng` remplace la position GPS du navigateur : ouvrir le lien, puis « Signaler » enregistre le signalement à cet endroit.

- Local : `npm run dev` (adresse `http://localhost:5173/`).
- GitHub Pages : adresse **à vérifier** (déduite du dépôt `Yxora/wazoutdoor`, donc `https://yxora.github.io/wazoutdoor/`).
- Les signalements de départ sont dans [signalements-demo.sql](signalements-demo.sql), à exécuter juste avant la démo.

## Signalements en direct (nouveaux, sans doublon)

| Scénario | Type à choisir | Lien local | Lien GitHub Pages |
|---|---|---|---|
| Déchets près du départ | `dechets` | http://localhost:5173/?pos=48.007100,7.038470 | https://yxora.github.io/wazoutdoor/?pos=48.007100,7.038470 |
| Crue, passage d'eau | `eau` | http://localhost:5173/?pos=48.021610,7.028040 | https://yxora.github.io/wazoutdoor/?pos=48.021610,7.028040 |
| Neige ou verglas | `neige` | http://localhost:5173/?pos=48.029910,7.026510 | https://yxora.github.io/wazoutdoor/?pos=48.029910,7.026510 |
| Brouillard dense | `brouillard` | http://localhost:5173/?pos=48.026280,7.023070 | https://yxora.github.io/wazoutdoor/?pos=48.026280,7.023070 |
| Autre danger | `autre` | http://localhost:5173/?pos=48.019420,7.017320 | https://yxora.github.io/wazoutdoor/?pos=48.019420,7.017320 |
| Arbre tombé (nouveau, loin de l'autre) | `arbre` | http://localhost:5173/?pos=48.005170,7.028840 | https://yxora.github.io/wazoutdoor/?pos=48.005170,7.028840 |

## Cas particuliers (règles de doublon)

On se place exactement sur un signalement de départ, puis on tente d'en créer un.

| Scénario | Type à choisir | Résultat attendu | Lien local | Lien GitHub Pages |
|---|---|---|---|---|
| Même type déjà présent | `arbre` | Le formulaire se ferme, la popup de l'arbre s'ouvre (Oui / Non, commentaire) | http://localhost:5173/?pos=48.015190,7.030830 | https://yxora.github.io/wazoutdoor/?pos=48.015190,7.030830 |
| Autre type à proximité | `boue` | « Un signalement d'un autre type existe déjà... tout de même ajouter ? » | http://localhost:5173/?pos=48.015190,7.030830 | https://yxora.github.io/wazoutdoor/?pos=48.015190,7.030830 |
| Conversation | `troupeau` | Ouvre le troupeau (1 commentaire), bon point pour ajouter un commentaire en direct | http://localhost:5173/?pos=48.028780,7.024370 | https://yxora.github.io/wazoutdoor/?pos=48.028780,7.024370 |

## Pour le score

- Charger le GPX avec le profil randonneur·se : la chasse (zone de 3 km) concerne tout le tracé. La mettre en Red flag dans « Personnaliser » fait passer le score à 0.
- Rappel des durées : chasse 12 h, brouillard 6 h, boue, neige et crue 3 jours. Réexécuter le SQL le jour de la démo.
- Pour vider la base : `truncate table public.signalisations;` (éditeur SQL de Supabase).
