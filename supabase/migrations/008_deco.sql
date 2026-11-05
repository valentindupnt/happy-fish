-- Happy Fish, migration 008 : décorations de l'aquarium, cadeaux, collections, saison de Noël
-- 30 décorations perso (payées avec ses pièces), 5 emplacements dans son aquarium, 4 emplacements
-- par personne dans l'aquarium commun, « Offrir » un objet à l'autre, collections avec bonus,
-- objets de Noël achetables du 1er au 25 décembre.
-- À coller une seule fois dans le SQL Editor, après 007_visitors.sql.
-- Ne touche à aucune donnée existante : achats, pièces et cagnotte restent.

do $$
begin
  if exists (select 1 from public.schema_migrations where name = '008_deco') then
    raise exception 'La migration 008_deco est déjà appliquée, rien à faire';
  end if;
end $$;

-- ---------------------------------------------------------------------
-- Catalogue : un nouveau rayon, des collections et une saison
-- ---------------------------------------------------------------------
alter table public.shop_items drop constraint if exists shop_items_kind_check;
alter table public.shop_items add constraint shop_items_kind_check check (kind in ('color', 'bowl', 'hat', 'pet', 'decor', 'deco'));
alter table public.shop_items add column series text, add column season text;

create table public.series (
  id text primary key,
  name text not null,
  reward int not null check (reward >= 0)
);

insert into public.series (id, name, reward) values
  ('ancres', 'Les ancres', 15),
  ('coffres', 'Les coffres', 20),
  ('chateaux', 'Les châteaux de sable', 10),
  ('lanternes', 'Les lanternes à bulles', 25),
  ('epaves', 'Les épaves', 30),
  ('phares', 'Les phares', 25),
  ('noel', 'Noël', 30);

alter table public.shop_items add constraint shop_items_series_fkey foreign key (series) references public.series(id);

insert into public.shop_items (id, kind, name, price, min_level, scope, position, habitat, series, season) values
  ('d_galets', 'deco', 'Galets', 5, 1, 'perso', 101, 0, null, null),
  ('d_coquillage', 'deco', 'Coquillage', 8, 1, 'perso', 102, 0, null, null),
  ('d_algue', 'deco', 'Algue', 8, 2, 'perso', 103, 0, null, null),
  ('d_etoile', 'deco', 'Étoile de mer', 10, 2, 'perso', 104, 0, null, null),
  ('d_ancre_rouille', 'deco', 'Ancre rouillée', 10, 2, 'perso', 105, 0, 'ancres', null),
  ('d_ancre_laiton', 'deco', 'Ancre en laiton', 18, 5, 'perso', 106, 0, 'ancres', null),
  ('d_ancre_brumes', 'deco', 'Ancre des brumes', 40, 12, 'perso', 107, 0, 'ancres', null),
  ('d_coffre_bois', 'deco', 'Petit coffre', 12, 3, 'perso', 108, 0, 'coffres', null),
  ('d_coffre_fer', 'deco', 'Coffre cerclé de fer', 20, 6, 'perso', 109, 0, 'coffres', null),
  ('d_coffre_etoiles', 'deco', 'Coffre aux étoiles', 38, 11, 'perso', 110, 0, 'coffres', null),
  ('d_chateau_sable', 'deco', 'Château de sable', 12, 3, 'perso', 111, 0, 'chateaux', null),
  ('d_chateau_drapeau', 'deco', 'Château au drapeau', 22, 7, 'perso', 112, 0, 'chateaux', null),
  ('d_lanterne_rose', 'deco', 'Lanterne à bulles roses', 20, 4, 'perso', 113, 0, 'lanternes', null),
  ('d_lanterne_verte', 'deco', 'Lanterne à bulles vertes', 20, 5, 'perso', 114, 0, 'lanternes', null),
  ('d_lanterne_violette', 'deco', 'Lanterne à bulles violettes', 25, 7, 'perso', 115, 0, 'lanternes', null),
  ('d_epave_barque', 'deco', 'Barque échouée', 15, 4, 'perso', 116, 0, 'epaves', null),
  ('d_epave_galion', 'deco', 'Galion englouti', 30, 8, 'perso', 117, 0, 'epaves', null),
  ('d_epave_fantome', 'deco', 'Vaisseau fantôme', 55, 14, 'perso', 118, 0, 'epaves', null),
  ('d_phare', 'deco', 'Phare rayé', 30, 6, 'perso', 119, 0, 'phares', null),
  ('d_phare_ames', 'deco', 'Phare des âmes', 60, 15, 'perso', 120, 0, 'phares', null),
  ('d_velo', 'deco', 'Vélo', 35, 5, 'perso', 121, 0, null, null),
  ('d_parasol', 'deco', 'Parasol', 25, 4, 'perso', 122, 0, null, null),
  ('d_eolienne', 'deco', 'Éolienne', 40, 8, 'perso', 123, 0, null, null),
  ('d_banc', 'deco', 'Banc de musculation', 40, 6, 'perso', 124, 0, null, null),
  ('d_plongeoir', 'deco', 'Plongeoir', 45, 9, 'perso', 125, 0, null, null),
  ('d_gode', 'deco', 'Gode rose', 30, 5, 'perso', 126, 0, null, null),
  ('d_noel_sapin', 'deco', 'Petit sapin', 20, 1, 'perso', 131, 0, 'noel', 'noel'),
  ('d_noel_etoile', 'deco', 'Étoile de Noël', 15, 1, 'perso', 132, 0, 'noel', 'noel'),
  ('d_noel_guirlande', 'deco', 'Guirlande lumineuse', 25, 1, 'perso', 133, 0, 'noel', 'noel'),
  ('d_noel_cadeau', 'deco', 'Paquet cadeau', 18, 1, 'perso', 134, 0, 'noel', 'noel');

