-- Signalements de démo le long du parcours « Vallée de la Wormsa » (demo/vallee_de_la_wormsa-23732754-1791705273-266.gpx).
-- À exécuter dans l'éditeur SQL de Supabase juste avant la démo : les dates sont relatives à l'exécution
-- (une chasse expire au bout de 12 h, un brouillard au bout de 6 h).
--
-- Ce que chaque ligne montre :
--   arbre    : actif, 4 commentaires -> le bouton « Voir la conversation » remplace les commentaires dans la popup
--   boue     : « à confirmer » (passé la moitié de ses 3 jours) -> pastille estompée
--   troupeau : actif, récent, 1 commentaire
--   eboulis  : un « plus là » déjà reçu -> pastille grisée, une seconde personne peut le résoudre
--   balisage : actif, plus ancien
--   chasse   : récent, zone d'effet de 3 km -> tout le tracé est concerné (à mettre en Red flag pour le score à 0)

insert into public.signalisations (type, description, lat, lng, created_at, gone_votes, comments) values
  ('arbre', 'Gros hêtre en travers du sentier, passage possible par la gauche.', 48.015190, 7.030830, now() - interval '2 days', 0, ARRAY['Contourné sans problème par la gauche.', 'Toujours là ce matin.', 'Un peu glissant autour du tronc.', 'Les services forestiers sont prévenus.']::text[]),
  ('boue', 'Passage très glissant après la pluie.', 48.024670, 7.026000, now() - interval '2 days', 0, '{}'),
  ('troupeau', 'Troupeau de vaches et patous, rester calme et contourner par le haut.', 48.028780, 7.024370, now() - interval '3 hours', 0, ARRAY['Deux patous près de la clôture.']::text[]),
  ('eboulis', 'Pierres sur le chemin, passage étroit.', 48.026010, 7.015600, now() - interval '3 days', 1, ARRAY['Dégagé en partie, à vérifier.']::text[]),
  ('balisage', 'Balisage absent à l''embranchement.', 48.013720, 7.016040, now() - interval '10 days', 0, '{}'),
  ('chasse', 'Battue signalée dans le secteur, rester visible.', 48.010490, 7.025130, now() - interval '1 hour', 0, '{}');

-- Pour repartir de zéro : truncate table public.signalisations;
