-- Photo/logo par organisation (EKIPPP Groupe).
-- A executer une seule fois dans le SQL Editor de Supabase (projet yrgpndfperwazvrtpgyj).
--
-- Additif uniquement : nouvelle colonne nullable + nouveau bucket + nouvelles policies.
-- Aucune ligne existante n'est modifiee ou supprimee : les organisations deja actives
-- gardent leur is_active/logo_url=null et ne perdent rien.
--
-- Scoping anti fuite entre orgs : chaque fichier est stocke sous le chemin
-- "<org_id>/logo" dans le bucket "org-logos". Les policies d'ecriture (insert/update/
-- delete) verifient que l'utilisateur connecte est owner/admin actif de CET org_id
-- precis (premier segment du chemin) avant d'autoriser quoi que ce soit — impossible
-- pour le gerant d'une orga d'ecraser ou de lire au nom d'une autre orga via ce
-- mecanisme. La lecture est publique (necessaire pour afficher la photo dans l'app),
-- mais un chemin illisible (uuid) n'expose aucune donnee sensible.

alter table rp_organizations
  add column if not exists logo_url text;

insert into storage.buckets (id, name, public)
values ('org-logos', 'org-logos', true)
on conflict (id) do nothing;

drop policy if exists "org logos are publicly readable" on storage.objects;
create policy "org logos are publicly readable"
on storage.objects for select
using (bucket_id = 'org-logos');

drop policy if exists "org owner/admin can upload their org logo" on storage.objects;
create policy "org owner/admin can upload their org logo"
on storage.objects for insert
with check (
  bucket_id = 'org-logos'
  and exists (
    select 1 from rp_members m
    where m.org_id::text = (storage.foldername(name))[1]
      and m.user_id = auth.uid()
      and m.role in ('owner', 'admin')
      and m.status = 'active'
  )
);

drop policy if exists "org owner/admin can update their org logo" on storage.objects;
create policy "org owner/admin can update their org logo"
on storage.objects for update
using (
  bucket_id = 'org-logos'
  and exists (
    select 1 from rp_members m
    where m.org_id::text = (storage.foldername(name))[1]
      and m.user_id = auth.uid()
      and m.role in ('owner', 'admin')
      and m.status = 'active'
  )
);

drop policy if exists "org owner/admin can delete their org logo" on storage.objects;
create policy "org owner/admin can delete their org logo"
on storage.objects for delete
using (
  bucket_id = 'org-logos'
  and exists (
    select 1 from rp_members m
    where m.org_id::text = (storage.foldername(name))[1]
      and m.user_id = auth.uid()
      and m.role in ('owner', 'admin')
      and m.status = 'active'
  )
);

-- Permet a owner/admin de mettre a jour le logo_url de LEUR organisation (et rien
-- d'autre : pas de policy pour les autres colonnes ni pour les autres orgs).
drop policy if exists "org owner/admin can set their org logo_url" on rp_organizations;
create policy "org owner/admin can set their org logo_url"
on rp_organizations for update
using (
  exists (
    select 1 from rp_members m
    where m.org_id = rp_organizations.id
      and m.user_id = auth.uid()
      and m.role in ('owner', 'admin')
      and m.status = 'active'
  )
)
with check (
  exists (
    select 1 from rp_members m
    where m.org_id = rp_organizations.id
      and m.user_id = auth.uid()
      and m.role in ('owner', 'admin')
      and m.status = 'active'
  )
);