-- Les objets de saison ne s'achètent que pendant leur saison (Noël : du 1er au 25 décembre, chaque année)
create or replace function public.season_open(p_season text, p_day date default public.today_paris()) returns boolean
language sql stable set search_path = public as $$
  select p_season is null
    or (p_season = 'noel' and extract(month from p_day) = 12 and extract(day from p_day) <= 25)
$$;

-- ---------------------------------------------------------------------
-- Tables : collections trouvées, cadeaux, emplacements
-- ---------------------------------------------------------------------
create table public.series_found (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  series_id text not null references public.series(id),
  reward int not null,
  found_at timestamptz not null default now(),
  unique (profile_id, series_id)
);

create table public.gifts (
  id uuid primary key default gen_random_uuid(),
  couple_id uuid not null references public.couples(id) on delete cascade,
  from_id uuid not null references public.profiles(id) on delete cascade,
  to_id uuid not null references public.profiles(id) on delete cascade,
  item_id text not null references public.shop_items(id),
  price int not null,
  message text check (message is null or char_length(message) <= 140),
  created_at timestamptz not null default now()
);

-- Où chaque décoration est posée : « own » dans son aquarium (5 emplacements), « common » dans l'aquarium commun (4 par personne)
create table public.deco_slots (
  profile_id uuid not null references public.profiles(id) on delete cascade,
  place text not null check (place in ('own', 'common')),
  slot int not null check (slot >= 0 and slot < 5),
  item_id text not null references public.shop_items(id),
  primary key (profile_id, place, slot),
  unique (profile_id, item_id)
);

-- ---------------------------------------------------------------------
-- Pièces : bonus de collection reçu, cadeaux offerts retirés du solde
-- ---------------------------------------------------------------------
create or replace function public.coin_balance(p_profile uuid) returns int
language sql stable security definer set search_path = public as $$
  select public.coins_from_xp(coalesce((select sum(amount) from public.xp_events where profile_id = p_profile), 0)::int)
    + coalesce((select sum(reward) from public.visitor_found where profile_id = p_profile), 0)::int
    + coalesce((select sum(reward) from public.series_found where profile_id = p_profile), 0)::int
    - coalesce((select sum(price) from public.purchases where profile_id = p_profile), 0)::int
    - coalesce((select sum(price) from public.gifts where from_id = p_profile), 0)::int
    - coalesce((select sum(amount) from public.pot_events where profile_id = p_profile and reason = 'contribution'), 0)::int
$$;

-- ---------------------------------------------------------------------
-- Collections : le bonus arrive quand la série est complète (achetée ou offerte)
-- ---------------------------------------------------------------------
create or replace function public.check_series(p_profile uuid) returns int
language plpgsql security definer set search_path = public as $$
declare
  s record;
  new_id uuid;
  n int := 0;
