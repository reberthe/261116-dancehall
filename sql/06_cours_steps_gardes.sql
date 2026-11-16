-- 06_cours_steps_gardes.sql
-- Un step supprimé reste dans les cours où il a été vu : son nom est gardé dans cours_steps.
-- À lancer après 01 à 05. Rejouable sans erreur, sans perdre de données.

-- 1. Le nom du step, gardé dans la ligne du cours
alter table public.cours_steps add column if not exists nom_step text;
update public.cours_steps cs set nom_step = s.nom
  from public.steps s where s.id = cs.step_id and cs.nom_step is null;

-- 2. Un identifiant à la ligne (la clé ne peut plus être (cours, step) : le step peut devenir vide)
alter table public.cours_steps add column if not exists id bigint generated always as identity;
do $$
begin
  if not exists (
    select 1 from information_schema.key_column_usage
    where table_schema = 'public' and table_name = 'cours_steps' and constraint_name = 'cours_steps_pkey' and column_name = 'id'
  ) then
    alter table public.cours_steps drop constraint if exists cours_steps_pkey;
    alter table public.cours_steps add constraint cours_steps_pkey primary key (id);
  end if;
end $$;
create unique index if not exists cours_steps_unique on public.cours_steps (cours_id, step_id);   -- un step une fois par cours

-- 3. Supprimer un step le retire du lien, mais la ligne du cours reste (avec son nom)
alter table public.cours_steps alter column step_id drop not null;
alter table public.cours_steps drop constraint if exists cours_steps_step_id_fkey;
alter table public.cours_steps add constraint cours_steps_step_id_fkey
  foreign key (step_id) references public.steps (id) on delete set null;

-- 4. Le nom est toujours rempli par la base, jamais par l'appli
create or replace function prive.nom_du_step()
returns trigger language plpgsql set search_path = '' as $$
begin
  if tg_op = 'UPDATE' then
    new.nom_step := old.nom_step;   -- on garde le nom d'origine
    return new;
  end if;
  select nom into new.nom_step from public.steps where id = new.step_id;
  if new.nom_step is null then raise exception 'Ce step n''existe pas'; end if;
  return new;
end $$;
revoke execute on function prive.nom_du_step() from public, anon, authenticated;
drop trigger if exists nom_du_step on public.cours_steps;
create trigger nom_du_step before insert or update on public.cours_steps for each row execute function prive.nom_du_step();

alter table public.cours_steps alter column nom_step set not null;

-- 5. Droits : toujours seulement cours_id et step_id à l'ajout ; compteur du nouvel identifiant
revoke insert, update on public.cours_steps from authenticated;
grant insert (cours_id, step_id) on public.cours_steps to authenticated;
grant usage on all sequences in schema public to authenticated;

-- Vérification : doit afficher id, cours_id, step_id (vide autorisé), nom_step (obligatoire)
select column_name, is_nullable, data_type from information_schema.columns
where table_schema = 'public' and table_name = 'cours_steps' order by ordinal_position;

-- Essai : un step vu en cours puis supprimé reste dans le cours. Rien n'est gardé après l'essai.
do $$
declare
  admin uuid := (select id from prive.membres where role = 'admin' limit 1);
  id_step bigint; id_cours bigint; reste text;
begin
  insert into public.steps (nom) values ('__test__ step 06') returning id into id_step;
  insert into public.cours (personne, jour) values (admin, current_date) returning id into id_cours;
  insert into public.cours_steps (cours_id, step_id) values (id_cours, id_step);
  delete from public.steps where id = id_step;
  select nom_step into reste from public.cours_steps where cours_id = id_cours and step_id is null;
  delete from public.cours where id = id_cours;
  delete from public.modifications where table_nom = 'steps' and fiche_id = id_step;
  if reste is distinct from '__test__ step 06' then raise exception 'Essai raté : le step a disparu du cours'; end if;
end $$;
select 'ok : un step supprimé reste dans le cours' as essai;
