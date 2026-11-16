-- 03_stockage.sql
-- Dossier fermé « photos » pour les photos de profil des créateurs. À lancer après 02_securite.sql. Rejouable.
-- Une photo par créateur : createurs/<identifiant>.jpg (JPEG réduit à 400 × 400 par l'appli, 1 Mo au plus).
-- Remplacer une photo écrase l'ancienne : Jade n'a donc jamais besoin du droit de supprimer.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('photos', 'photos', false, 1048576, array['image/jpeg'])
on conflict (id) do update
  set public = false, file_size_limit = 1048576, allowed_mime_types = array['image/jpeg'];

-- Tout membre connecté voit les photos
drop policy if exists "photos lecture" on storage.objects;
create policy "photos lecture" on storage.objects for select to authenticated
  using (bucket_id = 'photos' and (select prive.est_membre()));

-- Emma et Jade ajoutent et remplacent, seulement au bon endroit
drop policy if exists "photos ajout" on storage.objects;
create policy "photos ajout" on storage.objects for insert to authenticated
  with check (bucket_id = 'photos' and (select prive.est_editrice()) and name ~ '^createurs/[0-9]+\.jpg$');

drop policy if exists "photos remplacement" on storage.objects;
create policy "photos remplacement" on storage.objects for update to authenticated
  using (bucket_id = 'photos' and (select prive.est_editrice()))
  with check (bucket_id = 'photos' and (select prive.est_editrice()) and name ~ '^createurs/[0-9]+\.jpg$');

-- Seule Emma supprime
drop policy if exists "photos suppression" on storage.objects;
create policy "photos suppression" on storage.objects for delete to authenticated
  using (bucket_id = 'photos' and (select prive.est_admin()));

-- Vérification : doit afficher le dossier « photos », fermé (public = false)
select id, public, file_size_limit, allowed_mime_types from storage.buckets where id = 'photos';
