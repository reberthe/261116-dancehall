-- 00_test_connexion.sql
-- Table de test pour vérifier que la page test/connexion.html parle bien à Supabase.
-- À lancer dans Supabase → SQL Editor. Rejouable sans erreur.
-- À supprimer ensuite avec 00_test_nettoyage.sql.

create table if not exists public.test_connexion (
  id bigint generated always as identity primary key,
  message text not null unique,
  cree_le timestamptz not null default now()
);

-- RLS activée, comme sur toutes les tables
alter table public.test_connexion enable row level security;

-- Lecture ouverte à tous pendant le test seulement (aucune écriture depuis l'appli)
drop policy if exists "test lecture" on public.test_connexion;
create policy "test lecture" on public.test_connexion
  for select to anon, authenticated using (true);

-- « Automatically expose new tables » est désactivé : on donne l'accès à la main
grant select on public.test_connexion to anon, authenticated;

insert into public.test_connexion (message)
values ('Bonjour depuis Supabase 🇯🇲')
on conflict (message) do nothing;

-- Vérification : doit afficher une ligne
select id, message, cree_le from public.test_connexion;
