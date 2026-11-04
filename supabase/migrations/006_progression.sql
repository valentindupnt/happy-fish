-- Happy Fish, migration 006 : progression longue
-- 50 niveaux et 10 stades, 5 habitats achetés ensemble avec la cagnotte,
-- pièces calculées sur l'XP, friandise à +1 XP, boutique rééchelonnée.
-- À coller une seule fois dans le SQL Editor, après 005_widget.sql.
-- Ne touche à aucune donnée existante : l'XP, les achats et la cagnotte restent.

do $$
begin
  if exists (select 1 from public.schema_migrations where name = '006_progression') then
    raise exception 'La migration 006_progression est déjà appliquée, rien à faire';
  end if;
end $$;

-- ---------------------------------------------------------------------
-- Courbe : 30 XP pour le niveau 2, puis 6 de plus à chaque niveau, 50 niveaux
-- ---------------------------------------------------------------------
create or replace function public.xp_to_reach(n int) returns int
language sql immutable set search_path = public as $$ select 30 * (n - 1) + 3 * (n - 1) * (n - 2) $$;

create or replace function public.level_from_xp(xp int, cap int) returns int
language plpgsql immutable set search_path = public as $$
declare n int := 1;
begin
  while n < least(cap, 50) and xp >= public.xp_to_reach(n + 1) loop
    n := n + 1;
  end loop;
  return n;
end $$;

-- 10 stades de 5 niveaux
create or replace function public.stade_name(level int) returns text
language sql immutable set search_path = public as $$
  select (array['Alevin', 'Petit', 'Juvénile', 'Moyen', 'Grand', 'Adulte', 'Majestueux', 'Ancien', 'Légendaire', 'Mythique'])
    [least(10, greatest(1, (level - 1) / 5 + 1))]
$$;

-- ---------------------------------------------------------------------
-- Habitats : chacun relève le plafond de niveau et ouvre ses décorations
-- ---------------------------------------------------------------------
create table public.habitats (
  position int primary key,
  id text not null unique,
  name text not null,
  min_level int not null,
  price int not null check (price >= 0),
  level_cap int not null
);

insert into public.habitats (position, id, name, min_level, price, level_cap) values
  (0, 'bocaux', 'Deux bocaux', 1, 0, 10),
  (1, 'aquarium', 'Aquarium à deux', 8, 150, 20),
  (2, 'grand', 'Grand aquarium', 18, 350, 30),
  (3, 'recif', 'Récif', 28, 500, 40),
  (4, 'lagon', 'Lagon', 38, 700, 50);

alter table public.couples add column habitat int not null default 0 references public.habitats(position);
update public.couples set habitat = 1 where aquarium_bought;

create or replace function public.level_cap(p_couple uuid) returns int
language sql stable security definer set search_path = public as $$
  select coalesce((select h.level_cap from public.couples c join public.habitats h on h.position = c.habitat where c.id = p_couple), 10)
$$;

create or replace function public.fish_level(p_profile uuid) returns int
language sql stable security definer set search_path = public as $$
  select public.level_from_xp(
    coalesce((select sum(amount) from public.xp_events where profile_id = p_profile), 0)::int,
    public.level_cap((select couple_id from public.profiles where id = p_profile)))
$$;

-- ---------------------------------------------------------------------
-- Pièces : 1 pièce pour 5 XP gagnés, réserve comprise
-- ---------------------------------------------------------------------
create or replace function public.coins_from_xp(xp int) returns int
language sql immutable set search_path = public as $$ select greatest(0, xp) / 5 $$;

create or replace function public.coin_balance(p_profile uuid) returns int
language sql stable security definer set search_path = public as $$
  select public.coins_from_xp(coalesce((select sum(amount) from public.xp_events where profile_id = p_profile), 0)::int)
    - coalesce((select sum(price) from public.purchases where profile_id = p_profile), 0)::int
    - coalesce((select sum(amount) from public.pot_events where profile_id = p_profile and reason = 'contribution'), 0)::int
$$;

create or replace view public.fish_status with (security_invoker = true) as
select
  p.id as profile_id,
  p.couple_id,
  coalesce(x.xp, 0)::int as xp,
  public.level_from_xp(coalesce(x.xp, 0)::int, public.level_cap(p.couple_id)) as level,
  public.level_from_xp(coalesce(x.xp, 0)::int, 50) as level_uncapped,
  public.coins_visible(p.id) as coins
from public.profiles p
left join (select profile_id, sum(amount) as xp from public.xp_events group by profile_id) x
  on x.profile_id = p.id;

-- ---------------------------------------------------------------------
-- Friandise : +1 XP pour le poisson de l'autre, 3 par jour maximum
-- (les friandises déjà données gardent leurs 2 XP)
-- ---------------------------------------------------------------------
create or replace function public.send_treat() returns void
language plpgsql security definer set search_path = public as $$
declare
  v_couple uuid := public.require_couple();
  v_partner uuid;
  v_today date := public.today_paris();
