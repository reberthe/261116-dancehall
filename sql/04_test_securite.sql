-- 04_test_securite.sql
-- Test des règles d'accès, en se faisant passer pour chaque compte. À lancer dans Supabase → SQL Editor,
-- après donnees/01_membres.sql. Rejouable : les lignes de test (« __test__ ») sont supprimées à la fin.
-- Résultat attendu : toutes les lignes avec ok = true.
-- Les photos (dossier « photos ») seront testées depuis l'iPhone à l'étape 3.

create temp table if not exists resultats (n int, compte text, test text, ok boolean);
truncate resultats;

do $$
declare
  emma uuid := (select id from prive.membres where role = 'admin' limit 1);
  jade uuid := (select id from prive.membres where role = 'editrice' limit 1);
  copine uuid := (select id from prive.membres where role = 'lectrice' limit 1);
  inconnu uuid := gen_random_uuid();   -- un compte connecté qui n'est pas membre
  noms text[] := '{}';
  comptes text[] := '{}';
  oks boolean[] := '{}';
  id_crew bigint; id_pers bigint; id_step bigint; id_step2 bigint; id_lex bigint; id_cours bigint;
  nb int; ok boolean; date_avant timestamptz; txt text;
begin
  if emma is null or jade is null or copine is null then
    raise exception 'Il faut un compte admin, un compte editrice et un compte lectrice dans prive.membres';
  end if;

  -- ---------- Lignes de test (créées sans passer par l'API) ----------
  insert into public.createurs (type, nom, cree_par) values ('crew', '__test__ crew', emma) returning id into id_crew;
  insert into public.createurs (type, nom, etiquette, cree_par) values ('personne', '__test__ personne', 'gyal', emma) returning id into id_pers;
  insert into public.membres_crew (crew_id, personne_id) values (id_crew, id_pers);
  insert into public.steps (nom, createur_id, cree_par) values ('__test__ step 1', id_crew, emma) returning id into id_step;
  insert into public.steps (nom, cree_par) values ('__test__ step 2', emma) returning id into id_step2;
  insert into public.lexique (terme, definition, cree_par) values ('__test__ terme', 'définition', emma) returning id into id_lex;
  insert into public.perso_steps (personne, step_id, notes) values (emma, id_step, 'note Emma'), (jade, id_step, 'note Jade');
  insert into public.cours (personne, jour, notes) values (emma, current_date, '__test__ cours Emma') returning id into id_cours;
  insert into public.cours_steps (cours_id, step_id) values (id_cours, id_step);

  -- =================== EMMA (admin) ===================
  perform set_config('request.jwt.claim.sub', emma::text, true);
  perform set_config('request.jwt.claims', json_build_object('sub', emma, 'role', 'authenticated')::text, true);
  set local role authenticated;

  select count(*) into nb from public.steps where nom like '__test__%';
  comptes := comptes || text 'Emma'; noms := noms || text 'voit les steps'; oks := oks || (nb = 2);

  begin insert into public.steps (nom) values ('__test__ step Emma'); ok := true; exception when others then ok := false; end;
  comptes := comptes || text 'Emma'; noms := noms || text 'ajoute un step'; oks := oks || ok;

  update public.steps set chanson = 'test' where id = id_step; get diagnostics nb = row_count;
  comptes := comptes || text 'Emma'; noms := noms || text 'modifie un step'; oks := oks || (nb = 1);

  select prenom into txt from public.modifications where table_nom = 'steps' and fiche_id = id_step;
  comptes := comptes || text 'Emma'; noms := noms || text 'voit « modifié par Emma »'; oks := oks || (txt = 'Emma');

  delete from public.steps where nom = '__test__ step Emma'; get diagnostics nb = row_count;
  comptes := comptes || text 'Emma'; noms := noms || text 'supprime un step'; oks := oks || (nb = 1);

  select count(*) into nb from public.perso_steps where step_id = id_step;
  comptes := comptes || text 'Emma'; noms := noms || text 'voit sa note perso, pas celle de Jade'; oks := oks || (nb = 1);

  select count(*) into nb from public.cours where id = id_cours;
  comptes := comptes || text 'Emma'; noms := noms || text 'voit son cours'; oks := oks || (nb = 1);

  begin update public.createurs set etiquette = 'mixte' where id = id_pers; ok := false; exception when others then ok := true; end;
  comptes := comptes || text 'Emma'; noms := noms || text 'la base refuse « mixte » pour une personne'; oks := oks || ok;

  begin update public.steps set liens = array['http://exemple.com'] where id = id_step; ok := false; exception when others then ok := true; end;
  comptes := comptes || text 'Emma'; noms := noms || text 'la base refuse un lien sans https'; oks := oks || ok;

  begin insert into public.lieux (type, nom, latitude, longitude) values ('quartier', '__test__ quartier', 18, -77); ok := false; exception when others then ok := true; end;
  comptes := comptes || text 'Emma'; noms := noms || text 'la base refuse un quartier sans ville'; oks := oks || ok;

  reset role;

  -- =================== JADE (éditrice) ===================
  perform set_config('request.jwt.claim.sub', jade::text, true);
  perform set_config('request.jwt.claims', json_build_object('sub', jade, 'role', 'authenticated')::text, true);
  set local role authenticated;

  select count(*) into nb from public.steps where nom like '__test__%';
  comptes := comptes || text 'Jade'; noms := noms || text 'voit les steps'; oks := oks || (nb = 2);

  begin insert into public.steps (nom) values ('__test__ step Jade'); ok := true; exception when others then ok := false; end;
  comptes := comptes || text 'Jade'; noms := noms || text 'ajoute un step'; oks := oks || ok;

  update public.steps set chanson = 'test Jade' where id = id_step; get diagnostics nb = row_count;
  comptes := comptes || text 'Jade'; noms := noms || text 'modifie un step'; oks := oks || (nb = 1);

  select prenom into txt from public.modifications where table_nom = 'steps' and fiche_id = id_step;
  comptes := comptes || text 'Jade'; noms := noms || text 'voit « modifié par Jade »'; oks := oks || (txt = 'Jade');

  delete from public.steps where id = id_step2; get diagnostics nb = row_count;
  comptes := comptes || text 'Jade'; noms := noms || text 'ne supprime pas un step'; oks := oks || (nb = 0);

  delete from public.createurs where id = id_pers; get diagnostics nb = row_count;
  comptes := comptes || text 'Jade'; noms := noms || text 'ne supprime pas un créateur'; oks := oks || (nb = 0);

  delete from public.lexique where id = id_lex; get diagnostics nb = row_count;
  comptes := comptes || text 'Jade'; noms := noms || text 'ne supprime pas un terme du lexique'; oks := oks || (nb = 0);

  delete from public.membres_crew where crew_id = id_crew and personne_id = id_pers; get diagnostics nb = row_count;
  comptes := comptes || text 'Jade'; noms := noms || text 'peut retirer un membre d''un crew'; oks := oks || (nb = 1);

  select count(*) into nb from public.perso_steps where step_id = id_step;
  comptes := comptes || text 'Jade'; noms := noms || text 'voit sa note perso, pas celle d''Emma'; oks := oks || (nb = 1);

  select count(*) into nb from public.cours where id = id_cours;
  comptes := comptes || text 'Jade'; noms := noms || text 'ne voit pas les cours d''Emma'; oks := oks || (nb = 0);

  begin insert into public.perso_steps (personne, step_id) values (emma, id_step2); ok := false; exception when others then ok := true; end;
  comptes := comptes || text 'Jade'; noms := noms || text 'ne peut pas écrire au nom d''Emma'; oks := oks || ok;

  begin insert into public.steps (nom, cree_par) values ('__test__ faux auteur', emma); ok := false; exception when others then ok := true; end;
  comptes := comptes || text 'Jade'; noms := noms || text 'ne peut pas choisir l''auteur d''une fiche'; oks := oks || ok;

  begin insert into public.modifications (table_nom, fiche_id, prenom) values ('steps', id_step, 'Emma'); ok := false; exception when others then ok := true; end;
  comptes := comptes || text 'Jade'; noms := noms || text 'ne peut pas écrire dans « modifié par »'; oks := oks || ok;

  -- « Cette fiche a été modifiée entre-temps » : la 2e mise à jour avec l'ancienne date ne touche rien
  select modifie_le into date_avant from public.steps where id = id_step2;
  update public.steps set chanson = 'version 1' where id = id_step2 and modifie_le = date_avant;
  update public.steps set chanson = 'version 2' where id = id_step2 and modifie_le = date_avant; get diagnostics nb = row_count;
  comptes := comptes || text 'Jade'; noms := noms || text 'n''écrase pas une fiche modifiée entre-temps'; oks := oks || (nb = 0);

  reset role;

  -- =================== COPINE (lectrice) ===================
  perform set_config('request.jwt.claim.sub', copine::text, true);
  perform set_config('request.jwt.claims', json_build_object('sub', copine, 'role', 'authenticated')::text, true);
  set local role authenticated;

  select count(*) into nb from public.steps where nom like '__test__%';
  comptes := comptes || text 'Copine'; noms := noms || text 'voit les steps'; oks := oks || (nb >= 2);

  select count(*) into nb from public.modifications;
  comptes := comptes || text 'Copine'; noms := noms || text 'ne voit pas « modifié par »'; oks := oks || (nb = 0);

  begin insert into public.steps (nom) values ('__test__ step copine'); ok := false; exception when others then ok := true; end;
  comptes := comptes || text 'Copine'; noms := noms || text 'ne peut pas ajouter un step'; oks := oks || ok;

  update public.steps set chanson = 'copine' where id = id_step; get diagnostics nb = row_count;
  comptes := comptes || text 'Copine'; noms := noms || text 'ne peut pas modifier un step'; oks := oks || (nb = 0);

  delete from public.steps where id = id_step; get diagnostics nb = row_count;
  comptes := comptes || text 'Copine'; noms := noms || text 'ne peut pas supprimer un step'; oks := oks || (nb = 0);

  select count(*) into nb from public.perso_steps;
  comptes := comptes || text 'Copine'; noms := noms || text 'ne voit aucune partie privée'; oks := oks || (nb = 0);

  begin insert into public.perso_steps (step_id, notes) values (id_step, 'copine'); ok := false; exception when others then ok := true; end;
  comptes := comptes || text 'Copine'; noms := noms || text 'n''a pas de partie privée'; oks := oks || ok;

  select count(*) into nb from public.cours;
  comptes := comptes || text 'Copine'; noms := noms || text 'ne voit aucun cours'; oks := oks || (nb = 0);

  begin perform 1 from prive.membres; ok := false; exception when others then ok := true; end;
  comptes := comptes || text 'Copine'; noms := noms || text 'ne lit pas la liste des membres'; oks := oks || ok;

  reset role;

  -- =================== COMPTE CONNECTÉ, PAS MEMBRE ===================
  perform set_config('request.jwt.claim.sub', inconnu::text, true);
  perform set_config('request.jwt.claims', json_build_object('sub', inconnu, 'role', 'authenticated')::text, true);
  set local role authenticated;

  select count(*) into nb from public.steps;
  comptes := comptes || text 'Sans rôle'; noms := noms || text 'ne voit aucun step'; oks := oks || (nb = 0);

  select (select count(*) from public.createurs) + (select count(*) from public.lieux) + (select count(*) from public.lexique) into nb;
  comptes := comptes || text 'Sans rôle'; noms := noms || text 'ne voit aucun créateur, lieu ni terme'; oks := oks || (nb = 0);

  begin insert into public.steps (nom) values ('__test__ step inconnu'); ok := false; exception when others then ok := true; end;
  comptes := comptes || text 'Sans rôle'; noms := noms || text 'ne peut rien ajouter'; oks := oks || ok;

  select count(*) into nb from public.mon_profil();
  comptes := comptes || text 'Sans rôle'; noms := noms || text 'n''a pas de profil'; oks := oks || (nb = 0);

  reset role;

  -- =================== VISITEUR NON CONNECTÉ ===================
  perform set_config('request.jwt.claim.sub', '', true);
  perform set_config('request.jwt.claims', '{"role":"anon"}', true);
  set local role anon;

  begin perform 1 from public.steps limit 1; ok := false; exception when others then ok := true; end;
  comptes := comptes || text 'Visiteur'; noms := noms || text 'ne lit pas les steps'; oks := oks || ok;

  begin perform 1 from public.mon_profil(); ok := false; exception when others then ok := true; end;
  comptes := comptes || text 'Visiteur'; noms := noms || text 'ne peut pas appeler mon_profil()'; oks := oks || ok;

  reset role;
  perform set_config('request.jwt.claims', '{}', true);

  -- ---------- Nettoyage ----------
  delete from public.cours where id = id_cours;
  delete from public.steps where nom like '__test__%';
  delete from public.lexique where id = id_lex;
  delete from public.lieux where nom like '__test__%';
  delete from public.createurs where nom like '__test__%';

  for i in 1 .. array_length(noms, 1) loop
    insert into resultats values (i, comptes[i], noms[i], oks[i]);
  end loop;
end $$;

select n, compte, test, ok from resultats
union all
select 99, 'TOTAL', count(*) filter (where ok) || ' / ' || count(*) || ' réussis', bool_and(ok) from resultats
order by n;
