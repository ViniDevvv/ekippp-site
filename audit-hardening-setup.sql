-- Suite de l'audit : ferme les 2 limitations mineures identifiees et durcit la photo d'org.
-- A executer une seule fois dans le SQL Editor de Supabase (projet yrgpndfperwazvrtpgyj).
--
-- 1) tiers_seeded : empeche les grades supprimes expres par un admin de se re-creer tout
--    seuls au chargement suivant. Le mecanisme d'auto-seed cote client ne pouvait pas
--    distinguer "cette org n'a jamais eu de grades" de "cette org a deja ete initialisee
--    et un admin a tout supprime volontairement" (les deux cas donnent 0 ligne dans
--    rp_org_tiers). Additif : nouvelle colonne, defaut false ; les orgs deja actives
--    (qui ont deja leurs grades grace a la migration precedente) sont marquees a true
--    ci-dessous pour ne jamais redeclencher de seed chez elles.
--
-- 2) Verrouille rp_organizations.logo_url pour qu'il ne puisse JAMAIS pointer vers autre
--    chose que le propre dossier de stockage de l'organisation elle-meme (defense en
--    profondeur : meme un admin qui contournerait l'app pour appeler l'API Supabase
--    directement ne peut pas y mettre une URL arbitraire). Sans effet sur les photos deja
--    en place : elles ont toutes ete ecrites par le meme code d'upload et respectent deja
--    ce format.
--
-- 3) Plafonne la taille des fichiers acceptes par le bucket org-logos a 5 Mo cote serveur,
--    en plus de la verification deja faite cote navigateur (qui peut etre contournee en
--    appelant l'API directement).

alter table rp_organizations
  add column if not exists tiers_seeded boolean not null default false;

update rp_organizations
set tiers_seeded = true
where id in (select distinct org_id from rp_org_tiers);

grant update (tiers_seeded) on public.rp_organizations to authenticated;

alter table rp_organizations drop constraint if exists logo_url_scoped_check;
alter table rp_organizations add constraint logo_url_scoped_check
  check (
    logo_url is null
    or logo_url like 'https://yrgpndfperwazvrtpgyj.supabase.co/storage/v1/object/public/org-logos/' || id::text || '/%'
  );

update storage.buckets set file_size_limit = 5242880 where id = 'org-logos';