begin
  for s in select * from public.series loop
    if exists (select 1 from public.shop_items i where i.series = s.id)
       and not exists (
         select 1 from public.shop_items i
         where i.series = s.id
           and not exists (select 1 from public.purchases p where p.profile_id = p_profile and p.item_id = i.id)
       ) then
      insert into public.series_found (profile_id, series_id, reward) values (p_profile, s.id, s.reward)
      on conflict do nothing returning id into new_id;
      if new_id is not null then n := n + 1; new_id := null; end if;
    end if;
  end loop;
  return n;
end $$;

create or replace function public.on_purchase_series() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  perform public.check_series(new.profile_id);
  return new;
end $$;

create trigger purchases_series after insert on public.purchases
  for each row execute function public.on_purchase_series();

-- ---------------------------------------------------------------------
-- Acheter : même règle qu'avant, plus la saison
-- ---------------------------------------------------------------------
create or replace function public.buy_item(p_item text) returns int
language plpgsql security definer set search_path = public as $$
declare
  it public.shop_items;
begin
  perform public.require_couple();
  perform 1 from public.profiles where id = auth.uid() for update;
  select * into it from public.shop_items where id = p_item;
  if it.id is null then raise exception 'Objet inconnu'; end if;
  if it.scope <> 'perso' then raise exception 'Cet objet s''achète avec la cagnotte commune'; end if;
  if exists (select 1 from public.purchases where profile_id = auth.uid() and item_id = p_item) then
    raise exception 'Tu l''as déjà';
  end if;
  if not public.season_open(it.season) then raise exception 'Cet objet de saison n''est plus en vente'; end if;
  if public.fish_level(auth.uid()) < it.min_level then
    raise exception 'Disponible à partir du niveau %', it.min_level;
  end if;
  if public.coin_balance(auth.uid()) < it.price then
    raise exception 'Pas assez de pièces';
  end if;
  insert into public.purchases (profile_id, item_id, price) values (auth.uid(), p_item, it.price);
  return public.coin_balance(auth.uid());
end $$;

-- ---------------------------------------------------------------------
-- Offrir un objet à l'autre : payé avec ses pièces, il l'attend en réserve s'il n'a pas le niveau
-- ---------------------------------------------------------------------
create or replace function public.gift_item(p_item text, p_message text default null) returns int
language plpgsql security definer set search_path = public as $$
declare
  it public.shop_items;
  v_couple uuid := public.require_couple();
  v_to uuid;
  v_msg text := nullif(left(btrim(coalesce(p_message, '')), 140), '');
begin
  perform 1 from public.profiles where id = auth.uid() for update;
  select id into v_to from public.profiles where couple_id = v_couple and id <> auth.uid();
  if v_to is null then raise exception 'Ton duo n''est pas encore complet'; end if;
  select * into it from public.shop_items where id = p_item;
  if it.id is null or it.scope <> 'perso' then raise exception 'Objet inconnu'; end if;
  if not public.season_open(it.season) then raise exception 'Cet objet de saison n''est plus en vente'; end if;
  if exists (select 1 from public.purchases where profile_id = v_to and item_id = p_item) then
    raise exception 'Ton duo l''a déjà';
  end if;
  if public.coin_balance(auth.uid()) < it.price then raise exception 'Pas assez de pièces'; end if;
  insert into public.gifts (couple_id, from_id, to_id, item_id, price, message) values (v_couple, auth.uid(), v_to, p_item, it.price, v_msg);
  insert into public.purchases (profile_id, item_id, price) values (v_to, p_item, 0);
  return public.coin_balance(auth.uid());
end $$;

-- ---------------------------------------------------------------------
-- Poser ou retirer une décoration
-- ---------------------------------------------------------------------
create or replace function public.set_deco(p_place text, p_slot int, p_item text) returns void
language plpgsql security definer set search_path = public as $$
declare
  it public.shop_items;
  v_couple uuid := public.require_couple();
  v_max int;
