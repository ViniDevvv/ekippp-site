-- Grades RP personnalisables par organisation (EKIPPP Groupe).
-- A executer une seule fois dans le SQL Editor de Supabase (projet yrgpndfperwazvrtpgyj).
--
-- Remplace les 4 grades fixes et communs a toutes les orgs (Membre/Grade/Co-Lead/Lead)
-- par une table par organisation, que owner/admin peuvent renommer / completer / retirer.
--
-- Continuite des donnees existantes : le backfill ci-dessous cree, pour CHAQUE org deja
-- existante, les 4 memes grades avec les memes cles ('membre','grade','co_lead','lead')
-- qu'avant. rp_members.hierarchy_tier et rp_quotas.tier stockent deja ces cles en texte
-- libre (pas de FK) : aucune ligne n'est touchee, tout continue de s'afficher exactement
-- pareil tant que personne ne renomme rien. Renommer un grade change son "label" mais
-- garde sa "key" stable, donc les membres/quotas qui le referencent restent valides.

create table if not exists rp_org_tiers (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references rp_organizations(id) on delete cascade,
  key text not null,
  label text not null,
  sort_order int not null default 0,
  created_at timestamptz not null default now(),
  unique (org_id, key)
);

insert into rp_org_tiers (org_id, key, label, sort_order)
select o.id, t.key, t.label, t.sort_order
from rp_organizations o
cross join (values
  ('membre', 'Membre', 0),
  ('grade', 'Gradé', 1),
  ('co_lead', 'Co-Lead', 2),
  ('lead', 'Lead', 3)
) as t(key, label, sort_order)
on conflict (org_id, key) do nothing;

alter table rp_org_tiers enable row level security;

drop policy if exists "org members can read their org tiers" on rp_org_tiers;
create policy "org members can read their org tiers"
on rp_org_tiers for select
using (
  exists (
    select 1 from rp_members m
    where m.org_id = rp_org_tiers.org_id
      and m.user_id = auth.uid()
      and m.status = 'active'
  )
);

drop policy if exists "org owner/admin can add tiers" on rp_org_tiers;
create policy "org owner/admin can add tiers"
on rp_org_tiers for insert
with check (
  exists (
    select 1 from rp_members m
    where m.org_id = rp_org_tiers.org_id
      and m.user_id = auth.uid()
      and m.role in ('owner', 'admin')
      and m.status = 'active'
  )
);

drop policy if exists "org owner/admin can rename tiers" on rp_org_tiers;
create policy "org owner/admin can rename tiers"
on rp_org_tiers for update
using (
  exists (
    select 1 from rp_members m
    where m.org_id = rp_org_tiers.org_id
      and m.user_id = auth.uid()
      and m.role in ('owner', 'admin')
      and m.status = 'active'
  )
)
with check (
  exists (
    select 1 from rp_members m
    where m.org_id = rp_org_tiers.org_id
      and m.user_id = auth.uid()
      and m.role in ('owner', 'admin')
      and m.status = 'active'
  )
);

drop policy if exists "org owner/admin can delete tiers" on rp_org_tiers;
create policy "org owner/admin can delete tiers"
on rp_org_tiers for delete
using (
  exists (
    select 1 from rp_members m
    where m.org_id = rp_org_tiers.org_id
      and m.user_id = auth.uid()
      and m.role in ('owner', 'admin')
      and m.status = 'active'
  )
);

-- Grant de base obligatoire en plus des policies RLS (sinon "permission denied for
-- table rp_org_tiers", meme lecon que pour rp_organizations.logo_url).
grant select, insert, update, delete on rp_org_tiers to authenticated;
