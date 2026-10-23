# CLAUDE.md

## Le projet

**wazoutdoor** : projet d'équipe du **Startup Weekend Strasbourg 2026** (9-11 octobre 2026, EM Strasbourg).

Sujet : les imprévus rencontrés pendant une activité outdoor (chasse, travaux forestiers, arbre tombé, chemin fermé, patous...). L'idée de départ est un « Waze de l'outdoor » : relier les infos sur les imprévus à l'itinéraire du pratiquant, avant et pendant la sortie.

Le dépôt contient les documents de travail en Markdown (`guidelines/`) et le **socle** d'une webapp : l'architecture en couches et un test de connexion à Supabase. Il n'y a pas encore de carte ni de fonctionnalité.

## Les fichiers

| Fichier | Contenu |
|---|---|
| `guidelines/def-pb.md` | Étape 1 : définition du problème, cible, persona (Julie), concurrence, hypothèses, organisation de l'équipe. Document principal |
| `guidelines/questionnaire.md` | Questionnaire en ligne (9 questions, moins de 5 minutes) et plan d'analyse des résultats |
| `guidelines/idees-solutions.md` | Pistes de solution (webapp, API partenaires, app Garmin), à travailler seulement à l'étape 3 |
| `guidelines/guidebook.pdf` | Guide officiel du Startup Weekend : étapes, outils (Lean Canvas, carte d'empathie, proposition de valeur, customer journey), checklists, critères du jury. Lire avec `pdftotext guidelines/guidebook.pdf -` |

## Le déroulé du week-end

Chaque étape a sa checklist dans le guidebook. Toujours vérifier à quelle étape on en est avant de proposer du contenu.

1. **Vendredi soir : le problème.** Cohésion, cible, formulation du problème. Ne pas parler de solution.
2. **Samedi matin : validation marché.** Interviews (5 à 10 avant 13h), persona, Lean Canvas V1.
3. **Samedi après-midi : la solution.** Proposition de valeur, customer journey, prototype démontrable sans bug.
4. **Samedi soir : business model.** Prouver que des gens vont payer.
5. **Dimanche : pitch.**

Critères du jury : validation marché, business model, exécution (MVP, design), esprit d'équipe et RSE.

## Règles de travail

- **Le problème avant la solution.** Le guidebook alerte sur les équipes qui sautent sur la solution. Les idées de solution vont dans `guidelines/idees-solutions.md` ou dans le « parking à idées » de `guidelines/def-pb.md`, pas dans l'analyse du problème.
- **Distinguer hypothèse et fait.** Le persona, la cible et la cause racine sont des hypothèses tant qu'elles ne sont pas confirmées par les interviews et le questionnaire. Les marquer comme telles. Ne jamais inventer de chiffres, de citations d'utilisateurs ou de résultats d'enquête.
- **Sourcer les infos sur les concurrents** (Suricate, Chasse en Cours, Whympr, Trailforks...) avec un lien, et séparer « vérifié » et « à vérifier ».
- **Périmètre actuel (après le pivot)** : un **calculateur de score d'itinéraire** personnalisable, limité au **massif vosgien** et à trois profils : **randonneur·se, traileur·se, vététiste**. Il répond à trois problèmes : l'angoisse de sortir seul·e, le souhait de ne pas avoir de contretemps, et le temps perdu à planifier avec des sources éparpillées. Voir la section 10 de `guidelines/def-pb.md`. Les autres pratiques (escalade, nautique, aérien) et territoires sont des extensions.

## Style d'écriture

- Tout est en **français**.
- Phrases courtes et simples, vocabulaire concret. Pas de jargon inutile.
- Ponctuation française : espace avant `:`, guillemets « ».
- Pas de tiret cadratin (—) : utiliser `:` ou une virgule.
- Écriture inclusive avec le point médian quand c'est utile (randonneur·se, senti·e).
- Tableaux Markdown pour les comparaisons, listes à puces pour le reste.
- Relier les documents entre eux par des liens relatifs (`[questionnaire.md](questionnaire.md)`, dans le même dossier).

## La webapp

Priorité retenue dans `guidelines/idees-solutions.md` : une **webapp** pour la démo (carte des imprévus, vérification d'un itinéraire GPX, formulaire de signalement). L'API partenaires et l'app Garmin restent au stade de la présentation ou de la maquette. Viser une démo simple et fiable sur scène plutôt qu'un produit complet.

**État actuel** : prototype du **problème 1** (sortir seul·e sans angoisse). L'utilisateur choisit un profil (randonneur·se, traileur·se, vététiste), une heure de départ et un fichier GPX (ou un exemple Schlucht-Hohneck). Le cas d'usage `evaluateRoute` calcule un **score de sérénité** sur 8 critères, avec le détail, la source et la fraîcheur de chacun :

| Critère | Source | Adaptateur |
|---|---|---|
| Retour avant la nuit (durée estimée selon le profil, pause d’1 h comprise, comparée au coucher du soleil) | IGN altimétrie + Open-Meteo | `infra/ignElevation.ts`, `infra/openMeteoDaylight.ts` |
| Vigilance météo du département | Météo-France Bulletin Vigilance (clé nécessaire, aujourd'hui et demain seulement) | `infra/meteoFranceVigilance.ts` |
| Météo prévue pendant la sortie : pluie, froid, chaleur (canicule), vent, orage, heure par heure sur la durée estimée, corrigée de l'altitude moyenne | Open-Meteo (usage non commercial, jusqu'à 16 jours) | `infra/openMeteoForecast.ts`, règles et seuils dans `domain/forecast.ts` |
| Points d'eau | refuges.info | `infra/refugesInfoPlaces.ts` |
| Abris et repli | refuges.info | `infra/refugesInfoPlaces.ts` |
| Risque d'incendie (feu actif détecté par satellite à moins de 10 km du tracé, sur les 2 derniers jours) | NASA FIRMS, MODIS et VIIRS (clé nécessaire) | `infra/nasaFirmsFireRisk.ts` |
| Zones protégées (le tracé entre dans une réserve naturelle, un arrêté de protection de biotope ou un parc national) | IGN Géoplateforme, WFS INPN/Patrinat (ouvert, sans clé) | `infra/ignProtectedAreas.ts`, test géométrique dans `domain/protectedArea.ts` |
| Signalements sur le parcours (actifs, dans la zone d'effet du type : 150 m par défaut, 3 km pour la chasse ; hypothèses, `domain/signalisation.ts`) | Signalements Wazoutdoor (`SignalisationStore`) | `infra/supabaseSignalisationStore.ts`, `infra/localSignalisationStore.ts` |

Une source en échec rend son critère « indisponible » : il est exclu du score et signalé, jamais compté comme favorable. Un score n'est « serein » que s'il n'y a aucune alerte. **Exception : un feu actif détecté près du tracé force le score global à 0**, quels que soient les autres critères et les préférences de l'utilisateur (`allowedModes` et `effectiveMode` dans `domain/profile.ts`, appliqués par `computeScore`). La **zone protégée** ne peut pas être ignorée : elle est au minimum « Prendre en compte », et peut être mise en Red flag. À l'inverse, une zone protégée traversée ne déclenche qu'un **avertissement** : elle pèse dans la moyenne pondérée comme n'importe quel autre critère, sans forcer le score. Les vitesses et seuils par profil (`domain/profile.ts`) sont des **hypothèses**, pas des valeurs validées. Le tracé d'exemple (`ui/samples/hohneck-exemple.gpx`) vient du service d'itinéraire pédestre de l'IGN.

Les zones protégées proches du tracé sont dessinées en orange transparent (`Evaluation.protectedAreas`, `ui/map.ts`), avec nom, catégorie et gestionnaire au toucher. Pas de lien vers le site de la zone (la source IGN ne donne que des fiches INPN, mortes depuis la refonte d'INPN) : la fenêtre demande à l'utilisateur·rice de vérifier la réglementation.

Sur la carte, chaque catégorie de lieu a une couleur **et** un glyphe différents (point d'eau, cabane non gardée, refuge gardé, gîte d'étape), plus le départ du tracé, avec une légende repliable (`ui/map.ts`). La catégorie (`PlaceCategory`) sert à l'affichage, le rôle (`PlaceKind`, eau ou abri) au calcul du score.

**Utilisateur fictif (démo de la personnalisation)** : Julie (`domain/user.ts`, `DEMO_USER`, préférences gardées dans `localStorage` par `infra/localUserStore.ts`). Elle ne sert qu'à la démo hors ligne (sans Supabase) ; avec Supabase, chaque compte a ses préférences (voir **Comptes**). Elle choisit ses activités (le panel ne propose que ces profils) et, pour chaque critère réglable, un mode, en faisant glisser le critère dans un tableau à 3 colonnes : **Ignorer** (exclu du score), **Prendre en compte** (pondéré, par défaut pour tous les critères) ou **Red flag** (met le score à 0 si le critère est en alerte). Le **risque d'incendie** et les **zones protégées** figurent dans ce tableau mais sont contraints : l'incendie est verrouillé en Red flag, la zone protégée ne peut pas aller dans « Ignorer ». Un second tableau identique règle le traitement de chaque **type de signalement** (arbre tombé, chasse en cours...) ; un type en Red flag présent dans sa zone d'effet met le score à 0. Le score se recalcule sans rappeler les sources (`applyPreferences`). Vue : `ui/userProfile.ts`. Valeurs de démo, pas des données d'enquête.

**Parcours** : au chargement, une modale plein écran (`ui/importModal.ts`, la carte n'est pas visible) demande l'activité, l'heure de départ, puis un switch Import GPX / Import Strava, et « Calculer le score ». Le score s'affiche ensuite dans un bandeau en bas de la carte (`ui/scoreView.ts`) ; un clic ouvre une modale avec le détail des critères. Logos : `ui/assets/logo.png` (pictogramme Trace OK, tiré de `assets/trace_ok_logo_seul.svg`, en haut à droite de la carte) ; `ui/assets/strava.svg` est un **placeholder** à remplacer par le vrai (Strava impose ses assets officiels).

**Navigation mobile** : menu du bas (`ui/bottomNav.ts`) avec quatre onglets (Signaler, Consulter, Vérifier, Personnaliser). **À l'arrivée, l'onglet Signaler est actif et sa page s'ouvre** (la modale Vérifier ne s'ouvre qu'au toucher de l'onglet, ou au retour de Strava). **Signaler** ouvre une page à part entière (`ui/signalisationControl.ts`, formulaire défilant, bouton d'envoi fixe en bas) qui signale à la position GPS. **Vérifier** rouvre la modale d'import. **Personnaliser** affiche le profil de l'utilisateur en plein écran (`#panel`, la carte est masquée). Toucher l'onglet Personnaliser actif ferme le panneau.

**Import Strava** : l'utilisateur·rice connecte son compte Strava (OAuth2, scopes `read,read_all`) et choisit l'un de ses itinéraires, dont le GPX alimente le flux existant. Port `RouteLibrary`, adaptateur `infra/stravaRoutes.ts`, cas d'usage `application/listLibraryRoutes.ts`. L'échange du code et le refresh du token passent par la Edge Function Supabase `supabase/functions/strava-token` (le secret client y reste ; l'API v3 elle-même autorise le CORS). Le jeton est gardé dans `sessionStorage`. Configuration : `VITE_STRAVA_CLIENT_ID`, secrets Supabase `STRAVA_CLIENT_ID` et `STRAVA_CLIENT_SECRET`, domaine de callback de l'app Strava. À vérifier : les conditions d'usage de l'API Strava et les quotas d'une app non validée.

**Consultation et toast** : l'onglet « Consulter » du menu du bas ne laisse que la carte (ferme le panneau Personnaliser, le détail du score et la modale d'import). Après l'envoi d'un signalement, l'app revient sur la carte, centrée sur le signalement (fenêtre ouverte), et un toast « Signalement bien envoyé » s'affiche en bas (`ui/toast.ts`).

**Photo d'un signalement** : le formulaire « Signaler » propose « Ajouter une photo » (appareil photo sur mobile, réduite en JPEG par `ui/photo.ts`). Port `PhotoStore`, adaptateurs `infra/supabasePhotoStore.ts` (bucket public `signalisation-photos`, migration `20261011090000` ; fichier `<id>.jpg` sans le compte dans l'adresse, envoi et suppression réservés au compte qui l'a déposée, contrôlé par `owner_id`) et `infra/localPhotoStore.ts` (repli : la photo reste dans le navigateur). Si l'envoi de la photo échoue, le signalement n'est pas enregistré ; si l'enregistrement échoue après la photo (quota, réseau), la photo est effacée. Sur la carte, la fenêtre du signalement montre une vignette ; un appui l'ouvre en plein écran avec une croix en haut à droite (`ui/photoViewer.ts`).

**Signalisation** : l'utilisateur·rice signale un danger ou un imprévu sur la carte (arbre tombé, chemin fermé...). Domaine `domain/signalisation.ts` (types, criticité, expiration), cas d'usage `reportSignalisation` et `listSignalisations`, port `SignalisationStore`, adaptateurs `infra/supabaseSignalisationStore.ts` (table `signalisations`, migration dans `supabase/migrations/`) et `infra/localSignalisationStore.ts` (repli sans Supabase), vue `ui/signalisationControl.ts` et couche carte dans `ui/map.ts`.

**Cycle de vie d'un signalement** (`domain/signalisation.ts`, durées et seuils = **hypothèses**) : la durée de validité dépend du type (chasse 12 h, brouillard 6 h, boue, neige et crue 3 jours, troupeau et autre 14 jours, arbre, éboulis et déchets 21 jours, balisage 90 jours). États : `active`, `to_confirm` (passé la moitié de la durée : estompé sur la carte, poids décroissant dans le score jusqu'à 0,4, sauf red flag qui reste éliminatoire), `expired`, `resolved` (2 « plus là » de comptes différents, ou un « plus là » de l'auteur·rice : `resolved_at`). Seuls `active` et `to_confirm` sont affichés et comptés (`isLive`). La fenêtre du signalement propose « Toujours là » (date remise à maintenant, votes remis à 0) et « Plus là » (un vote par compte, table `signalisation_gone_votes`, bouton grisé grâce à `my_gone_votes()`). Sur ses propres signalements, une poubelle en haut à droite de la bulle permet de le supprimer (« je me suis trompé·e ») avec sa photo et ses commentaires (`delete_signalisation`). Un signalement du même type déjà présent dans la zone d'effet ne peut pas être recréé : le formulaire demande « Toujours là ? » (oui/non) avec un commentaire facultatif, appliqués au signalement existant ; la carte se recentre dessus sans rouvrir sa bulle. « Ajouter un commentaire » ouvre une fenêtre de conversation (`ui/commentsDialog.ts`, 140 caractères, 10 commentaires au plus) ; la popup montre jusqu'à 3 commentaires, au-delà un bouton « Voir la conversation ». Migrations `20261011150000` et `20261011170000` (rattrapage, rejouable) : `gone_votes`, `comments` et trois fonctions SQL `security definer` (`confirm_signalisation`, `report_signalisation_gone`, `add_signalisation_comment`), sans policy update publique. Depuis les migrations `20261023*`, ces fonctions sont réservées aux comptes (voir **Comptes**).

**Comptes** (Supabase Auth, branche `feat/auth`, plan détaillé dans `guidelines/plan.md`) : connexion par email, lien magique (flux PKCE) ou code à 6 chiffres reçus dans le même email, pas de compte anonyme. Port `AuthGateway`, adaptateurs `infra/supabaseAuth.ts` (SDK `@supabase/auth-js` à version fixée) et `infra/localAuth.ts` (Julie toujours connectée, sans Supabase). Sans compte : carte en lecture seule, score avec les critères standards (`STANDARD_USER`, mention sous le score), Signaler et Personnaliser proposent la connexion (`ui/signInForm.ts`), « Toujours là », « Plus là » et commenter ouvrent une invitation à se connecter. Toute écriture demande un compte : le cas d'usage refuse (`requireAccount`) et la base aussi (RLS, `is_registered()`). Les écritures partent avec le jeton du compte, la lecture garde la clé `anon`. L'auteur·rice d'un signalement n'est jamais lisible (`user_id` exclu des colonnes publiques et des réponses des fonctions). Préférences dans la table `user_preferences` (`infra/supabaseUserStore.ts`, copie locale par compte, effacée à la déconnexion). Suppression du compte depuis Personnaliser (Edge Function `supabase/functions/delete-account`) : préférences et votes supprimés, signalements et photos gardés sans lien avec le compte. Quotas par compte et par heure (**hypothèses** : 20 signalements, 30 commentaires, 60 « Plus là », 60 « Toujours là », `check_quota()`). Tests SQL pgTAP dans `supabase/tests/` (`supabase test db`, sur une base locale). PWA : `public/manifest.webmanifest` et icônes, pas encore de service worker.

Pas encore fait : chemins de repli par tronçon, fréquentation (aucune source ouverte), déploiement GitLab/GitHub Pages. Overpass (OSM) a été testé mais reste instable : il n'est pas branché.

### Stack

TypeScript + Vite (sans framework pour la vue), Vitest, ESLint. Backend : Supabase, appelé directement depuis le navigateur. Le build est statique (`dist/`), prévu pour Gtihub Pages.

### Architecture hexagonale (`src/`)

| Dossier | Rôle |
|---|---|
| `domain/` | Entités et règles métier (imprévu, expiration). TypeScript pur, aucune dépendance |
| `application/` | Cas d'usage et **ports** (interfaces que le domaine et les cas d'usage exigent) |
| `infra/` | **Adaptateurs** qui implémentent les ports (Supabase, géolocalisation, mémoire pour la démo et les tests) |
| `ui/` | La vue (carte, formulaires) |
| `main.ts` | Composition : seul fichier qui connaît toutes les couches, il branche les adaptateurs sur les cas d'usage |

Sens des dépendances : `ui` et `infra` vers `application`, `application` vers `domain`. Jamais l'inverse, et `ui` ne touche pas `infra`. ESLint fait échouer `npm run lint` si on enfreint la règle (`eslint.config.js`). Pour ajouter une fonctionnalité : écrire le port et le cas d'usage avec un test, puis l'adaptateur, puis la vue.

### Commandes

- `npm run dev` : serveur local
- `npm test` : tests Vitest (sans réseau)
- `RUN_LIVE=1 npm test` : ajoute `src/live.test.ts`, qui interroge les vraies API publiques. Clé Météo-France facultative : `METEOFRANCE_KEY=... RUN_LIVE=1 npm test`
- `npm run lint` : ESLint, dont la règle de couches
- `npm run build` : vérification des types + build dans `dist/`

### Configuration

Copier `.env.example` vers `.env`. Le score fonctionne sans Supabase. Pour la vigilance météo, ajouter `VITE_METEOFRANCE_API_KEY=` dans `.env` (clé du portail API Météo-France, durée de vie courte, visible dans le navigateur car préfixée `VITE_` : acceptable pour un prototype, pas pour un vrai produit). Sans cette clé, le critère est affiché « indisponible ». Pour le risque d'incendie, ajouter `VITE_FIRMS_API_KEY=` (clé gratuite sur [firms.modaps.eosdis.nasa.gov/api/map_key](https://firms.modaps.eosdis.nasa.gov/api/map_key), même limite VITE_ que ci-dessus) : sans clé le critère est « indisponible », avec clé et un feu détecté près du tracé le score passe à 0 . Pour le test de connexion Supabase : `VITE_SUPABASE_URL` et `VITE_SUPABASE_ANON_KEY` (Project Settings > API). Comptes, dans le tableau de bord Supabase : fournisseur Email activé, connexion anonyme désactivée, URL de redirection `http://localhost:5173/?auth=callback` et l'URL GitHub Pages suivie de `?auth=callback`, modèle d'email « Magic Link » avec `{{ .Token }}` et `{{ .ConfirmationURL }}`, SMTP externe avant toute ouverture au public. Appliquer les migrations dans l'ordre, et la migration `20261023090000_auth.sql` le même jour que le front. Déployer `supabase functions deploy delete-account` (la clé `service_role` est fournie à la fonction par Supabase). Ne jamais committer `.env`. Ne jamais utiliser la clé `service_role` côté front : seule la clé `anon` est publique, et la sécurité repose sur la RLS activée avec des policies explicites (sans policy, la table paraît vide).
