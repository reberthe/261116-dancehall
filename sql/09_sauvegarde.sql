-- 09_sauvegarde.sql
-- Sauvegarde de toute la base en un seul résultat (texte JSON), à lancer dans le SQL Editor, une fois par mois.
-- ⚠️ Le résultat contient tout, y compris les cours et la partie privée de chacune (Jade et les copines), les prénoms et les rôles :
--    à garder sur l'ordi d'Emma (ex. sauvegarde_2026-12-01.json), JAMAIS sur GitHub.
-- Les photos (Storage) ne sont pas dedans : Supabase ne les sauvegarde pas non plus avec la base.
-- Ne modifie rien : on peut le lancer autant de fois qu'on veut.

select jsonb_build_object(
  'sauvegarde_le', now(),
  'version', 1,
  'lieux',              (select coalesce(jsonb_agg(to_jsonb(t) order by t.id), '[]') from public.lieux t),
  'createurs',          (select coalesce(jsonb_agg(to_jsonb(t) order by t.id), '[]') from public.createurs t),
  'membres_crew',       (select coalesce(jsonb_agg(to_jsonb(t) order by t.crew_id, t.personne_id), '[]') from public.membres_crew t),
  'sous_categories',    (select coalesce(jsonb_agg(to_jsonb(t) order by t.ordre), '[]') from public.sous_categories t),
  'steps',              (select coalesce(jsonb_agg(to_jsonb(t) order by t.id), '[]') from public.steps t),
  'lexique',            (select coalesce(jsonb_agg(to_jsonb(t) order by t.id), '[]') from public.lexique t),
  'histoire',           (select coalesce(jsonb_agg(to_jsonb(t) order by t.id), '[]') from public.histoire t),
  'histoire_createurs', (select coalesce(jsonb_agg(to_jsonb(t) order by t.histoire_id, t.createur_id), '[]') from public.histoire_createurs t),
  'perso_steps',        (select coalesce(jsonb_agg(to_jsonb(t) order by t.personne, t.step_id), '[]') from public.perso_steps t),
  'cours',              (select coalesce(jsonb_agg(to_jsonb(t) order by t.id), '[]') from public.cours t),
  'cours_steps',        (select coalesce(jsonb_agg(to_jsonb(t) order by t.id), '[]') from public.cours_steps t),
  'modifications',      (select coalesce(jsonb_agg(to_jsonb(t) order by t.table_nom, t.fiche_id), '[]') from public.modifications t),
  'membres',            (select coalesce(jsonb_agg(to_jsonb(t) order by t.id), '[]') from prive.membres t)
)::text as sauvegarde;
