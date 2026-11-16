-- 02_securite.sql
-- Rôles, règles d'accès (RLS) et droits. À lancer après 01_tables.sql. Rejouable sans erreur.
--
-- 3 rôles :
--   admin    = Emma  : lit, ajoute, modifie, supprime tout
--   editrice = Jade  : lit, ajoute, modifie ; ne supprime aucune fiche (mais peut retirer un lien)
--   lectrice = les copines : lecture seule, sans partie privée ni « modifié par »
-- Un compte qui n'est pas dans prive.membres ne voit rien. Un visiteur non connecté non plus.

-- ---------- Membres ----------
create table if not exists prive.membres (
  id uuid primary key references auth.users (id) on delete cascade,
  role text not null check (role in ('admin', 'editrice', 'lectrice')),
  prenom text not null check (length(trim(prenom)) between 1 and 40)
);

-- Rôle de la personne connectée (null si elle n'est pas membre)
create or replace function prive.role_actuel()
returns text language sql stable security definer set search_path = '' as $$
  select role from prive.membres where id = auth.uid();
$$;
create or replace function prive.est_membre()
returns boolean language sql stable set search_path = '' as $$
  select prive.role_actuel() is not null;
$$;
create or replace function prive.est_editrice()
returns boolean language sql stable set search_path = '' as $$
  select coalesce(prive.role_actuel() in ('admin', 'editrice'), false);
$$;
create or replace function prive.est_admin()
returns boolean language sql stable set search_path = '' as $$
  select coalesce(prive.role_actuel() = 'admin', false);
$$;

-- Les fonctions du schéma privé : seulement pour les comptes connectés (utilisées par les règles)
revoke all on schema prive from public, anon;
grant usage on schema prive to authenticated;
revoke execute on all functions in schema prive from public, anon;
grant execute on function prive.role_actuel(), prive.est_membre(), prive.est_editrice(), prive.est_admin(),
  prive.liens_valides(text[]) to authenticated;

-- Pour l'appli : « qui suis-je ? » (rôle et prénom de la personne connectée seulement)
create or replace function public.mon_profil()
returns table (role text, prenom text) language sql stable security definer set search_path = '' as $$
  select m.role, m.prenom from prive.membres m where m.id = auth.uid();
$$;
revoke execute on function public.mon_profil() from public, anon;
grant execute on function public.mon_profil() to authenticated;

-- ---------- « Modifié par » (lisible seulement par Emma et Jade) ----------
create table if not exists public.modifications (
  table_nom text not null,
  fiche_id bigint not null,
  modifie_par uuid,
  prenom text,
  modifie_le timestamptz not null default now(),
  primary key (table_nom, fiche_id)
);

-- Note la dernière modification d'une fiche (rien pour les imports faits depuis le SQL Editor)
create or replace function prive.noter_modification()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if tg_op = 'DELETE' then
    delete from public.modifications where table_nom = tg_table_name and fiche_id = old.id;
    return old;
  end if;
  if auth.uid() is not null then
    insert into public.modifications (table_nom, fiche_id, modifie_par, prenom, modifie_le)
    values (tg_table_name, new.id, auth.uid(), (select prenom from prive.membres where id = auth.uid()), now())
    on conflict (table_nom, fiche_id) do update
      set modifie_par = excluded.modifie_par, prenom = excluded.prenom, modifie_le = excluded.modifie_le;
  end if;
  return new;
end $$;

-- Ajouter ou retirer un membre compte comme une modification de la fiche du crew
-- (et un créateur lié à une fiche d'histoire, comme une modification de cette fiche)
create or replace function prive.noter_modification_lien()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  parent text := tg_argv[0];
  parent_id bigint;
begin
  if auth.uid() is null then
    if tg_op = 'DELETE' then return old; else return new; end if;
  end if;
  if tg_table_name = 'membres_crew' then
    if tg_op = 'DELETE' then parent_id := old.crew_id; else parent_id := new.crew_id; end if;
  else
    if tg_op = 'DELETE' then parent_id := old.histoire_id; else parent_id := new.histoire_id; end if;
  end if;
  insert into public.modifications (table_nom, fiche_id, modifie_par, prenom, modifie_le)
  values (parent, parent_id, auth.uid(), (select prenom from prive.membres where id = auth.uid()), now())
  on conflict (table_nom, fiche_id) do update
    set modifie_par = excluded.modifie_par, prenom = excluded.prenom, modifie_le = excluded.modifie_le;
  if tg_op = 'DELETE' then return old; else return new; end if;
end $$;
revoke execute on function prive.noter_modification(), prive.noter_modification_lien() from public, anon, authenticated;

drop trigger if exists noter on public.lieux;
create trigger noter after insert or update or delete on public.lieux for each row execute function prive.noter_modification();
drop trigger if exists noter on public.createurs;
create trigger noter after insert or update or delete on public.createurs for each row execute function prive.noter_modification();
drop trigger if exists noter on public.steps;
create trigger noter after insert or update or delete on public.steps for each row execute function prive.noter_modification();
drop trigger if exists noter on public.lexique;
create trigger noter after insert or update or delete on public.lexique for each row execute function prive.noter_modification();
drop trigger if exists noter on public.histoire;
create trigger noter after insert or update or delete on public.histoire for each row execute function prive.noter_modification();
drop trigger if exists noter on public.membres_crew;
create trigger noter after insert or update or delete on public.membres_crew for each row execute function prive.noter_modification_lien('createurs');
drop trigger if exists noter on public.histoire_createurs;
create trigger noter after insert or delete on public.histoire_createurs for each row execute function prive.noter_modification_lien('histoire');

-- ---------- RLS sur chaque table ----------
alter table public.lieux enable row level security;
alter table public.createurs enable row level security;
alter table public.membres_crew enable row level security;
alter table public.steps enable row level security;
alter table public.lexique enable row level security;
alter table public.histoire enable row level security;
alter table public.histoire_createurs enable row level security;
alter table public.perso_steps enable row level security;
alter table public.cours enable row level security;
alter table public.cours_steps enable row level security;
alter table public.modifications enable row level security;
alter table prive.membres enable row level security;   -- aucune règle : personne n'y accède par l'API

-- Fiches communes : tout membre lit ; Emma et Jade ajoutent et modifient ; seule Emma supprime
do $$
declare t text;
begin
  foreach t in array array['lieux', 'createurs', 'steps', 'lexique', 'histoire'] loop
    execute format('drop policy if exists "lecture" on public.%I', t);
    execute format('create policy "lecture" on public.%I for select to authenticated using ((select prive.est_membre()))', t);
    execute format('drop policy if exists "ajout" on public.%I', t);
    execute format('create policy "ajout" on public.%I for insert to authenticated with check ((select prive.est_editrice()))', t);
    execute format('drop policy if exists "modification" on public.%I', t);
    execute format('create policy "modification" on public.%I for update to authenticated using ((select prive.est_editrice())) with check ((select prive.est_editrice()))', t);
    execute format('drop policy if exists "suppression" on public.%I', t);
    execute format('create policy "suppression" on public.%I for delete to authenticated using ((select prive.est_admin()))', t);
  end loop;
end $$;

-- Liens (membres d'un crew, créateurs d'une fiche d'histoire) : Jade peut aussi les retirer
do $$
declare t text;
begin
  foreach t in array array['membres_crew', 'histoire_createurs'] loop
    execute format('drop policy if exists "lecture" on public.%I', t);
    execute format('create policy "lecture" on public.%I for select to authenticated using ((select prive.est_membre()))', t);
    execute format('drop policy if exists "ajout" on public.%I', t);
    execute format('create policy "ajout" on public.%I for insert to authenticated with check ((select prive.est_editrice()))', t);
    execute format('drop policy if exists "modification" on public.%I', t);
    execute format('create policy "modification" on public.%I for update to authenticated using ((select prive.est_editrice())) with check ((select prive.est_editrice()))', t);
    execute format('drop policy if exists "suppression" on public.%I', t);
    execute format('create policy "suppression" on public.%I for delete to authenticated using ((select prive.est_editrice()))', t);
  end loop;
end $$;

-- Partie privée : chaque éditrice ne voit et n'écrit que ses propres lignes
do $$
declare t text;
begin
  foreach t in array array['perso_steps', 'cours'] loop
    execute format('drop policy if exists "a moi" on public.%I', t);
    execute format('create policy "a moi" on public.%I for all to authenticated using ((select prive.est_editrice()) and personne = (select auth.uid())) with check ((select prive.est_editrice()) and personne = (select auth.uid()))', t);
  end loop;
end $$;

drop policy if exists "a moi" on public.cours_steps;
create policy "a moi" on public.cours_steps for all to authenticated
  using ((select prive.est_editrice()) and exists (select 1 from public.cours c where c.id = cours_id and c.personne = (select auth.uid())))
  with check ((select prive.est_editrice()) and exists (select 1 from public.cours c where c.id = cours_id and c.personne = (select auth.uid())));

-- « Modifié par » : lecture pour Emma et Jade seulement, écriture par la base seulement
drop policy if exists "lecture editrices" on public.modifications;
create policy "lecture editrices" on public.modifications for select to authenticated using ((select prive.est_editrice()));

-- ---------- Droits (les tables ne sont pas exposées automatiquement) ----------
-- Rien pour les visiteurs non connectés
revoke all on all tables in schema public from anon;
revoke all on all tables in schema prive from anon, authenticated;
revoke all on public.lieux, public.createurs, public.membres_crew, public.steps, public.lexique, public.histoire,
  public.histoire_createurs, public.perso_steps, public.cours, public.cours_steps, public.modifications from authenticated;

-- Lecture (la RLS filtre les lignes)
grant select on public.lieux, public.createurs, public.membres_crew, public.steps, public.lexique, public.histoire,
  public.histoire_createurs, public.perso_steps, public.cours, public.cours_steps, public.modifications to authenticated;

-- Écriture colonne par colonne : identifiants, auteur, personne et dates sont remplis par la base
grant insert (type, nom, ville_id, pays, latitude, longitude),
      update (type, nom, ville_id, pays, latitude, longitude) on public.lieux to authenticated;
grant insert (type, nom, autres_noms, vrai_nom, etiquette, lieu_id, epoques, annee_debut, histoire, liens, photo_chemin, photo_credit),
      update (type, nom, autres_noms, vrai_nom, etiquette, lieu_id, epoques, annee_debut, histoire, liens, photo_chemin, photo_credit)
      on public.createurs to authenticated;
grant insert (crew_id, personne_id, fondateur, ancien), update (fondateur, ancien) on public.membres_crew to authenticated;
grant insert (nom, autres_noms, createur_id, epoque, etiquette, annee, decomposition, chanson, liens, note_attribution, sources, a_verifier),
      update (nom, autres_noms, createur_id, epoque, etiquette, annee, decomposition, chanson, liens, note_attribution, sources, a_verifier)
      on public.steps to authenticated;
grant insert (terme, definition, exemple, lien), update (terme, definition, exemple, lien) on public.lexique to authenticated;
grant insert (titre, epoques, texte, liens), update (titre, epoques, texte, liens) on public.histoire to authenticated;
grant insert (histoire_id, createur_id) on public.histoire_createurs to authenticated;
grant insert (step_id, niveau, a_travailler, notes), update (niveau, a_travailler, notes) on public.perso_steps to authenticated;
grant insert (jour, prof_texte, prof_createur_id, salle, lien_chore, notes),
      update (jour, prof_texte, prof_createur_id, salle, lien_chore, notes) on public.cours to authenticated;
grant insert (cours_id, step_id) on public.cours_steps to authenticated;

-- Suppression (la RLS décide qui) : jamais sur « modifications »
grant delete on public.lieux, public.createurs, public.membres_crew, public.steps, public.lexique, public.histoire,
  public.histoire_createurs, public.perso_steps, public.cours, public.cours_steps to authenticated;

-- Compteurs des identifiants
grant usage on all sequences in schema public to authenticated;
