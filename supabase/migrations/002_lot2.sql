-- =====================================================================
-- Happy Fish, migration 002 (lot 2) : boutique, cagnotte et grand aquarium,
-- accessoires, bilans de la semaine et surprise, notifications.
-- À lancer une seule fois après schema.sql.
-- =====================================================================

do $$
begin
  if exists (select 1 from public.schema_migrations where name = '002_lot2') then
    raise exception 'La migration 002_lot2 est déjà appliquée, rien à faire';
  end if;
end $$;

-- ---------------------------------------------------------------------
-- Profils : accessoires équipés et préférences de notifications
-- ---------------------------------------------------------------------

alter table public.profiles drop constraint if exists profiles_fish_color_check;
alter table public.profiles add constraint profiles_fish_color_check check (fish_color in
  ('corail', 'rose', 'lagon', 'ocean', 'soleil', 'amethyste', 'cerise', 'menthe', 'nuit', 'or'));

alter table public.profiles
  add column fish_hat text,
  add column fish_pet text,
  add column bowl_style text not null default 'rond',
  add column notify_messages boolean not null default true,
  add column notify_gestures boolean not null default true,
  add column notify_checks boolean not null default false,
  add column notify_evening boolean not null default true,
  add column notify_weekly boolean not null default true;

-- ---------------------------------------------------------------------
-- Boutique
-- ---------------------------------------------------------------------

create table public.shop_items (
  id text primary key,
  kind text not null check (kind in ('color', 'bowl', 'hat', 'pet', 'decor')),
  name text not null,
  price int not null check (price > 0),
  min_level int not null default 1,
  scope text not null check (scope in ('perso', 'commun')),
  position int not null default 0
);

insert into public.shop_items (id, kind, name, price, min_level, scope, position) values
  ('amethyste', 'color', 'Améthyste', 15, 1, 'perso', 1),
  ('cerise', 'color', 'Cerise', 15, 2, 'perso', 2),
  ('menthe', 'color', 'Menthe', 20, 3, 'perso', 3),
  ('nuit', 'color', 'Nuit étoilée', 25, 4, 'perso', 4),
  ('or', 'color', 'Or', 40, 6, 'perso', 5),
  ('carre', 'bowl', 'Bocal carré', 30, 2, 'perso', 1),
  ('hublot', 'bowl', 'Hublot en laiton', 40, 5, 'perso', 2),
  ('bandeau', 'hat', 'Bandeau', 20, 4, 'perso', 1),
  ('lunettes', 'hat', 'Lunettes', 25, 5, 'perso', 2),
  ('casquette', 'hat', 'Casquette', 30, 6, 'perso', 3),
  ('pirate', 'hat', 'Chapeau de pirate', 35, 10, 'perso', 4),
  ('couronne', 'hat', 'Couronne', 40, 13, 'perso', 5),
  ('crevette', 'pet', 'Crevette', 50, 8, 'perso', 1),
  ('escargot', 'pet', 'Escargot', 50, 8, 'perso', 2),
  ('crabe', 'pet', 'Petit crabe', 50, 8, 'perso', 3),
  ('plante', 'decor', 'Grande plante', 10, 1, 'commun', 1),
  ('coquillage', 'decor', 'Coquillage', 15, 1, 'commun', 2),
  ('tresor', 'decor', 'Coffre au trésor', 25, 1, 'commun', 3),
  ('chateau', 'decor', 'Petit château', 30, 1, 'commun', 4);

create table public.purchases (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  item_id text not null references public.shop_items(id),
  price int not null,
  created_at timestamptz not null default now(),
  unique (profile_id, item_id)
);

create table public.couple_items (
  id uuid primary key default gen_random_uuid(),
  couple_id uuid not null references public.couples(id) on delete cascade,
  item_id text not null references public.shop_items(id),
  created_at timestamptz not null default now(),
  unique (couple_id, item_id)
);