begin
  select id into v_partner from public.profiles where couple_id = v_couple and id <> auth.uid();
  if v_partner is null then raise exception 'Ton duo n''est pas encore complet'; end if;
  if (select count(*) from public.messages
      where author_id = auth.uid() and kind = 'treat'
        and (created_at at time zone 'Europe/Paris')::date = v_today) >= 3 then
    raise exception 'Plus de friandise aujourd''hui, reviens demain';
  end if;
  insert into public.messages (couple_id, author_id, kind) values (v_couple, auth.uid(), 'treat');
  insert into public.xp_events (profile_id, amount, reason, ref_date) values (v_partner, 1, 'treat', v_today);
end $$;

-- ---------------------------------------------------------------------
-- Cagnotte : on verse, puis on achète l'habitat suivant ensemble (plus d'achat automatique)
-- ---------------------------------------------------------------------
alter table public.pot_events drop constraint if exists pot_events_reason_check;
alter table public.pot_events add constraint pot_events_reason_check
  check (reason in ('contribution', 'aquarium', 'decor', 'challenge', 'habitat'));

create or replace function public.contribute(p_amount int) returns int
language plpgsql security definer set search_path = public as $$
declare
  v_couple uuid := public.require_couple();
begin
  if p_amount is null or p_amount <= 0 then raise exception 'Montant invalide'; end if;
  perform 1 from public.couples where id = v_couple for update;
  perform 1 from public.profiles where id = auth.uid() for update;
  if public.coin_balance(auth.uid()) < p_amount then raise exception 'Pas assez de pièces'; end if;
  insert into public.pot_events (couple_id, profile_id, amount, reason) values (v_couple, auth.uid(), p_amount, 'contribution');
  return public.pot_balance(v_couple);
end $$;

