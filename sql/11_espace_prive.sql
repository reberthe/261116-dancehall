-- 11_espace_prive.sql
-- Espace privé pour tout le monde (Emma, Jade et les copines) : « Ma bibliothèque » et l'onglet Cours.
-- À lancer dans Supabase → SQL Editor, AVANT de publier l'appli qui s'en sert. Rejouable sans erreur.
--  • perso_steps reçoit 3 colonnes : dans_biblio (ajouté à la main), reperes (Mes repères), video (Ma vidéo)
--  • les 3 tables privées (perso_steps, cours, cours_steps) : chaque membre lit et écrit SES lignes, jamais celles des autres
--  • rien ne change pour la base commune : steps, créateurs, lieux, lexique et histoire restent écrits par Emma et Jade

-- 1. Les nouvelles colonnes
alter table public.perso_steps add column if not exists dans_biblio boolean not null default false;
alter table public.perso_steps add column if not exists reperes text;
alter table public.perso_steps add column if not exists video text;

alter table public.perso_steps drop constraint if exists perso_steps_reperes_check;
alter table public.perso_steps add constraint perso_steps_reperes_check check (length(reperes) <= 2000);
alter table public.perso_steps drop constraint if exists perso_steps_video_check;
alter table public.perso_steps add constraint perso_steps_video_check check (video ~ '^https://\S+$' and length(video) <= 500);

-- 2. Règles d'accès : « membre » au lieu de « éditrice », toujours seulement ses propres lignes
do $$
declare t text;
begin
  foreach t in array array['perso_steps', 'cours'] loop
    execute format('drop policy if exists "a moi" on public.%I', t);
    execute format('create policy "a moi" on public.%I for all to authenticated using ((select prive.est_membre()) and personne = (select auth.uid())) with check ((select prive.est_membre()) and personne = (select auth.uid()))', t);
  end loop;
end $$;

drop policy if exists "a moi" on public.cours_steps;
create policy "a moi" on public.cours_steps for all to authenticated
  using ((select prive.est_membre()) and exists (select 1 from public.cours c where c.id = cours_id and c.personne = (select auth.uid())))
  with check ((select prive.est_membre()) and exists (select 1 from public.cours c where c.id = cours_id and c.personne = (select auth.uid())));

-- 3. Droits colonne par colonne : la personne et les dates restent remplies par la base
revoke insert, update on public.perso_steps from authenticated;
grant insert (step_id, niveau, a_travailler, notes, dans_biblio, reperes, video),
      update (niveau, a_travailler, notes, dans_biblio, reperes, video) on public.perso_steps to authenticated;

-- 4. Vérification : colonnes de perso_steps et règles des tables privées
select 'colonne' as quoi, column_name as nom, data_type as detail
from information_schema.columns where table_schema = 'public' and table_name = 'perso_steps'
union all
select 'règle', tablename || ' · ' || policyname, regexp_replace(qual, '\s+', ' ', 'g')
from pg_policies where schemaname = 'public' and tablename in ('perso_steps', 'cours', 'cours_steps')
order by 1, 2;