-- Cagnotte commune : versements (+) et dépenses (-)
create table public.pot_events (
  id uuid primary key default gen_random_uuid(),
  couple_id uuid not null references public.couples(id) on delete cascade,
  profile_id uuid references public.profiles(id) on delete set null,
  amount int not null,
  reason text not null check (reason in ('contribution', 'aquarium', 'decor')),
  item_id text references public.shop_items(id),
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- Bilans de la semaine et surprise
-- ---------------------------------------------------------------------

create table public.weekly_reviews (
  id uuid primary key default gen_random_uuid(),
  couple_id uuid not null references public.couples(id) on delete cascade,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  week_start date not null,
  done int not null,
  missed int not null,
  xp int not null,
  surprise_due boolean not null,
  surprise_received_at timestamptz,
  created_at timestamptz not null default now(),
  unique (profile_id, week_start)
);

-- ---------------------------------------------------------------------
-- Notifications
-- ---------------------------------------------------------------------

create table public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  endpoint text not null unique,
  p256dh text not null,
  auth text not null,
  created_at timestamptz not null default now()
);

-- Évite d'envoyer deux fois le même rappel ou le même bilan
create table public.notifications_log (
  profile_id uuid not null references public.profiles(id) on delete cascade,
  kind text not null,
  ref text not null,
  created_at timestamptz not null default now(),
  primary key (profile_id, kind, ref)
);

-- ---------------------------------------------------------------------
-- Pièces
-- ---------------------------------------------------------------------

-- 10 pièces par niveau gagné, +25 à chaque nouveau stade
create or replace function public.coins_earned(level int) returns int
language sql immutable set search_path = public as $$
  select 10 * (level - 1) + 25 * ((level - 1) / 3)
$$;

create or replace function public.fish_level(p_profile uuid) returns int
language sql stable security definer set search_path = public as $$
  select public.level_from_xp(
    coalesce((select sum(amount) from public.xp_events where profile_id = p_profile), 0)::int,
    case when coalesce((select c.aquarium_bought from public.profiles p join public.couples c on c.id = p.couple_id where p.id = p_profile), false)
      then 15 else 6 end)
$$;

create or replace function public.coin_balance(p_profile uuid) returns int
language sql stable security definer set search_path = public as $$
  select public.coins_earned(public.fish_level(p_profile))
    - coalesce((select sum(price) from public.purchases where profile_id = p_profile), 0)::int
    - coalesce((select sum(amount) from public.pot_events where profile_id = p_profile and reason = 'contribution'), 0)::int
$$;

-- Solde visible seulement pour soi et son duo (et pour les fonctions serveur)
create or replace function public.coins_visible(p_profile uuid) returns int
language sql stable security definer set search_path = public as $$
  select case
    when auth.uid() is null or p_profile in (select id from public.profiles where couple_id = public.my_couple() or id = auth.uid())
    then public.coin_balance(p_profile)
  end
$$;

create or replace function public.pot_balance(p_couple uuid) returns int
language sql stable security definer set search_path = public as $$
  select coalesce((select sum(amount) from public.pot_events where couple_id = p_couple), 0)::int
$$;

create or replace view public.fish_status with (security_invoker = true) as
select
  p.id as profile_id,
  p.couple_id,
  coalesce(x.xp, 0)::int as xp,
  public.level_from_xp(coalesce(x.xp, 0)::int, case when c.aquarium_bought then 15 else 6 end) as level,
  public.level_from_xp(coalesce(x.xp, 0)::int, 15) as level_uncapped,
  public.coins_visible(p.id) as coins
from public.profiles p
left join public.couples c on c.id = p.couple_id
left join (select profile_id, sum(amount) as xp from public.xp_events group by profile_id) x
  on x.profile_id = p.id;

-- Acheter un objet perso
create or replace function public.buy_item(p_item text) returns int
language plpgsql security definer set search_path = public as $$
declare
  it public.shop_items;
  v_couple uuid := public.require_couple();
begin
  perform 1 from public.profiles where id = auth.uid() for update;
  select * into it from public.shop_items where id = p_item;
  if it.id is null then raise exception 'Objet inconnu'; end if;
  if it.scope <> 'perso' then raise exception 'Cet objet s''achète avec la cagnotte commune'; end if;
  if exists (select 1 from public.purchases where profile_id = auth.uid() and item_id = p_item) then
    raise exception 'Tu l''as déjà';
  end if;
  if public.fish_level(auth.uid()) < it.min_level then
    raise exception 'Disponible à partir du niveau %', it.min_level;
  end if;
  if public.coin_balance(auth.uid()) < it.price then
    raise exception 'Pas assez de pièces';
  end if;
  insert into public.purchases (profile_id, item_id, price) values (auth.uid(), p_item, it.price);
  return public.coin_balance(auth.uid());
end $$;

