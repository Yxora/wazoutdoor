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

**État actuel** : prototype du **problème 1** (sortir seul·e sans angoisse). L'utilisateur choisit un profil (randonneur·se, traileur·se, vététiste), une heure de départ et un fichier GPX (ou un exemple Schlucht-Hohneck). Le cas d'usage `evaluateRoute` calcule un **score de sérénité** sur 5 critères, avec le détail, la source et la fraîcheur de chacun :

| Critère | Source | Adaptateur |
|---|---|---|
| Retour avant la nuit (durée estimée selon le profil, comparée au coucher du soleil) | IGN altimétrie + Open-Meteo | `infra/ignElevation.ts`, `infra/openMeteoDaylight.ts` |
| Vigilance météo du département | Météo-France Bulletin Vigilance (clé nécessaire, aujourd'hui et demain seulement) | `infra/meteoFranceVigilance.ts` |
| Météo prévue pendant la sortie : pluie, froid, chaleur (canicule), vent, orage, heure par heure sur la durée estimée, corrigée de l'altitude moyenne | Open-Meteo (usage non commercial, jusqu'à 16 jours) | `infra/openMeteoForecast.ts`, règles et seuils dans `domain/forecast.ts` |
| Points d'eau | refuges.info | `infra/refugesInfoPlaces.ts` |
| Abris et repli | refuges.info | `infra/refugesInfoPlaces.ts` |

Une source en échec rend son critère « indisponible » : il est exclu du score et signalé, jamais compté comme favorable. Un score n'est « serein » que s'il n'y a aucune alerte. Les vitesses et seuils par profil (`domain/profile.ts`) sont des **hypothèses**, pas des valeurs validées. Le tracé d'exemple (`ui/samples/hohneck-exemple.gpx`) vient du service d'itinéraire pédestre de l'IGN.

Sur la carte, chaque catégorie de lieu a une couleur **et** un glyphe différents (point d'eau, cabane non gardée, refuge gardé, gîte d'étape), plus le départ du tracé, avec une légende repliable (`ui/map.ts`). La catégorie (`PlaceCategory`) sert à l'affichage, le rôle (`PlaceKind`, eau ou abri) au calcul du score.

Pas encore fait : chemins de repli par tronçon, fréquentation (aucune source ouverte), zones protégées, signalements communautaires (Supabase n'est plus utilisé que pour un test de connexion dans la console), déploiement GitLab/GitHub Pages. Overpass (OSM) a été testé mais reste instable : il n'est pas branché.

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

Copier `.env.example` vers `.env`. Le score fonctionne sans Supabase. Pour la vigilance météo, ajouter `VITE_METEOFRANCE_API_KEY=` dans `.env` (clé du portail API Météo-France, durée de vie courte, visible dans le navigateur car préfixée `VITE_` : acceptable pour un prototype, pas pour un vrai produit). Sans cette clé, le critère est affiché « indisponible ». Pour le test de connexion Supabase : `VITE_SUPABASE_URL` et `VITE_SUPABASE_ANON_KEY` (Project Settings > API). Ne jamais committer `.env`. Ne jamais utiliser la clé `service_role` côté front : seule la clé `anon` est publique, et la sécurité repose sur la RLS activée avec des policies explicites (sans policy, la table paraît vide).
