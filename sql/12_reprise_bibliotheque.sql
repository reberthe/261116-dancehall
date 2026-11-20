-- 12_reprise_bibliotheque.sql
-- Reprise faite UNE seule fois, après 11_espace_prive.sql et avant de publier l'appli 4a6 :
-- un step qui a déjà un niveau, « À travailler » ou une note entre dans « Ma bibliothèque » de sa propriétaire.
-- Sans ça, ces infos (écrites avant la bibliothèque) ne seraient plus visibles dans l'appli.
-- Rejouable sans risque : la reprise est notée dans prive.reprises, et une 2e fois ne change plus rien
-- (un step retiré de la bibliothèque plus tard n'y revient donc pas).

create table if not exists prive.reprises (
  nom text primary key,
  faite_le timestamptz not null default now(),
  lignes int
);
revoke all on prive.reprises from public, anon, authenticated;

do $$
declare n int;
begin
  insert into prive.reprises (nom) values ('bibliotheque') on conflict (nom) do nothing;
  if not found then return; end if;   -- déjà faite
  update public.perso_steps set dans_biblio = true
  where not dans_biblio and (niveau is not null or a_travailler or notes is not null);
  get diagnostics n = row_count;
  update prive.reprises set lignes = n where nom = 'bibliotheque';
end $$;

-- Vérification : quand la reprise a été faite, et combien de steps sont dans chaque bibliothèque « à la main »
select 'reprise faite le ' || to_char(r.faite_le at time zone 'Europe/Brussels', 'DD/MM/YYYY HH24:MI') || ' : ' || r.lignes || ' step(s) ajouté(s)' as resultat
from prive.reprises r where r.nom = 'bibliotheque'
union all
select m.prenom || ' : ' || count(p.step_id) || ' step(s) dans sa bibliothèque à la main'
from prive.membres m left join public.perso_steps p on p.personne = m.id and p.dans_biblio
group by m.prenom;
