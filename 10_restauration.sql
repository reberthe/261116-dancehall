-- 10_restauration.sql
-- Remet en place une sauvegarde faite avec 09_sauvegarde.sql. À n'utiliser qu'en cas de perte des données.
-- Avant : les scripts 01 à 08 doivent avoir été lancés (les tables existent) et les tables doivent être VIDES
-- (le script s'arrête sinon : il n'écrase jamais rien). Les comptes (Authentication → Users) doivent exister :
-- un rôle dont le compte n'existe plus est ignoré.
--
-- Mode d'emploi : remplacer la ligne COLLER_ICI par tout le contenu du fichier de sauvegarde, puis Run.
-- Tout se fait d'un bloc : en cas d'erreur, rien n'est écrit.

do $restauration$
declare
  d jsonb := $sauvegarde$
COLLER_ICI
$sauvegarde$::jsonb;
  t text;
  tables text[] := array['lieux', 'createurs', 'membres_crew', 'steps', 'lexique', 'histoire',
                         'histoire_createurs', 'perso_steps', 'cours', 'cours_steps', 'modifications'];
  n int;
begin
  if d->>'version' is distinct from '1' then raise exception 'Ce texte n''est pas une sauvegarde de Riddim (version 1).'; end if;
  foreach t in array tables loop
    execute format('select count(*) from public.%I', t) into n;
    if n > 0 then raise exception 'La table % n''est pas vide : restauration annulée.', t; end if;
  end loop;

  -- Pendant la restauration, les déclencheurs (dates, « modifié par »…) sont coupés : on garde les valeurs d'origine
  foreach t in array tables loop
    execute format('alter table public.%I disable trigger user', t);
  end loop;

  -- Dans l'ordre des liens : villes avant quartiers, créateurs avant steps, etc.
  insert into public.lieux overriding system value
    select * from jsonb_populate_recordset(null::public.lieux, d->'lieux') order by (type = 'quartier'), id;
  insert into public.createurs overriding system value select * from jsonb_populate_recordset(null::public.createurs, d->'createurs');
  insert into public.membres_crew select * from jsonb_populate_recordset(null::public.membres_crew, d->'membres_crew');
  insert into public.sous_categories select * from jsonb_populate_recordset(null::public.sous_categories, d->'sous_categories')
    on conflict (cle) do nothing;
  insert into public.steps overriding system value select * from jsonb_populate_recordset(null::public.steps, d->'steps');
  insert into public.lexique overriding system value select * from jsonb_populate_recordset(null::public.lexique, d->'lexique');
  insert into public.histoire overriding system value select * from jsonb_populate_recordset(null::public.histoire, d->'histoire');
  insert into public.histoire_createurs select * from jsonb_populate_recordset(null::public.histoire_createurs, d->'histoire_createurs');
  insert into public.perso_steps select * from jsonb_populate_recordset(null::public.perso_steps, d->'perso_steps');
  insert into public.cours overriding system value select * from jsonb_populate_recordset(null::public.cours, d->'cours');
  insert into public.cours_steps overriding system value select * from jsonb_populate_recordset(null::public.cours_steps, d->'cours_steps');
  insert into public.modifications select * from jsonb_populate_recordset(null::public.modifications, d->'modifications');
  insert into prive.membres
    select m.* from jsonb_populate_recordset(null::prive.membres, d->'membres') m
    where exists (select 1 from auth.users u where u.id = m.id)
    on conflict (id) do update set role = excluded.role, prenom = excluded.prenom;

  foreach t in array tables loop
    execute format('alter table public.%I enable trigger user', t);
  end loop;

  -- Les compteurs des identifiants repartent après le plus grand identifiant restauré
  foreach t in array array['lieux', 'createurs', 'steps', 'lexique', 'histoire', 'cours', 'cours_steps'] loop
    execute format('select setval(pg_get_serial_sequence(%L, ''id''), coalesce((select max(id) from public.%I), 0) + 1, false)', 'public.' || t, t);
  end loop;
end $restauration$;

-- Vérification : à comparer avec la sauvegarde
select 'ok : ' || (select count(*) from public.steps) || ' steps, ' || (select count(*) from public.createurs) || ' créateurs, '
  || (select count(*) from public.cours) || ' cours, ' || (select count(*) from prive.membres) || ' membres' as resultat;
