-- 01_tables.sql
-- Tables de l'appli dancehall. À lancer dans Supabase → SQL Editor, en premier. Rejouable sans erreur.
-- Les règles d'accès (RLS, droits) sont dans 02_securite.sql.

-- Schéma privé : invisible pour l'API (il n'est pas dans les schémas exposés)
create schema if not exists prive;

-- ---------- Fonctions utiles ----------

-- Liste de liens : chaque lien doit commencer par https://
create or replace function prive.liens_valides(liens text[])
returns boolean language sql immutable set search_path = '' as $$
  select coalesce(bool_and(l ~ '^https://\S+$'), true) from unnest(liens) as l;
$$;

-- Dates et auteur remplis par la base, jamais par l'appli
create or replace function prive.dates_avant_ecriture()
returns trigger language plpgsql set search_path = '' as $$
begin
  if tg_op = 'INSERT' then
    new.cree_par := coalesce(auth.uid(), new.cree_par);  -- import depuis le SQL Editor : auteur donné par le script
    new.cree_le := now();
  else
    new.cree_par := old.cree_par;
    new.cree_le := old.cree_le;
  end if;
  new.modifie_le := clock_timestamp();
  return new;
end $$;

-- ---------- Lieux (villes et quartiers) ----------
create table if not exists public.lieux (
  id bigint generated always as identity primary key,
  type text not null check (type in ('ville', 'quartier')),
  nom text not null check (length(trim(nom)) between 1 and 80),
  ville_id bigint references public.lieux (id) on delete restrict,
  pays text not null default 'Jamaïque' check (length(trim(pays)) between 1 and 60),
  latitude numeric(8,5) not null check (latitude between -90 and 90),
  longitude numeric(8,5) not null check (longitude between -180 and 180),
  cree_par uuid,
  cree_le timestamptz not null default now(),
  modifie_le timestamptz not null default now(),
  constraint quartier_dans_une_ville check (
    (type = 'ville' and ville_id is null) or (type = 'quartier' and ville_id is not null))
);
create unique index if not exists lieux_nom_unique on public.lieux (type, coalesce(ville_id, 0), lower(nom));

-- Un quartier doit être rattaché à une ville (pas à un autre quartier)
create or replace function prive.verifier_lieu()
returns trigger language plpgsql set search_path = '' as $$
begin
  if new.type = 'quartier' and not exists (
       select 1 from public.lieux where id = new.ville_id and type = 'ville') then
    raise exception 'Un quartier doit être rattaché à une ville';
  end if;
  return new;
end $$;

-- ---------- Créateurs (crews et personnes) ----------
create table if not exists public.createurs (
  id bigint generated always as identity primary key,
  type text not null check (type in ('crew', 'personne')),
  nom text not null check (length(trim(nom)) between 1 and 80),
  autres_noms text check (length(autres_noms) <= 200),
  vrai_nom text check (length(vrai_nom) <= 100),
  etiquette text check (etiquette in ('man', 'gyal', 'mixte')),
  lieu_id bigint references public.lieux (id) on delete restrict,
  epoques text[] not null default '{}' check (epoques <@ array['old_school', 'middle_school', 'new_school']),
  annee_debut int check (annee_debut between 1950 and 2100),
  histoire text check (length(histoire) <= 5000),
  liens text[] not null default '{}' check (prive.liens_valides(liens) and cardinality(liens) <= 10),
  photo_chemin text,
  photo_credit text check (length(photo_credit) <= 120),
  cree_par uuid,
  cree_le timestamptz not null default now(),
  modifie_le timestamptz not null default now(),
  constraint pas_de_mixte_pour_une_personne check (type = 'crew' or etiquette is distinct from 'mixte'),
  constraint chemin_de_la_photo check (photo_chemin is null or photo_chemin = 'createurs/' || id || '.jpg')
);
create unique index if not exists createurs_nom_unique on public.createurs (type, lower(nom));

-- ---------- Membres d'un crew ----------
create table if not exists public.membres_crew (
  crew_id bigint not null references public.createurs (id) on delete cascade,
  personne_id bigint not null references public.createurs (id) on delete cascade,
  fondateur boolean not null default false,
  ancien boolean not null default false,
  primary key (crew_id, personne_id)
);

-- Le crew doit être un crew, le membre une personne
create or replace function prive.verifier_membre()
returns trigger language plpgsql set search_path = '' as $$
begin
  if not exists (select 1 from public.createurs where id = new.crew_id and type = 'crew') then
    raise exception 'crew_id doit être un crew';
  end if;
  if not exists (select 1 from public.createurs where id = new.personne_id and type = 'personne') then
    raise exception 'personne_id doit être une personne';
  end if;
  return new;
end $$;

