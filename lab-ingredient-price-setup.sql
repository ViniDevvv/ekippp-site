-- Prix unitaire par ingredient (calcul du cout de production d'une recette).
-- A executer une seule fois dans le SQL Editor de Supabase (projet yrgpndfperwazvrtpgyj).
--
-- Additif uniquement : nouvelle colonne nullable sur rp_lab_ingredients. Les ingredients
-- deja existants gardent unit_price=null (cout non renseigne, simplement exclu du total),
-- rien n'est modifie ni supprime.
--
-- Pas de nouveau GRANT necessaire : l'app insere deja des lignes dans rp_lab_ingredients
-- (bouton "Ajouter" d'un ingredient) et en supprime (bouton "x") avec les droits actuels
-- de authenticated sur cette table — ajouter une colonne a un insert deja autorise ne
-- demande rien de plus. Pas de fonctionnalite d'edition du prix apres coup (comme pour le
-- reste des ingredients) : on supprime et on recree si besoin, donc aucun UPDATE requis.

alter table rp_lab_ingredients
  add column if not exists unit_price numeric;
