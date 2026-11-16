-- 07_sous_categories.sql
-- Sous-catégories des steps, rattachées à une étiquette (ex. « Waistline technique » pour Gyal).
-- Pour en ajouter une : une ligne de plus dans l'insertion ci-dessous, puis relancer le script.
-- À lancer après 01 à 06. Rejouable sans erreur.

-- 1. La liste (écrite seulement par ce script, jamais par l'appli)
create table if not exists public.sous_categories (
  cle text primary key check (cle ~ '^[a-z_]{1,30}$'),
  etiquette text not null check (etiquette in ('man', 'gyal', 'neutre')),
  nom text not null check (length(trim(nom)) between 1 and 40),
  ordre int not null default 0
);

insert into public.sous_categories (cle, etiquette, nom, ordre) values
  ('waistline', 'gyal', 'Waistline technique', 1)
on conflict (cle) do update set etiquette = excluded.etiquette, nom = excluded.nom, ordre = excluded.ordre;

alter table public.sous_categories enable row level security;
drop policy if exists "lecture" on public.sous_categories;
create policy "lecture" on public.sous_categories for select to authenticated using ((select prive.est_membre()));
revoke all on public.sous_categories from anon, authenticated;
grant select on public.sous_categories to authenticated;

-- 2. La sous-catégorie d'un step (une au plus)
alter table public.steps add column if not exists sous_categorie text
  references public.sous_categories (cle) on update cascade on delete set null;
grant insert (sous_categorie), update (sous_categorie) on public.steps to authenticated;

-- 3. Elle doit aller avec l'étiquette du step ; sinon elle s'enlève toute seule (ex. Gyal → Man)
create or replace function prive.verifier_sous_categorie()
returns trigger language plpgsql set search_path = '' as $$
begin
  if new.sous_categorie is not null and not exists (
    select 1 from public.sous_categories where cle = new.sous_categorie and etiquette = new.etiquette
  ) then
    new.sous_categorie := null;
  end if;
  return new;
end $$;
revoke execute on function prive.verifier_sous_categorie() from public, anon, authenticated;
drop trigger if exists sous_categorie on public.steps;
create trigger sous_categorie before insert or update on public.steps for each row execute function prive.verifier_sous_categorie();

-- Essai : un step Gyal + Waistline, passé en Man, perd sa sous-catégorie. Rien n'est gardé après l'essai.
do $$
declare id_step bigint; avant text; apres text;
begin
  insert into public.steps (nom, etiquette, sous_categorie) values ('__test__ step 07', 'gyal', 'waistline')
    returning id, sous_categorie into id_step, avant;
  update public.steps set etiquette = 'man' where id = id_step returning sous_categorie into apres;
  delete from public.steps where id = id_step;
  delete from public.modifications where table_nom = 'steps' and fiche_id = id_step;
  if avant is distinct from 'waistline' or apres is not null then raise exception 'Essai raté (avant : %, après : %)', avant, apres; end if;
end $$;
select 'ok : ' || string_agg(nom || ' (' || etiquette || ')', ', ' order by ordre) as sous_categories from public.sous_categories;