-- ---------- Steps ----------
create table if not exists public.steps (
  id bigint generated always as identity primary key,
  nom text not null check (length(trim(nom)) between 1 and 80),
  autres_noms text check (length(autres_noms) <= 200),
  createur_id bigint references public.createurs (id) on delete restrict,
  epoque text check (epoque in ('old_school', 'middle_school', 'new_school')),   -- vide = pas encore renseigné
  etiquette text check (etiquette in ('man', 'gyal', 'neutre')),                 -- vide = pas encore renseigné
  annee int check (annee between 1950 and 2100),
  decomposition text check (length(decomposition) <= 3000),
  chanson text check (length(chanson) <= 150),
  liens text[] not null default '{}' check (prive.liens_valides(liens) and cardinality(liens) <= 10),
  note_attribution text check (length(note_attribution) <= 500),
  sources text check (length(sources) <= 500),
  a_verifier boolean not null default false,
  cree_par uuid,
  cree_le timestamptz not null default now(),
  modifie_le timestamptz not null default now()
);
create unique index if not exists steps_nom_unique on public.steps (lower(nom));
create index if not exists steps_createur on public.steps (createur_id);

-- ---------- Lexique ----------
create table if not exists public.lexique (
  id bigint generated always as identity primary key,
  terme text not null check (length(trim(terme)) between 1 and 60),
  definition text not null check (length(trim(definition)) between 1 and 1000),
  exemple text check (length(exemple) <= 300),
  lien text check (lien ~ '^https://\S+$'),
  cree_par uuid,
  cree_le timestamptz not null default now(),
  modifie_le timestamptz not null default now()
);
create unique index if not exists lexique_terme_unique on public.lexique (lower(terme));

-- ---------- Histoire ----------
create table if not exists public.histoire (
  id bigint generated always as identity primary key,
  titre text not null check (length(trim(titre)) between 1 and 120),
  epoques text[] not null default '{}' check (epoques <@ array['old_school', 'middle_school', 'new_school']),
  texte text not null check (length(texte) <= 10000),
  liens text[] not null default '{}' check (prive.liens_valides(liens) and cardinality(liens) <= 10),
  cree_par uuid,
  cree_le timestamptz not null default now(),
  modifie_le timestamptz not null default now()
);

create table if not exists public.histoire_createurs (
  histoire_id bigint not null references public.histoire (id) on delete cascade,
  createur_id bigint not null references public.createurs (id) on delete cascade,
  primary key (histoire_id, createur_id)
);

-- ---------- Partie privée de chaque éditrice ----------
create table if not exists public.perso_steps (
  personne uuid not null default auth.uid(),
  step_id bigint not null references public.steps (id) on delete cascade,
  niveau text check (niveau in ('a_apprendre', 'en_cours', 'maitrise')),
  a_travailler boolean not null default false,
  notes text check (length(notes) <= 2000),
  modifie_le timestamptz not null default now(),
  primary key (personne, step_id)
);

create table if not exists public.cours (
  id bigint generated always as identity primary key,
  personne uuid not null default auth.uid(),
  jour date not null,
  prof_texte text check (length(prof_texte) <= 80),
  prof_createur_id bigint references public.createurs (id) on delete set null,
  salle text check (length(salle) <= 80),
  lien_chore text check (lien_chore ~ '^https://\S+$'),
  notes text check (length(notes) <= 3000),
  cree_le timestamptz not null default now(),
  modifie_le timestamptz not null default now()
);
create index if not exists cours_personne_jour on public.cours (personne, jour desc);

create table if not exists public.cours_steps (
  cours_id bigint not null references public.cours (id) on delete cascade,
  step_id bigint not null references public.steps (id) on delete cascade,
  primary key (cours_id, step_id)
);

-- Dates de la partie privée
create or replace function prive.date_modif_perso()
returns trigger language plpgsql set search_path = '' as $$
begin
  if tg_op = 'INSERT' then
    new.personne := coalesce(auth.uid(), new.personne);  -- tests du SQL Editor : personne donnée par le script
    if tg_table_name = 'cours' then new.cree_le := now(); end if;
  else
    new.personne := old.personne;
    if tg_table_name = 'cours' then new.cree_le := old.cree_le; end if;
  end if;
  new.modifie_le := clock_timestamp();
  return new;
end $$;

-- ---------- Déclencheurs ----------
drop trigger if exists dates on public.lieux;
create trigger dates before insert or update on public.lieux for each row execute function prive.dates_avant_ecriture();
drop trigger if exists verifier on public.lieux;
create trigger verifier before insert or update on public.lieux for each row execute function prive.verifier_lieu();

drop trigger if exists dates on public.createurs;
create trigger dates before insert or update on public.createurs for each row execute function prive.dates_avant_ecriture();

drop trigger if exists verifier on public.membres_crew;
create trigger verifier before insert or update on public.membres_crew for each row execute function prive.verifier_membre();

drop trigger if exists dates on public.steps;
create trigger dates before insert or update on public.steps for each row execute function prive.dates_avant_ecriture();

drop trigger if exists dates on public.lexique;
create trigger dates before insert or update on public.lexique for each row execute function prive.dates_avant_ecriture();

drop trigger if exists dates on public.histoire;
create trigger dates before insert or update on public.histoire for each row execute function prive.dates_avant_ecriture();

drop trigger if exists dates on public.perso_steps;
create trigger dates before insert or update on public.perso_steps for each row execute function prive.date_modif_perso();

drop trigger if exists dates on public.cours;
create trigger dates before insert or update on public.cours for each row execute function prive.date_modif_perso();
