-- Happy Fish, migration 011 : la roue des surprises tire dans la base
-- Celui qui n'a pas raté lance la roue, une seule fois par bilan à 3 ratés. Le tirage se fait dans la base
-- (au hasard parmi les idées de surprise du duo) et reste enregistré : valable sur tous les appareils.
-- À coller une seule fois dans le SQL Editor, après 010_gifs.sql.
-- Ne touche à aucune donnée existante.

do $$
begin
  if exists (select 1 from public.schema_migrations where name = '011_wheel') then
    raise exception 'La migration 011_wheel est déjà appliquée, rien à faire';
  end if;
end $$;

alter table public.weekly_reviews add column surprise_pick text;
alter table public.weekly_reviews add column surprise_picked_at timestamptz;

create or replace function public.spin_wheel(p_review uuid) returns text
language plpgsql security definer set search_path = public as $$
declare r public.weekly_reviews; pick text; n int;
begin
  select * into r from public.weekly_reviews where id = p_review and couple_id = public.require_couple() for update;
  if r.id is null then raise exception 'Bilan introuvable'; end if;
  if r.profile_id = auth.uid() then raise exception 'C''est à l''autre de lancer la roue'; end if;
  if not r.surprise_due then raise exception 'La roue se débloque à 3 ratés sur une semaine'; end if;
  if r.surprise_received_at is not null then raise exception 'Cette surprise est déjà reçue'; end if;
  if r.surprise_picked_at is not null then raise exception 'La roue a déjà tourné pour ce bilan'; end if;
  select count(*) into n from public.surprise_ideas where couple_id = r.couple_id;
  if n < 2 then raise exception 'Il faut au moins 2 idées de surprise pour lancer la roue'; end if;
  select title into pick from public.surprise_ideas where couple_id = r.couple_id order by random() limit 1;
  update public.weekly_reviews set surprise_pick = pick, surprise_picked_at = now() where id = r.id;
  return pick;
end $$;

revoke all on function public.spin_wheel(uuid) from public, anon, authenticated;
grant execute on function public.spin_wheel(uuid) to authenticated;

insert into public.schema_migrations (name) values ('011_wheel');