begin
  if p_place not in ('own', 'common') then raise exception 'Emplacement inconnu'; end if;
  v_max := case when p_place = 'own' then 5 else 4 end;
  if p_slot is null or p_slot < 0 or p_slot >= v_max then raise exception 'Emplacement inconnu'; end if;
  perform 1 from public.profiles where id = auth.uid() for update;
  if p_item is null then
    delete from public.deco_slots where profile_id = auth.uid() and place = p_place and slot = p_slot;
    return;
  end if;
  if p_place = 'common' and (select habitat from public.couples where id = v_couple) < 1 then
    raise exception 'L''aquarium commun arrive avec le grand aquarium';
  end if;
  select * into it from public.shop_items where id = p_item and kind = 'deco';
  if it.id is null then raise exception 'Objet inconnu'; end if;
  if not exists (select 1 from public.purchases where profile_id = auth.uid() and item_id = p_item) then
    raise exception 'Tu ne l''as pas encore';
  end if;
  if public.fish_level(auth.uid()) < it.min_level then
    raise exception 'Disponible à partir du niveau %', it.min_level;
  end if;
  delete from public.deco_slots where profile_id = auth.uid() and item_id = p_item;
  delete from public.deco_slots where profile_id = auth.uid() and place = p_place and slot = p_slot;
  insert into public.deco_slots (profile_id, place, slot, item_id) values (auth.uid(), p_place, p_slot, p_item);
end $$;

-- ---------------------------------------------------------------------
-- Équiper : un cadeau reçu attend le niveau requis
-- ---------------------------------------------------------------------
create or replace function public.item_too_high(p_item text, p_profile uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.shop_items where id = p_item and min_level > public.fish_level(p_profile))
$$;

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
  if (new.fish_color is distinct from old.fish_color and public.item_too_high(new.fish_color, new.id))
     or (new.fish_hat is distinct from old.fish_hat and public.item_too_high(new.fish_hat, new.id))
     or (new.fish_pet is distinct from old.fish_pet and public.item_too_high(new.fish_pet, new.id))
     or (new.bowl_style is distinct from old.bowl_style and public.item_too_high(new.bowl_style, new.id)) then
    raise exception 'Ton poisson n''a pas encore le niveau pour cet objet';
  end if;
  return new;
end $$;

-- Chacun peut couper cette notification dans les Paramètres
alter table public.profiles add column notify_gifts boolean not null default true;
grant update (notify_gifts) on public.profiles to authenticated;

-- ---------------------------------------------------------------------
-- Notification « Julie t'a offert … » (uniquement sur Supabase, là où private.notify existe)
-- ---------------------------------------------------------------------
do $do$
begin
  if exists (select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'private' and p.proname = 'notify') then
    execute $f$
      create or replace function private.on_gift() returns trigger
      language plpgsql security definer set search_path = public as $b$
      begin
        perform private.notify(jsonb_build_object('type', 'gift', 'id', new.id));
        return new;
      end $b$;
    $f$;
    execute 'create trigger gifts_notify after insert on public.gifts for each row execute function private.on_gift()';
  end if;
end $do$;

-- ---------------------------------------------------------------------
-- Sécurité
-- ---------------------------------------------------------------------
alter table public.series enable row level security;
alter table public.series_found enable row level security;
alter table public.gifts enable row level security;
alter table public.deco_slots enable row level security;
revoke all on public.series, public.series_found, public.gifts, public.deco_slots from anon, authenticated;
create policy series_read on public.series for select to authenticated using (true);
create policy series_found_read on public.series_found for select to authenticated
  using (profile_id in (select id from public.profiles where couple_id = public.my_couple()));
create policy gifts_read on public.gifts for select to authenticated using (couple_id = public.my_couple());
create policy deco_slots_read on public.deco_slots for select to authenticated
  using (profile_id in (select id from public.profiles where couple_id = public.my_couple()));
grant select on public.series, public.series_found, public.gifts, public.deco_slots to authenticated;

revoke all on function public.season_open(text, date), public.check_series(uuid), public.on_purchase_series(), public.buy_item(text),
  public.gift_item(text, text), public.set_deco(text, int, text), public.item_too_high(text, uuid), public.check_cosmetics(),
  public.coin_balance(uuid)
  from public, anon, authenticated;
grant execute on function public.buy_item(text), public.gift_item(text, text), public.set_deco(text, int, text) to authenticated;

-- Realtime : un cadeau ou une décoration posée s'affiche tout de suite chez l'autre
do $do$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    execute 'alter publication supabase_realtime add table public.gifts, public.deco_slots, public.series_found';
  end if;
end $do$;

insert into public.schema_migrations (name) values ('008_deco');