-- Verser des pièces dans la cagnotte ; à 120 le grand aquarium s'achète tout seul
create or replace function public.contribute(p_amount int) returns int
language plpgsql security definer set search_path = public as $$
declare
  v_couple uuid := public.require_couple();
  v_bought boolean;
begin
  if p_amount is null or p_amount <= 0 then raise exception 'Montant invalide'; end if;
  perform 1 from public.couples where id = v_couple for update;
  perform 1 from public.profiles where id = auth.uid() for update;
  if public.coin_balance(auth.uid()) < p_amount then raise exception 'Pas assez de pièces'; end if;
  insert into public.pot_events (couple_id, profile_id, amount, reason) values (v_couple, auth.uid(), p_amount, 'contribution');

  select aquarium_bought into v_bought from public.couples where id = v_couple;
  if not v_bought and public.pot_balance(v_couple) >= 120 then
    insert into public.pot_events (couple_id, amount, reason) values (v_couple, -120, 'aquarium');
    update public.couples set aquarium_bought = true where id = v_couple;
  end if;
  return public.pot_balance(v_couple);
end $$;

-- Acheter une décoration commune avec la cagnotte
create or replace function public.buy_decor(p_item text) returns int
language plpgsql security definer set search_path = public as $$
declare
  it public.shop_items;
  v_couple uuid := public.require_couple();
begin
  perform 1 from public.couples where id = v_couple for update;
  select * into it from public.shop_items where id = p_item;
  if it.id is null or it.scope <> 'commun' then raise exception 'Objet inconnu'; end if;
  if not (select aquarium_bought from public.couples where id = v_couple) then
    raise exception 'Il faut d''abord le grand aquarium';
  end if;
  if exists (select 1 from public.couple_items where couple_id = v_couple and item_id = p_item) then
    raise exception 'Vous l''avez déjà';
  end if;
  if public.pot_balance(v_couple) < it.price then raise exception 'Pas assez de pièces dans la cagnotte'; end if;
  insert into public.pot_events (couple_id, profile_id, amount, reason, item_id) values (v_couple, auth.uid(), -it.price, 'decor', p_item);
  insert into public.couple_items (couple_id, item_id) values (v_couple, p_item);
  return public.pot_balance(v_couple);
end $$;

create or replace function public.get_pot() returns int
language sql stable security definer set search_path = public as $$
  select public.pot_balance(public.require_couple())
$$;

-- On ne peut équiper que ce qu'on a acheté
create or replace function public.check_cosmetics() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.fish_color is distinct from old.fish_color
     and exists (select 1 from public.shop_items where id = new.fish_color and kind = 'color')
     and not exists (select 1 from public.purchases where profile_id = new.id and item_id = new.fish_color) then
    raise exception 'Achète d''abord cette couleur dans la boutique';
  end if;
  if new.fish_hat is distinct from old.fish_hat and new.fish_hat is not null
     and not exists (select 1 from public.purchases p join public.shop_items s on s.id = p.item_id
                     where p.profile_id = new.id and p.item_id = new.fish_hat and s.kind = 'hat') then
    raise exception 'Achète d''abord cet accessoire dans la boutique';
  end if;
  if new.fish_pet is distinct from old.fish_pet and new.fish_pet is not null
     and not exists (select 1 from public.purchases p join public.shop_items s on s.id = p.item_id
                     where p.profile_id = new.id and p.item_id = new.fish_pet and s.kind = 'pet') then
    raise exception 'Adopte d''abord ce familier dans la boutique';
  end if;
  if new.bowl_style is distinct from old.bowl_style and new.bowl_style <> 'rond'
     and not exists (select 1 from public.purchases p join public.shop_items s on s.id = p.item_id
                     where p.profile_id = new.id and p.item_id = new.bowl_style and s.kind = 'bowl') then
    raise exception 'Achète d''abord ce bocal dans la boutique';
  end if;
  return new;
end $$;

create trigger profiles_check_cosmetics before update on public.profiles
  for each row execute function public.check_cosmetics();

-- ---------------------------------------------------------------------
-- Bilans de la semaine
-- ---------------------------------------------------------------------

create or replace function public.compute_reviews(p_couple uuid, p_week date) returns void
language plpgsql security definer set search_path = public as $$
declare
  m record;
  v_week date := public.week_start(p_week);
  v_done int;
  v_missed int;
  v_xp int;
