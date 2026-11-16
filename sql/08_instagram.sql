-- 08_instagram.sql
-- Compte Instagram d'un créateur (crew ou personne) : juste le nom du compte, sans @ ni adresse.
-- L'appli en fait un lien « @nom » vers https://www.instagram.com/nom/. Visible par tous les membres.
-- À lancer après 01 à 07. Rejouable sans erreur.

alter table public.createurs add column if not exists instagram text
  constraint instagram_valide check (instagram ~ '^[A-Za-z0-9._]{1,30}$');
grant insert (instagram), update (instagram) on public.createurs to authenticated;

-- Essai : un nom correct est accepté, un nom avec un espace ou un / est refusé. Rien n'est gardé après l'essai.
do $$
declare refus int := 0; essai text;
begin
  insert into public.createurs (type, nom, instagram) values ('personne', '__test__ 08', 'nom.du_compte1');
  foreach essai in array array['avec espace', 'https://instagram.com/x', '@arobase'] loop
    begin
      update public.createurs set instagram = essai where nom = '__test__ 08';
    exception when check_violation then refus := refus + 1;
    end;
  end loop;
  delete from public.createurs where nom = '__test__ 08';
  if refus <> 3 then raise exception 'Essai raté : % refus sur 3', refus; end if;
end $$;
select 'ok : compte Instagram des créateurs' as essai;