-- Les défis réussis n'achètent plus rien tout seuls
create or replace function public.maybe_buy_aquarium(p_couple uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  return;
end $$;

create or replace function public.buy_habitat() returns int
language plpgsql security definer set search_path = public as $$
declare
  v_couple uuid := public.require_couple();
  v_current int;
  h public.habitats;
  v_low int;
begin
  perform 1 from public.couples where id = v_couple for update;
  select habitat into v_current from public.couples where id = v_couple;
  select * into h from public.habitats where position = v_current + 1;
  if h.position is null then raise exception 'Vous avez déjà le plus bel habitat'; end if;
  if (select count(*) from public.profiles where couple_id = v_couple) < 2 then
    raise exception 'Ton duo n''est pas encore complet';
  end if;
  select min(public.fish_level(id)) into v_low from public.profiles where couple_id = v_couple;
  if v_low < h.min_level then
    raise exception 'Vos deux poissons doivent être au niveau %', h.min_level;
  end if;
  if public.pot_balance(v_couple) < h.price then raise exception 'Pas assez de pièces dans la cagnotte'; end if;
  insert into public.pot_events (couple_id, profile_id, amount, reason) values (v_couple, auth.uid(), -h.price, 'habitat');
  update public.couples set habitat = h.position, aquarium_bought = true where id = v_couple;
  return h.position;
end $$;

-- ---------------------------------------------------------------------
-- Boutique : objets étalés jusqu'au niveau 45, décorations par habitat
-- ---------------------------------------------------------------------
alter table public.shop_items add column habitat int not null default 0;

update public.shop_items s set price = v.price, min_level = v.min_level, habitat = v.habitat
from (values
  ('amethyste', 15, 1, 0), ('cerise', 20, 3, 0), ('menthe', 30, 6, 0), ('nuit', 50, 12, 0), ('or', 120, 30, 0),
  ('carre', 30, 3, 0), ('hublot', 60, 8, 0),
  ('bandeau', 25, 4, 0), ('lunettes', 40, 8, 0), ('casquette', 60, 14, 0), ('pirate', 90, 22, 0), ('couronne', 150, 35, 0),
  ('crevette', 80, 12, 0), ('escargot', 80, 16, 0), ('crabe', 100, 20, 0),
  ('plante', 15, 1, 1), ('coquillage', 20, 1, 1), ('tresor', 40, 1, 1), ('chateau', 50, 1, 1)
) as v(id, price, min_level, habitat)
where s.id = v.id;

insert into public.shop_items (id, kind, name, price, min_level, scope, position, habitat) values
  ('fleur', 'hat', 'Fleur', 50, 10, 'perso', 6, 0),
  ('noeud', 'hat', 'Nœud papillon', 75, 18, 'perso', 7, 0),
  ('aureole', 'hat', 'Auréole', 200, 45, 'perso', 8, 0),
  ('poulpe', 'pet', 'Petit poulpe', 120, 26, 'perso', 4, 0),
  ('axolotl', 'pet', 'Axolotl', 150, 32, 'perso', 5, 0),
  ('rochers', 'decor', 'Rochers', 40, 1, 'commun', 5, 2),
  ('algues', 'decor', 'Forêt d''algues', 50, 1, 'commun', 6, 2),
  ('corail', 'decor', 'Corail', 60, 1, 'commun', 7, 3),
  ('anemone', 'decor', 'Anémone', 70, 1, 'commun', 8, 3),
  ('etoile', 'decor', 'Étoile de mer', 60, 1, 'commun', 9, 4),
  ('epave', 'decor', 'Épave', 100, 1, 'commun', 10, 4);

update public.shop_items set habitat = 0 where scope = 'perso';

create or replace function public.buy_decor(p_item text) returns int
language plpgsql security definer set search_path = public as $$
declare
  it public.shop_items;
  v_couple uuid := public.require_couple();
  v_habitat int;
begin
  perform 1 from public.couples where id = v_couple for update;
  select * into it from public.shop_items where id = p_item;
  if it.id is null or it.scope <> 'commun' then raise exception 'Objet inconnu'; end if;
  select habitat into v_habitat from public.couples where id = v_couple;
  if v_habitat < greatest(1, it.habitat) then
    raise exception 'Il faut d''abord l''habitat « % »', (select name from public.habitats where position = greatest(1, it.habitat));
  end if;
  if exists (select 1 from public.couple_items where couple_id = v_couple and item_id = p_item) then
    raise exception 'Vous l''avez déjà';
  end if;
  if public.pot_balance(v_couple) < it.price then raise exception 'Pas assez de pièces dans la cagnotte'; end if;
  insert into public.pot_events (couple_id, profile_id, amount, reason, item_id) values (v_couple, auth.uid(), -it.price, 'decor', p_item);
  insert into public.couple_items (couple_id, item_id) values (v_couple, p_item);
  return public.pot_balance(v_couple);
end $$;

-- ---------------------------------------------------------------------
-- Widget : 10 stades et nom de l'habitat
-- ---------------------------------------------------------------------
create or replace function public.widget_data(p_token text) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare
  v_me uuid;
  v_couple uuid;
  v_today date := public.today_paris();
  v_habitat int;
  v_result jsonb;
begin
  select profile_id into v_me from public.widget_tokens where token = p_token;
  if v_me is null then return null; end if;
  select couple_id into v_couple from public.profiles where id = v_me;
  select habitat into v_habitat from public.couples where id = v_couple;

  select jsonb_build_object(
    'date', v_today,
    'aquarium', coalesce(v_habitat, 0) >= 1,
    'habitat', (select name from public.habitats where position = coalesce(v_habitat, 0)),
    'pot', public.pot_balance(v_couple),
    'fishes', coalesce(jsonb_agg(f order by (f->>'me')::boolean desc), '[]'::jsonb)
  ) into v_result
  from (
    select jsonb_build_object(
      'me', p.id = v_me,
      'name', p.display_name,
      'fish_name', p.fish_name,
      'color', p.fish_color,
      'hat', p.fish_hat,
      'level', fs.level,
      'stade', public.stade_name(fs.level),
      'done', (select count(*) from public.tasks t where t.couple_id = v_couple and t.date = v_today and not t.skipped
                 and t.done_at is not null and (t.owner_id = p.id or t.owner_id is null)),
      'total', (select count(*) from public.tasks t where t.couple_id = v_couple and t.date = v_today and not t.skipped
                 and (t.owner_id = p.id or t.owner_id is null))
    ) as f
    from public.profiles p
    join public.fish_status fs on fs.profile_id = p.id
    where p.couple_id = v_couple
  ) people;
  return v_result;
end $$;

-- ---------------------------------------------------------------------
-- Sécurité
-- ---------------------------------------------------------------------
alter table public.habitats enable row level security;
revoke all on public.habitats from anon, authenticated;
create policy habitats_read on public.habitats for select to authenticated using (true);
grant select on public.habitats to authenticated;
grant select on public.fish_status to authenticated;

revoke all on function public.stade_name(int), public.level_cap(uuid), public.fish_level(uuid), public.coins_from_xp(int),
  public.coin_balance(uuid), public.send_treat(), public.contribute(int), public.maybe_buy_aquarium(uuid), public.buy_habitat(),
  public.buy_decor(text), public.widget_data(text)
  from public, anon, authenticated;
grant execute on function public.stade_name(int), public.level_cap(uuid), public.send_treat(), public.contribute(int), public.buy_habitat(),
  public.buy_decor(text) to authenticated;
grant execute on function public.widget_data(text) to service_role;

insert into public.schema_migrations (name) values ('006_progression');