begin
  if v_week + 7 > public.today_paris() then return; end if; -- semaine pas finie
  if (select (created_at at time zone 'Europe/Paris')::date from public.couples where id = p_couple) > v_week + 6 then
    return; -- le duo n'existait pas encore
  end if;
  for m in select id from public.profiles where couple_id = p_couple loop
    select count(done_at), count(*) - count(done_at) into v_done, v_missed
    from public.tasks
    where couple_id = p_couple and date between v_week and v_week + 6 and not skipped
      and (owner_id = m.id or owner_id is null);
    select coalesce(sum(amount), 0) into v_xp
    from public.xp_events
    where profile_id = m.id and ref_date between v_week and v_week + 6;
    insert into public.weekly_reviews (couple_id, profile_id, week_start, done, missed, xp, surprise_due)
    values (p_couple, m.id, v_week, v_done, v_missed, v_xp, v_missed >= 3)
    on conflict (profile_id, week_start) do nothing;
  end loop;
end $$;

-- Appelée par l'app : prépare le bilan de la semaine dernière s'il manque
create or replace function public.ensure_reviews() returns void
language plpgsql security definer set search_path = public as $$
begin
  perform public.compute_reviews(public.require_couple(), public.week_start(public.today_paris()) - 7);
end $$;

-- Celui qui a reçu la surprise la marque comme reçue
create or replace function public.mark_surprise_received(p_review uuid) returns void
language plpgsql security definer set search_path = public as $$
declare r public.weekly_reviews;
begin
  select * into r from public.weekly_reviews where id = p_review and couple_id = public.require_couple();
  if r.id is null then raise exception 'Bilan introuvable'; end if;
  if r.profile_id = auth.uid() then raise exception 'C''est à l''autre de confirmer qu''il a reçu ta surprise'; end if;
  if not r.surprise_due then raise exception 'Pas de surprise due cette semaine'; end if;
  update public.weekly_reviews set surprise_received_at = coalesce(surprise_received_at, now()) where id = p_review;
end $$;

-- ---------------------------------------------------------------------
-- Sécurité
-- ---------------------------------------------------------------------

alter table public.shop_items enable row level security;
alter table public.purchases enable row level security;
alter table public.couple_items enable row level security;
alter table public.pot_events enable row level security;
alter table public.weekly_reviews enable row level security;
alter table public.push_subscriptions enable row level security;
alter table public.notifications_log enable row level security;

revoke all on public.shop_items, public.purchases, public.couple_items, public.pot_events, public.weekly_reviews,
  public.push_subscriptions, public.notifications_log from anon, authenticated;
revoke all on function public.coins_earned(int), public.fish_level(uuid), public.coin_balance(uuid), public.coins_visible(uuid), public.pot_balance(uuid),
  public.buy_item(text), public.contribute(int), public.buy_decor(text), public.get_pot(), public.check_cosmetics(),
  public.compute_reviews(uuid, date), public.ensure_reviews(), public.mark_surprise_received(uuid)
  from public, anon, authenticated;

create policy shop_read on public.shop_items for select to authenticated using (true);
create policy purchases_read on public.purchases for select to authenticated
  using (profile_id in (select id from public.profiles where couple_id = public.my_couple()));
create policy couple_items_read on public.couple_items for select to authenticated using (couple_id = public.my_couple());
create policy pot_read on public.pot_events for select to authenticated using (couple_id = public.my_couple());
create policy reviews_read on public.weekly_reviews for select to authenticated using (couple_id = public.my_couple());
create policy push_own on public.push_subscriptions for all to authenticated
  using (profile_id = auth.uid()) with check (profile_id = auth.uid());

grant select on public.shop_items, public.purchases, public.couple_items, public.pot_events, public.weekly_reviews,
  public.fish_status to authenticated;
grant select, insert, update, delete on public.push_subscriptions to authenticated;
grant update (fish_hat, fish_pet, bowl_style, notify_messages, notify_gestures, notify_checks, notify_evening, notify_weekly)
  on public.profiles to authenticated;
grant execute on function public.coins_visible(uuid), public.buy_item(text), public.contribute(int), public.buy_decor(text), public.get_pot(),
  public.ensure_reviews(), public.mark_surprise_received(uuid) to authenticated;

do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    alter publication supabase_realtime add table public.couples, public.pot_events, public.weekly_reviews;
  end if;
end $$;

insert into public.schema_migrations (name) values ('002_lot2');
