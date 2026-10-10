# Étape 1 : Le problème (vendredi soir)

Sujet : activités outdoor. Les imprévus rencontrés pendant une sortie.

> **Pivot (10 octobre)** : l'équipe oriente le projet vers un **calculateur de score d'itinéraire personnalisable**. Les sections 1 à 9 décrivent la version de départ (signalement des imprévus) et restent la base : les imprévus deviennent un critère du score. Le pivot est décrit en [section 10](#10-pivot--calculateur-de-score-ditinéraire).

## 1. Tour de table des « pourquoi ? »

Perception du problème par chaque membre (sans interruption du porteur) :

- [Nom] :
- [Nom] :
- [Nom] :

Questions pour guider le tour de table :
- Quel imprévu t'est déjà arrivé en sortie ? Qu'as-tu fait ?
- Qu'est-ce que ça t'a coûté (temps, stress, danger, argent) ?
- Comment aurais-tu pu le savoir avant ?
- Pour toi, qui souffre le plus de ce problème ?

## 2. Qui pourrait être intéressé ?

**Pratiquants** (utilisateurs)
- Randonneurs à la journée
- Randonneurs itinérants / bivouac
- Traileurs
- Vététistes / gravel
- Grimpeurs (falaises)
- Pratiquants nautiques (kayak, paddle, voile)
- Parapentistes
- Skieurs de rando / raquettes
- Cavaliers

**Professionnels** (utilisateurs + potentiels payeurs)
- Accompagnateurs en montagne, guides, moniteurs
- Clubs et fédérations (FFRandonnée, FFCAM, FFME...)

**Acteurs du territoire** (fournisseurs d'info + potentiels payeurs)
- Offices de tourisme, communes, comcoms
- Parcs naturels régionaux / nationaux
- ONF (travaux forestiers)
- Fédérations de chasse
- Éleveurs / bergers (patous)
- Secours en montagne

**Acteurs existants** (concurrents ou partenaires)
- Applis outdoor : Komoot, Visorando, IGNrando, Strava, AllTrails, Garmin

## 3. Notre client idéal

> À choisir en équipe. Proposition : un seul espace pour commencer, le sentier.

- **Qui** : randonneur·se à la journée, en moyenne montagne / massif (ex. Vosges), qui sort plusieurs fois par mois
- **Comment il prépare** : planifie son itinéraire à l'avance sur une appli (Komoot, Visorando, IGNrando...)
- **Ce qu'il vit** : arrive sur place et tombe sur un imprévu (chasse, travaux, chemin impraticable, patou)
- **Ses contraintes** : pas de réseau, batterie limitée, ne veut pas changer d'appli

**Persona (fictif, à confronter aux interviews) : Julie, 34 ans, Strasbourg**
- Part 2 à 3 dimanches par mois dans les Vosges, seule ou avec 2-3 amis
- Prépare sa boucle la veille sur Komoot, en regardant les commentaires récents
- Elle a déjà vécu : tomber sur une battue avec des panneaux « chasse en cours », faire 4 km de détour à cause d'un chantier forestier, se faire suivre par un patou
- Ce qu'elle ressent : frustration (journée gâchée), inquiétude (danger), sentiment d'être « mal informée » alors que l'info existait quelque part
- Ce qu'elle veut : partir l'esprit tranquille, savoir avant de partir si un imprévu l'attend sur son itinéraire, et un plan B si besoin

**Pourquoi cette cible en premier ?**
- C'est le segment le plus nombreux de l'outdoor : la randonnée est l'activité de nature la plus pratiquée en France
- Il est accessible tout de suite : on peut interviewer des randonneurs dès samedi matin
- Les imprévus y sont fréquents et variés (chasse d'octobre à février, travaux forestiers, troupeaux en été)
- Les autres espaces (parois, mer, airs) seront une extension plus tard

**Cibles secondaires** : traileurs et vététistes (mêmes sentiers, mêmes imprévus), accompagnateurs en montagne (responsables d'un groupe, donc plus exposés au risque)

## 4. Le problème réel

> [Qui, précisément] a du mal à [faire quoi], parce que [cause racine], ce qui lui coûte [temps, argent, santé, risque]. Aujourd'hui il s'en sort en [solution actuelle], ce qui ne suffit pas parce que [limite].

**Phrase de l'équipe (version actuelle) :**

> Un pratiquant peut voir son activité outdoor perturbée/interrompue/annulée à cause d'éléments imprévus/inconnus/non renseignés/mal renseignés qui lui fait perdre du temps, prendre des risques, gâche son plaisir. Aujourd'hui quand l'info existe, elle est difficile à trouver/peu fiable/pas actualisée/payante/fragmentée.

**Proposition V1 (à challenger) :**

Les **randonneurs à la journée en moyenne montagne** ont du mal à **savoir si leur itinéraire est praticable le jour J**, parce que **les informations sur les imprévus (chasse, travaux forestiers, arbres tombés, troupeaux gardés, zones interdites) sont éparpillées, vite périmées et inaccessibles sur le terrain**, ce qui leur coûte **des demi-tours, du temps perdu, des situations dangereuses, voire des amendes**. Aujourd'hui ils s'en sortent en **consultant les groupes Facebook, les commentaires des applis de rando, les panneaux en mairie ou le bouche-à-oreille**, ce qui ne suffit pas parce que **l'info n'est ni centralisée, ni géolocalisée, ni à jour, ni lisible sans réseau**.

### Remonter à la cause racine (les « 5 pourquoi »)

1. Pourquoi la sortie est-elle gâchée ? → Parce que le randonneur tombe sur un imprévu qu'il n'avait pas prévu.
2. Pourquoi ne l'avait-il pas prévu ? → Parce qu'il n'avait pas l'information au moment de préparer sa sortie.
3. Pourquoi n'avait-il pas l'information ? → Parce qu'elle est dispersée entre de nombreuses sources (mairie, ONF, chasse, réseaux sociaux) qu'il ne consulte pas toutes.
4. Pourquoi est-elle dispersée ? → Parce que chaque acteur publie ses infos de son côté, dans son format, sans lien avec les itinéraires.
5. Pourquoi n'est-elle pas reliée aux itinéraires ? → Parce que personne ne fait le lien entre « un imprévu à tel endroit, tel jour » et « mon itinéraire de dimanche ».

**Cause racine retenue (hypothèse)** : l'information sur les imprévus existe, mais elle n'est **pas reliée à l'itinéraire du pratiquant au bon moment** (à la préparation et sur le terrain).

### Ce que ça coûte

| Type de coût | Exemples |
|---|---|
| Temps | Demi-tour, détour de plusieurs km, sortie écourtée |
| Sécurité | Zone de battue, patou, chemin dangereux, se perdre en contournant un obstacle |
| Argent | Amende en zone interdite, trajet en voiture pour rien |
| Émotionnel | Frustration, stress, perte de confiance pour repartir seul·e |

### Les solutions actuelles et leurs limites

| Solution actuelle | Limite |
|---|---|
| Groupes Facebook / WhatsApp locaux | Infos noyées dans le flux, pas géolocalisées, non vérifiées |
| Commentaires sur Komoot, Visorando, AllTrails | Pas datés de façon visible, vite périmés, pas de notion d'imprévu temporaire |
| Sites des mairies, préfectures, ONF | Éparpillés, peu lisibles, rarement consultés avant une sortie |
| Panneaux sur le terrain | On les découvre une fois sur place, trop tard |
| Calendriers de battues (fédérations de chasse) | Pas toujours publics ni complets, difficiles à croiser avec un itinéraire |
| Bouche-à-oreille, office de tourisme | Dépend de qui on connaît, pas accessible le week-end ou la veille au soir |
| Ne rien faire et improviser sur place | Risque, perte de temps |

## 5. Ce qui « fait chier » pendant la sortie (matière brute)

**Imprévus sur le parcours**
- Chasse / battues
- Travaux forestiers
- Arbre ou éboulement sur le chemin
- Itinéraire impraticable (boue, gué en crue, neige)
- Zones interdites d'accès (temporaires ou non)
- Patous / troupeaux / clôtures
- Balisage disparu, passage privé fermé
- Point d'eau tari, parking plein ou fermé

**Contraintes techniques**
- Terrain pas couvert / pas de réseau
- La carte me localise mal
- La batterie se vide très vite
- Multiplication des applis (on veut garder la sienne)

## 6. Parking à idées de solution (pour plus tard, pas ce soir !)

- Appli type Waze : la communauté met un flag sur un problème
- Couches de données sur les zones interdites
- Notification si on prend un itinéraire interdit / à problème
- Scalabilité vers d'autres espaces (airs, parois, mer...)
- S'intégrer aux applis existantes plutôt qu'en créer une de plus

Détail des pistes (webapp, API partenaires, app Garmin) : voir [idees-solutions.md](idees-solutions.md).

## 7. Concurrence et solutions existantes

### Concurrents directs (vérifiés)

| Appli | Ce qu'elle fait | Limite / ce qui manque |
|---|---|---|
| **WaffApp** (startup de la Loire, lancée en 2021) | Appli **gratuite et collaborative** de signalement de zones dangereuses : chiens agressifs, zones de chasse, passages impraticables ou dangereux, chenilles processionnaires. Aussi points d'eau, points d'intérêt, dépôts sauvages. La V2 ajoute les zones interdites aux chiens, un mode « avec mon chien » (zones de patous) et la réglementation en montagne (bivouac, feu). Cible : randonneurs, traileurs, marche nordique, VTT | **À vérifier** : nombre d'utilisateurs, densité des signalements dans les Vosges, expiration des signalements, croisement avec l'itinéraire de la personne (import GPX), sources officielles, modèle économique. **Concurrent le plus proche, à tester à la main** |
| **Suricate** (ministère des Sports, depuis 2013) | Signalement de problèmes sur le terrain (balisage, entretien, conflit d'usage, dépôt sauvage, sécurité), transmis à ~1 000 gestionnaires (départements, fédérations, État) qui les traitent | Outil de remontée **vers les gestionnaires**, pas d'alerte **vers les autres pratiquants**. Le randonneur qui prépare sa sortie ne voit pas les signalements sur son itinéraire |
| **Chasse en Cours** | Carte en temps réel des zones de chasse, déclarées par les chasseurs (les promeneurs peuvent signaler une chasse non déclarée) | Un seul type d'imprévu (la chasse). Dépend de la participation des chasseurs |
| **Whympr** (fonction zones de chasse) | Signalement collaboratif des zones de chasse sur la carte, gratuit | Un seul type d'imprévu. Appli plutôt orientée montagne / alpinisme |
| **Trailforks** | Statut des sentiers (ouvert / fermé / problèmes / danger) mis à jour par les rapports de la communauté, suivi des réparations par les associations | Surtout VTT et Amérique du Nord, peu utilisé par les randonneurs en France |

### Solutions voisines (à vérifier)

| Appli | Ce qu'elle fait | Limite |
|---|---|---|
| Komoot, Visorando, AllTrails | Commentaires sur les itinéraires | Un commentaire n'est pas une alerte datée et il n'expire pas |
| Outdooractive | Affiche certaines fermetures officielles selon les régions | Couverture variable |
| Camptocamp | Comptes rendus de sorties qui donnent l'état des conditions | Alpinisme, escalade, ski de rando surtout |
| Biodiv'Sports | Zones sensibles pour la faune, intégrées à certaines applis | Uniquement la protection de la faune |
| Geotrek | Plateforme des parcs / départements pour publier des itinéraires, liée à Suricate | Outil de gestionnaires, pas une appli communautaire |

### Ce qu'on en retient

- **WaffApp réunit déjà plusieurs types d'imprévus** (chasse, chiens, passages dangereux) dans une appli collaborative et gratuite. On ne peut donc plus dire qu'aucun outil ne les regroupe. Elle valide qu'il y a un besoin, mais elle impose de répondre à « pourquoi pas WaffApp ? ».
- Les autres outils restent **fragmentés** : chacun couvre un seul angle (remontée aux gestionnaires pour Suricate, chasse seule, VTT seul).
- **Pistes de différenciation (hypothèses, à confronter à WaffApp et aux interviews)** :
  1. **croiser les imprévus avec l'itinéraire de la personne** (import GPX), avant la sortie ;
  2. intégrer des **sources officielles** (ONF, fédérations, mairies) avec date d'expiration, en plus des signalements ;
  3. **s'intégrer aux applis existantes** par une API plutôt que d'être une appli de plus ;
  4. **fiabilité** : confirmations, expiration automatique.
- **Conséquence sur le business** : une appli gratuite et collaborative existe déjà, donc les pratiquants n'ont pas de raison de payer chez nous. Le payeur probable est un partenaire ou un territoire (hypothèse, voir [idees-solutions.md](idees-solutions.md)).
- Suricate, Chasse en Cours et peut-être WaffApp peuvent être des **sources de données ou des partenaires** plutôt que des concurrents.
- À tester en interview : si personne ne connaît ces applis, le problème vient peut-être de la **visibilité de l'information** plus que de son existence. Et si des personnes utilisent WaffApp, ce qui leur manque encore.

### Sources

- [WaffApp, FFRandonnée](https://www.ffrandonnee.fr/s-informer/actualites/waffapp-l-appli-de-rando-qui-signale-les-zones-dangereuses-a-eviter)
- [WaffApp, Le Journal des Entreprises](https://www.lejournaldesentreprises.com/article/lapplication-pour-randonneurs-waffapp-compte-sur-sa-nouvelle-version-pour-tracer-son-chemin-2144244)
- [Suricate, le portail officiel](https://sentinelles.sportsdenature.fr/)
- [Suricate, notre-environnement.gouv.fr](https://www.notre-environnement.gouv.fr/actualites/breves/article/suricate-une-application-pour-signaler-les-problemes-rencontres-lors-de-vos)
- [Suricate, Mon GR](https://www.mongr.fr/page/suricate-un-outil-de-veille-des-sentiers)
- [Chasse en Cours, App Store](https://apps.apple.com/fr/app/chasse-en-cours/id1670517259)
- [Whympr, zones de chasse en temps réel](https://get.whympr.com/blog-articles/chasse-et-rando-savoir-ou-sont-les-zones-de-chasse-en-temps-reel)
- [Trailforks, signalement de l'état des sentiers](https://www.trailforks.com/about/features/trail_reporting/)

## 8. Hypothèses à valider samedi matin

| # | Hypothèse | Comment la tester |
|---|---|---|
| H1 | Les randonneurs rencontrent des imprévus régulièrement (au moins une fois par saison) | Interviews : « Raconte-moi la dernière fois que... » |
| H2 | Ces imprévus ont un vrai coût (temps, danger, frustration) | Interviews : demander ce qui s'est passé ensuite |
| H3 | Ils cherchent déjà l'info avant de partir, mais ne la trouvent pas ou mal | Interviews : « Comment prépares-tu ta sortie ? » |
| H4 | Ils seraient prêts à signaler un imprévu pour aider les autres | Questionnaire : « As-tu déjà laissé un commentaire / signalé quelque chose ? » |
| H5 | Ils ne veulent pas d'une appli de plus | Questionnaire : applis utilisées et ouverture à une nouvelle |
| H6 | Les acteurs du territoire (office de tourisme, ONF, chasse) ont intérêt à diffuser leurs infos | 1 ou 2 appels / mails à des acteurs locaux |
| H7 | Les randonneurs ne connaissent pas ou n'utilisent pas les outils existants (WaffApp, Suricate, Chasse en Cours, Whympr) | Interviews : « Connais-tu... ? Les utilises-tu ? Pourquoi ? » |
| H8 | Même quand ils utilisent WaffApp, il leur manque quelque chose que nous apportons (itinéraire, sources officielles, fiabilité) | Interviews : « Qu'est-ce qui te manque dans cette appli ? » Test à la main de WaffApp par l'équipe |

Questionnaire en ligne pour préciser la typologie des sportifs, des activités et des imprévus : voir [questionnaire.md](questionnaire.md).

### Questions d'interview (questions ouvertes)

1. À quelle fréquence pars-tu en sortie outdoor ? Où ? Avec qui ?
2. Comment prépares-tu une sortie ? Quels outils utilises-tu ?
3. Raconte-moi la dernière fois que tu as rencontré un imprévu sur le parcours.
4. Qu'as-tu fait à ce moment-là ? Qu'est-ce que ça t'a coûté ?
5. Aurais-tu pu le savoir avant ? Où aurais-tu cherché ?
6. Si tu tombes sur un problème, est-ce que tu préviens les autres ? Comment ?
7. Qu'est-ce qui t'agace le plus pendant une sortie ?
8. Connais-tu WaffApp, Suricate, Chasse en Cours ou Whympr ? Les utilises-tu ? Pourquoi ? Qu'est-ce qui te manque dedans ?

## 9. Organisation de l'équipe

| Sous-équipe | Membres | Tâches pour samedi matin |
|---|---|---|
| Business | | V1 du Lean Canvas (segments clients, proposition de valeur en priorité). Contraintes de l'écosystème : juridique (responsabilité, RGPD), accès aux données officielles, partenaires possibles |
| Marketing & Com | | Finaliser le questionnaire et la grille d'interview ci-dessus, carte d'empathie du persona, teaser / landing page pour recueillir des testeurs, diffusion dans des groupes de randonneurs |
| Tech / Produit | | Lister les hypothèses fonctionnelles, regarder les données disponibles (open data ONF, chasse, arrêtés), premiers croquis |
| Tous | | 5 à 10 interviews de vrais randonneurs avant 13h (en personne, par téléphone, dans les groupes Facebook / clubs) |

## 10. Pivot : calculateur de score d'itinéraire

> Tout ce qui suit est une **hypothèse de travail** à confronter aux interviews et au questionnaire. Le détail et l'état de vérification de chaque source sont dans [sources-donnees.md](sources-donnees.md).

### Périmètre retenu

- **Territoire** : le **massif vosgien** uniquement.
- **Profils** : **randonneur·se**, **traileur·se**, **vététiste**.
- **Trois problèmes à résoudre** (formulés par l'équipe, à confronter aux interviews) :
  1. « Je suis angoissé·e ou stressé·e de sortir seul·e. »
  2. « Je ne veux pas de contretemps pendant mon itinéraire : je veux que ma sortie se passe d'une traite. »
  3. « Je ne veux pas perdre de temps à planifier mon itinéraire en cherchant dans toutes les sources fragmentées. »

| Problème | Ce que le score doit lui répondre | Critères qui y contribuent | Données |
|---|---|---|---|
| **1. Angoisse de sortir seul·e** | « Puis-je partir sans m'inquiéter ? » | Couverture mobile, points d'eau, abris, chemins de repli (distance à une route ou un village), nature et praticabilité du chemin, météo, heure du coucher du soleil par rapport à la durée estimée, fréquentation | Testées le 10/10 : **Open-Meteo** (coucher du soleil), **IGN** (altitude), **refuges.info** et **OSM** (eau, abris), **Météo-France Vigilance** (avec clé). Mobile (ARCEP) : couverture simulée. **Fréquentation : aucune source ouverte.** Détail dans [sources-donnees.md](sources-donnees.md) |
| **2. Pas de contretemps** | « Vais-je être arrêté·e ou détourné·e ? » | Imprévus signalés, restrictions d'accès (incendie, zones protégées, règles VTT et chiens), météo, chantiers, chasse | Signalements communautaires, INPN (périmètres), **chasse, travaux ONF et arrêtés incendie : pas de flux ouvert** |
| **3. Pas de temps perdu à planifier** | « Tout est là, en un seul endroit, en quelques secondes » | Aucun critère propre : c'est la **valeur de l'agrégation** (import du GPX, résultat unique, détail lisible) | Dépend de la fiabilité des appels aux sources (voir [sources-donnees.md](sources-donnees.md)) |

À noter :
- Le problème 2 est celui qui compte le plus pour la promesse, et c'est aussi celui qui a le **moins de données ouvertes**. Il reposera surtout sur la communauté au départ.
- Le problème 1 est en partie émotionnel : le score peut réduire les causes objectives d'inquiétude, mais ne doit pas promettre la sécurité. Le partage de position avec un proche est hors périmètre pour l'instant.
- Le problème 3 se mesure : combien de temps et combien de sources utilisent-ils aujourd'hui pour préparer ? À demander en interview, avec leur réponse comme valeur de référence.
- Les trois profils n'ont pas les mêmes règles : certains sentiers sont interdits au VTT, le traileur a besoin d'eau et de repères de temps, le randonneur peut être avec un chien. Chaque profil change les poids et les seuils.

### Nouvelle proposition (V2, à challenger)

Les **randonneur·ses** ont du mal à **savoir si un itinéraire leur convient**, parce que **les informations utiles (dénivelé, météo, zones protégées et restrictions, imprévus, eau, abris) sont dispersées, rarement à jour et ne tiennent pas compte de leur profil**, ce qui leur coûte **des sorties mal adaptées, des demi-tours, des risques et parfois des amendes**. Aujourd'hui ils s'en sortent en **croisant à la main une appli d'itinéraires, la météo, les commentaires et le bouche-à-oreille**, ce qui ne suffit pas parce que **rien ne rassemble ces données en un résultat lisible, adapté à la personne**.

**Principe** : l'utilisateur fournit un itinéraire (fichier GPX) et choisit un profil. Le calculateur renvoie un **score** et le **détail critère par critère**, avec la source et la fraîcheur de chaque donnée.

### Critères envisagés

| Critère | Effet sur le score | Source | Statut |
|---|---|---|---|
| Dénivelé et pente | Difficulté | IGN Géoplateforme (altimétrie) | Service vérifié, licence à vérifier |
| Météo prévue pendant la sortie : pluie, froid, chaleur, vent, orage | Alerte par élément, le pire détermine le critère | Open-Meteo (prévisions horaires, corrigées de l'altitude) | Non commercial seulement. Seuils de travail à valider |
| Nature du chemin | Difficulté, praticabilité | OpenStreetMap | Couverture Vosges à tester |
| Zones naturelles protégées traversées | Alerte « vérifier les règles » (chiens, VTT) | Base nationale des espaces protégés (INPN) | Périmètres ouverts, **règles précises non disponibles** |
| Zones sensibles pour la faune, interdictions saisonnières | Alerte | Biodiv'Sports | À vérifier |
| Restrictions d'accès temporaires (risque incendie) | Alerte forte | Arrêtés préfectoraux, saisie communautaire | **Pas de flux ouvert trouvé** |
| Sécheresse | Indicateur de contexte (eau rare, risque incendie) | VigiEau | Concerne l'**usage de l'eau**, pas la circulation |
| Imprévus signalés (chasse, travaux, arbre tombé, patou) | Alerte pondérée par type, fraîcheur et confirmations | **Signalements communautaires saisis dans l'app** | À construire |
| Points d'eau | **Renforce** le score (sécurité) | OpenStreetMap | À confirmer sur le terrain |
| Abris | **Renforce** le score (sécurité) | OpenStreetMap | Ouverture non connue |
| Couverture mobile | Sécurité (pouvoir appeler les secours) | ARCEP | Couverture simulée |
| Heure du coucher du soleil par rapport à la durée estimée | Sécurité (rentrer avant la nuit) | Open-Meteo (`sunrise`, `sunset`) + durée calculée selon le profil | Appel testé |
| Vigilance météo (orage, canicule) | Alerte | Météo-France, Bulletin Vigilance | Clé nécessaire (durée courte), niveau départemental seulement. Appel testé |
| Chemins de repli (route, village, arrêt de bus proche) | Sécurité (pouvoir s'échapper) | OpenStreetMap, arrêts de transport | Calcul à écrire |
| Fréquentation | Sécurité et sérénité (croiser du monde ou non) | Aucune source ouverte pour les Vosges | **Non couvert**, piste communautaire à tester |
| Accès en transports en commun | Praticité | transport.data.gouv.fr | Licences par opérateur |

### Profils (hypothèses)

Un profil fixe les **poids** et les **seuils** de chaque critère. Profils retenus : **randonneur·se**, **traileur·se**, **vététiste**. Exemples d'effet à valider : le vététiste est concerné par les sentiers interdits au VTT et par la praticabilité du chemin ; le traileur par le dénivelé, l'eau et la durée ; le randonneur par les zones protégées, les chiens et les abris. D'autres profils (famille, débutant·e) viendront plus tard. Les poids sont à définir à partir des interviews, pas à deviner.

### Ce que ça change

- **Persona et cible** : Julie reste un point de départ, mais il faudra vérifier si c'est bien le « score » qu'elle veut, et non l'information brute.
- **Concurrence** : WaffApp couvre les signalements. Notre différence devient de **croiser plusieurs sources et le profil dans un score lisible**. Je n'ai pas encore étudié les outils qui notent ou comparent des itinéraires (à faire avant le pitch).
- **Business** : les pratiquants ne veulent pas payer (retours du questionnaire). Le payeur probable est un partenaire ou un territoire (appli outdoor, office de tourisme, parc), via une API du score. Hypothèse à tester par appels.
- **Technique** : le calcul est de la logique métier pure (`domain/`), chaque source est un adaptateur (`infra/`). Voir [CLAUDE.md](../CLAUDE.md).

### Trous de données à assumer

- Calendrier de chasse officiel : non trouvé en open data.
- Travaux forestiers (ONF) : non trouvé.
- Règles précises par zone (chiens, VTT, laisse) et interdictions saisonnières : pas de couche géographique.
- Arrêtés d'accès aux massifs pour risque incendie : publiés département par département, sans flux.
- Fréquentation : aucune source.

Pour le pitch, ces critères sont **prévus**, pas déjà calculés, sauf si la source communautaire les couvre.

### Risques à traiter

- **Responsabilité** : un score trop rassurant peut mettre quelqu'un en danger. Afficher la fraîcheur et le niveau de confiance de chaque donnée, et un avertissement : le score aide à préparer, il ne remplace ni le jugement ni les consignes locales.
- **Données incomplètes ou périmées** : OSM varie selon les secteurs, un point d'eau peut être à sec, un abri fermé.
- **Faune et zones sensibles** : ne pas afficher de façon à nuire (RSE).
- **Licences** : Open-Meteo et Overpass sont limités à l'usage non commercial.

### Hypothèses du pivot

| # | Hypothèse | Comment la tester |
|---|---|---|
| H9 | Les randonneur·ses veulent un **score synthétique** avant de partir, plutôt que des informations brutes | Interviews : « Comment décides-tu qu'un itinéraire te convient ? » Montrer une maquette de score |
| H10 | Les critères retenus sont ceux qui comptent pour eux, et ils diffèrent selon le profil | Questionnaire : classer des critères, selon le profil |
| H11 | Ils feraient confiance à un score calculé **si le détail est visible** | Interviews : « Qu'est-ce qui te ferait croire ou non à ce score ? » |
| H12 | Les données ouvertes suffisent à produire un score utile dans les Vosges | Test technique : appels réels (IGN, Open-Meteo, OSM, VigiEau, INPN) sur un itinéraire connu |
| H13 | Les signalements communautaires comblent les trous (chasse, travaux, interdictions temporaires) | Reprend H4 : intérêt pour signaler, et nombre de signalements nécessaires pour démarrer |
| H14 | Des partenaires (applis, offices de tourisme, parcs) paieraient pour un score ou une API | 2 ou 3 appels B2B (voir H6) |
| H15 | L'**angoisse de sortir seul·e** est un vrai frein : des gens renoncent à des sorties ou sortent moins | Interviews : « Y a-t-il des sorties auxquelles tu renonces parce que tu es seul·e ? Qu'est-ce qui te rassurerait ? » |
| H16 | Les **contretemps** (accès fermé, détour, imprévu) sont fréquents et coûteux dans les Vosges | Interviews : « Raconte la dernière fois que ta sortie a été interrompue » (reprend H1 et H2 sur ce périmètre) |
| H17 | Préparer une sortie prend **trop de temps** parce que les sources sont éparpillées | Interviews : « Combien de temps et combien de sources utilises-tu pour préparer ? » Chiffrer la durée moyenne |

### Questions d'interview à ajouter

9. Avant de choisir un itinéraire, quelles informations regardes-tu ? Dans quel ordre ?
10. Qu'est-ce qui te fait renoncer à un itinéraire ?
11. Si une appli te donnait une note à un itinéraire, qu'est-ce que tu voudrais voir derrière cette note ?
12. As-tu déjà été limité·e par une règle (chien, VTT, accès interdit, risque incendie) ? Comment l'as-tu su ?
13. Comment te sécurises-tu sur l'eau et les abris pendant une sortie ?

## ✅ Checklist (vendredi 23h)

- [ ] L'équipe parle du problème et de la cible (pas encore de la solution)
- [ ] Les sous-groupes de travail sont formés
