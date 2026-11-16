-- 05_depart.sql
-- Données de départ, relues par Emma le 16/11/2026. À lancer après donnees/01_membres.sql. Rejouable sans erreur :
-- une ligne qui existe déjà n'est ni ajoutée une 2e fois ni modifiée.
-- Seulement des faits publics (noms, créateurs, époques), avec leurs sources ; aucun texte recopié.
-- Auteur des lignes : Emma (le compte « admin »).

do $$
declare
  emma uuid := (select id from prive.membres where role = 'admin' limit 1);
  kingston bigint;
  trench_town bigint;
  black_roses bigint;
  bogle bigint;
  happy_feet bigint;
begin
  if emma is null then
    raise exception 'Lance d''abord donnees/01_membres.sql (aucun compte admin)';
  end if;

  -- ---------- Lieux ----------
  insert into public.lieux (type, nom, pays, latitude, longitude, cree_par)
  select 'ville', 'Kingston', 'Jamaïque', 17.99702, -76.79358, emma   -- latitudelongitude.org
  where not exists (select 1 from public.lieux where type = 'ville' and lower(nom) = 'kingston');
  select id into kingston from public.lieux where type = 'ville' and lower(nom) = 'kingston';

  insert into public.lieux (type, nom, ville_id, pays, latitude, longitude, cree_par)
  select 'quartier', 'Trench Town', kingston, 'Jamaïque', 17.98500, -76.79667, emma   -- Wikipédia
  where not exists (select 1 from public.lieux where type = 'quartier' and ville_id = kingston and lower(nom) = 'trench town');
  select id into trench_town from public.lieux where type = 'quartier' and ville_id = kingston and lower(nom) = 'trench town';

  -- ---------- Créateurs ----------
  insert into public.createurs (type, nom, etiquette, lieu_id, epoques, histoire, liens, cree_par)
  select 'crew', 'Black Roses Crew', 'man', trench_town, array['old_school'],
         'Crew de Trench Town mené par William « Willie Haggart » Moore, un des grands noms des années 1990. Bogle en est un membre fondateur.',
         array['https://jamaicaobserver.com/2022/09/15/bogle-man-with-the-moves', 'https://jamaicaobserver.com/2018/01/19/remembering-dancer-bogle'],
         emma
  where not exists (select 1 from public.createurs where type = 'crew' and lower(nom) = 'black roses crew');

  insert into public.createurs (type, nom, autres_noms, vrai_nom, etiquette, epoques, histoire, liens, cree_par)
  select 'personne', 'Bogle', 'Mr Wacky, Mr Bogle, Father Bogle', 'Gerald Levy', 'man', array['old_school'],
         'Né en 1964 à Trench Town, à Kingston, mort en 2005. Membre fondateur du Black Roses Crew. Connu dans tout le pays en 1992 grâce à « Bogle », le morceau que Buju Banton a écrit sur sa danse.',
         array['https://en.wikipedia.org/wiki/Bogle_(dancer)'], emma
  where not exists (select 1 from public.createurs where type = 'personne' and lower(nom) = 'bogle');

  insert into public.createurs (type, nom, vrai_nom, etiquette, cree_par)
  select v.type, v.nom, v.vrai_nom, 'man', emma
  from (values ('personne', 'Willie Haggart', 'William Moore'),
               ('personne', 'Ice', 'David Smith'),
               ('personne', 'Michael Stewart', null),
               ('personne', 'Boysie', 'Lonsdale Guy')) as v(type, nom, vrai_nom)
  where not exists (select 1 from public.createurs c where c.type = v.type and lower(c.nom) = lower(v.nom));

  insert into public.createurs (type, nom, vrai_nom, etiquette, lieu_id, histoire, liens, cree_par)
  select 'personne', 'Happy Feet', 'Toni Gay O''Meally', 'gyal', kingston,
         'Née à Kingston. Danseuse et chorégraphe, elle accompagne Shenseea sur scène.',
         array['https://www.jamaicaobserver.com/2021/11/11/fancy-footwork/'], emma
  where not exists (select 1 from public.createurs where type = 'personne' and lower(nom) = 'happy feet');

  select id into black_roses from public.createurs where type = 'crew' and lower(nom) = 'black roses crew';
  select id into bogle from public.createurs where type = 'personne' and lower(nom) = 'bogle';
  select id into happy_feet from public.createurs where type = 'personne' and lower(nom) = 'happy feet';

  -- Membres du Black Roses Crew (Jamaica Observer, 2018)
  insert into public.membres_crew (crew_id, personne_id, fondateur)
  select black_roses, c.id, (c.id = bogle)
  from public.createurs c
  where c.type = 'personne' and lower(c.nom) in ('bogle', 'willie haggart', 'ice', 'michael stewart', 'boysie')
  on conflict (crew_id, personne_id) do nothing;

  -- ---------- Steps de Bogle : old school, neutres ----------
  insert into public.steps (nom, autres_noms, createur_id, epoque, etiquette, chanson, note_attribution, sources, cree_par)
  select v.nom, v.autres, bogle, 'old_school', 'neutre', v.chanson, v.note, v.sources, emma
  from (values
    ('Bogle', 'Bogle Dance, Bogle Move', '« Bogle », Buju Banton (1992)', null, 'Wikipédia ; dépôt GitHub dancehall-steps ; wiki Fandom'),
    ('Willie Bounce', null, null, 'Old school pour le dépôt GitHub, mais devenu célèbre après la mort de Bogle (2005) d''après le Jamaica Observer.', 'Wikipédia ; dépôt GitHub dancehall-steps ; Jamaica Observer'),
    ('Wacky Dip', null, null, null, 'Wikipédia ; dépôt GitHub dancehall-steps'),
    ('Urkle Dance', null, null, null, 'Wikipédia ; dépôt GitHub dancehall-steps'),
    ('Sesame Street', null, null, null, 'Wikipédia ; dépôt GitHub dancehall-steps'),
    ('Jerry Springer', 'LOY', null, null, 'Wikipédia ; dépôt GitHub dancehall-steps'),
    ('Zip It Up', null, null, null, 'Wikipédia ; dépôt GitHub dancehall-steps'),
    ('World Dance', null, null, null, 'Wikipédia ; dépôt GitHub dancehall-steps'),
    ('Row di Boat', null, null, null, 'Wikipédia ; dépôt GitHub dancehall-steps'),
    ('Pop Yuh Collar', null, null, null, 'Wikipédia ; dépôt GitHub dancehall-steps'),
    ('Back to Basics', null, null, null, 'Dépôt GitHub dancehall-steps ; wiki Fandom'),
    ('Jiggy', null, null, null, 'Dépôt GitHub dancehall-steps'),
    ('Log On', null, null, null, 'Dépôt GitHub dancehall-steps'),
    ('Pelper', null, null, null, 'Wikipédia'),
    ('Hotti Hotti Bogle', null, null, null, 'Wikipédia'),
    ('Out and Bad', null, null, null, 'Wikipédia'),
    ('Sweeper', null, null, null, 'Wikipédia')
  ) as v(nom, autres, chanson, note, sources)
  where not exists (select 1 from public.steps s where lower(s.nom) = lower(v.nom));

  -- ---------- Steps de Happy Feet : gyal, époque à renseigner ----------
  insert into public.steps (nom, createur_id, etiquette, sources, cree_par)
  select v.nom, happy_feet, 'gyal', 'Présentation de ses stages (Humanitix, Sydney Dancehall Workshops)', emma
  from (values ('Happy Jook'), ('Up in Deh'), ('Set It'), ('Guh Dung')) as v(nom)
  where not exists (select 1 from public.steps s where lower(s.nom) = lower(v.nom));
end $$;

-- Vérification : 2 lieux, 7 créateurs, 5 membres, 21 steps
select
  (select count(*) from public.lieux) as lieux,
  (select count(*) from public.createurs) as createurs,
  (select count(*) from public.membres_crew) as membres,
  (select count(*) from public.steps) as steps;
