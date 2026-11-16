-- 00_test_nettoyage.sql
-- Supprime la table de test. À lancer dans Supabase → SQL Editor à la fin de l'étape 1. Rejouable.

drop table if exists public.test_connexion;

-- Vérification : doit afficher « false »
select exists (
  select 1 from information_schema.tables
  where table_schema = 'public' and table_name = 'test_connexion'
) as table_encore_la;
