# Fonctionnalités de l'app

Liste de ce que l'app propose aujourd'hui, pour préparer la démo. Les durées, seuils et vitesses sont des **hypothèses de travail**, pas des valeurs validées par les interviews. Voir aussi [liens-demo.md](liens-demo.md) pour les positions de démo.

## 1. Vérifier un itinéraire : le score de sérénité

L'utilisateur·rice choisit une activité (randonneur·se, traileur·se, vététiste), une heure de départ et un tracé. L'app calcule un score de 0 à 100 sur 8 critères, avec le détail, la source et la fraîcheur de chacun.

| Fonctionnalité | Ce que ça apporte | Source |
|---|---|---|
| Import d'un fichier GPX | Charger son propre tracé, ou l'exemple Schlucht-Hohneck | Fichier local |
| Import Strava | Choisir un de ses itinéraires Strava après connexion du compte | API Strava |
| Retour avant la nuit | Durée estimée selon le profil, comparée au coucher du soleil | IGN altimétrie, Open-Meteo |
| Vigilance météo | Niveau de vigilance du département (aujourd'hui et demain) | Météo-France |
| Météo pendant la sortie | Pluie, froid, chaleur, vent, orage, heure par heure, corrigée de l'altitude, jusqu'à 16 jours | Open-Meteo |
| Points d'eau | Eau disponible le long du parcours | refuges.info |
| Abris et repli | Cabanes et refuges à proximité | refuges.info |
| Risque d'incendie | Feu actif détecté par satellite à moins de 10 km du tracé, sur 2 jours | NASA FIRMS |
| Zones protégées | Le tracé entre dans une réserve, un arrêté de biotope ou un parc national | IGN, INPN |
| Signalements sur le parcours | Dangers signalés par la communauté dans leur zone d'effet | Signalements Wazoutdoor |

Règles à connaître :
- Une source en échec rend son critère « indisponible » : il est exclu du score et signalé, jamais compté comme favorable.
- Un score n'est « serein » que s'il n'y a aucune alerte.
- Un feu actif près du tracé force le score à 0.
- Une zone protégée traversée donne un avertissement, sans forcer le score.

## 2. Personnaliser son profil

Démo avec une utilisatrice fictive, Julie. Les préférences sont gardées dans le navigateur.

- Choix des activités : seuls les profils choisis sont proposés.
- Pour chaque critère : **Ignorer**, **Prendre en compte** (par défaut) ou **Red flag** (met le score à 0 si le critère est en alerte), en faisant glisser le critère dans un tableau à 3 colonnes.
- Contraintes : le risque d'incendie est verrouillé en Red flag, la zone protégée ne peut pas être ignorée.
- Même réglage pour chaque **type de signalement** (arbre tombé, chasse en cours...).
- Le score se recalcule sans rappeler les sources.

## 3. Signaler un danger

- Onze types : éboulis, arbre tombé, boue, neige ou verglas, crue, chasse en cours, troupeau et patous, balisage absent, brouillard, déchets, autre.
- Signalement à la position GPS de l'utilisateur·rice.
- Description facultative (280 caractères) et photo facultative (appareil photo sur mobile).
- Zone d'effet par type : 150 m par défaut, 3 km pour la chasse.
- Après l'envoi : retour sur la carte, centrée sur le signalement, avec un toast de confirmation.

## 4. Éviter les doublons

- **Même type déjà présent à proximité :** pas de nouveau signalement. Le formulaire se ferme et la popup du signalement existant s'ouvre.
- **Autre type à proximité :** l'app prévient et demande si l'utilisateur·rice veut tout de même ajouter le sien.

## 5. Vie d'un signalement

| Fonctionnalité | Détail |
|---|---|
| Durée de validité par type | Brouillard 6 h, chasse 12 h, boue, neige et crue 3 jours, troupeau et autre 14 jours, arbre, éboulis et déchets 21 jours, balisage 90 jours |
| « À confirmer » | Passé la moitié de la durée : pastille estompée, poids décroissant dans le score |
| Toujours là (Oui) | Bouton vert : la date repart de maintenant |
| Plus là (Non) | Bouton rouge : un premier vote grise la pastille, deux votes de personnes différentes résolvent le signalement |
| Commentaires | Fenêtre de conversation, 140 caractères, 10 commentaires au plus. La popup montre jusqu'à 3 commentaires, au-delà un bouton « Voir la conversation » |
| Expiration | Un signalement expiré ou résolu disparaît de la carte et du score |

## 6. La carte

- Tracé, départ, lieux (eau, cabane non gardée, refuge gardé, gîte d'étape), zones protégées et dangers signalés.
- Chaque catégorie de lieu a une couleur **et** un dessin différents.
- Légende avec cases à cocher : afficher ou masquer chaque calque. Le masquage est visuel, le score n'est pas modifié.
- Position de l'utilisateur·rice, ou position simulée avec `?pos=lat,lng` pour la démo.
- Popups : nom, catégorie et gestionnaire des zones protégées, détail et photo des signalements.

## 7. Navigation mobile

Menu du bas avec quatre onglets :
- **Signaler** : ouvre la page de signalement (onglet actif à l'arrivée).
- **Consulter** : ne laisse que la carte.
- **Vérifier** : ouvre l'import du tracé et le calcul du score.
- **Personnaliser** : profil et préférences, en plein écran.

Le score s'affiche dans un bandeau en bas de la carte. Un clic ouvre le détail des critères.

## Pas encore fait

- Chemins de repli par tronçon.
- Fréquentation (aucune source ouverte).
- Comptes utilisateur·rices : sans compte, tout le monde peut confirmer, voter et commenter. À verrouiller avant un vrai produit.
- Autres pratiques (escalade, nautique, aérien) et autres territoires que le massif vosgien.
- API partenaires et app Garmin : au stade de la présentation ou de la maquette.
