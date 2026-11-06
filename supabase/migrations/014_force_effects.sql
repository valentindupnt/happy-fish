-- Happy Fish, migration 014 : effets des messages de force
-- On choisit l'effet d'un mot juste avant de l'envoyer (pop, cœurs, bulles ou confettis, tout en violet).
-- Chaque message de force (propre à chaque compte) peut aussi avoir un effet habituel, facultatif, réglé dans les réglages.
-- L'effet est gardé sur le petit mot envoyé, pour que l'autre le voie arriver avec la même couleur.
-- Les mots existants reçoivent « pop » comme effet habituel. Un compte qui n'a aucun mot reçoit trois mots tout prêts
-- (Tu gères, Courage, Fier de toi), qu'il peut ensuite modifier ou supprimer.
-- À coller une seule fois dans le SQL Editor, après 013_transfer.sql.

do $$
begin
  if exists (select 1 from public.schema_migrations where name = '014_force_effects') then
    raise exception 'La migration 014_force_effects est déjà appliquée, rien à faire';
  end if;
end $$;

alter table public.force_messages add column effect text
  check (effect is null or effect in ('pop', 'coeurs', 'bulles', 'confettis'));

alter table public.messages add column effect text
  check (effect is null or effect in ('pop', 'coeurs', 'bulles', 'confettis'));
alter table public.messages add constraint messages_effect_text
  check (effect is null or kind = 'text');

update public.force_messages set effect = 'pop';

insert into public.force_messages (profile_id, body, position, effect)
select p.id, w.body, w.position, 'pop'
from public.profiles p
cross join (values ('Tu gères', 1), ('Courage', 2), ('Fier de toi', 3)) as w(body, position)
where p.couple_id is not null
  and not exists (select 1 from public.force_messages f where f.profile_id = p.id);

insert into public.schema_migrations (name) values ('014_force_effects');
