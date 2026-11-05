-- Happy Fish, migration 012 : quêtes annexes et Wall of fame
-- Chaque jour, 3 quêtes facultatives tirées au hasard dans la liste de chacun (liste de départ copiée au premier tirage).
-- Une quête simple rapporte 3 pièces, une quête dure 5, pour celui qui la valide avec un snap (photo).
-- Une quête faite peut être gardée pour demain (2 au maximum) : elle revient à la même place et sa série monte.
-- Chacun peut ajouter ses quêtes et en retirer (archivées : les anciens snaps gardent leur nom).
-- À coller une seule fois dans le SQL Editor, après 011_wheel.sql.
-- Ne touche à aucune donnée existante.

do $$
begin
  if exists (select 1 from public.schema_migrations where name = '012_quests') then
    raise exception 'La migration 012_quests est déjà appliquée, rien à faire';
  end if;
end $$;

-- ---------------------------------------------------------------------
-- Liste de départ (copiée dans la liste de chacun au premier tirage)
-- ---------------------------------------------------------------------
create table public.quest_starters (
  id serial primary key,
  title text not null unique check (length(title) between 1 and 120),
  hard boolean not null
);

insert into public.quest_starters (title, hard) values
  ('Prendre une douche froide', false),
  ('Marcher 10 minutes sans téléphone', false),
  ('Faire 5 minutes d''étirements', false),
  ('Prendre les escaliers plutôt que l''ascenseur', false),
  ('Boire 2 litres d''eau dans la journée', false),
  ('Méditer 5 minutes', false),
  ('Lire 10 pages', false),
  ('Écrire 3 choses positives de la journée', false),
  ('Faire 3 minutes de respiration', false),
  ('Appeler un proche', false),
  ('Faire un compliment sincère à quelqu''un', false),
  ('Remercier quelqu''un', false),
  ('Prendre un chemin différent', false),
  ('Apprendre 5 mots d''une langue', false),
  ('Ranger un petit coin', false),
  ('S''asseoir 5 minutes dehors sans rien faire', false),
  ('Regarder le lever ou le coucher du soleil', false),
  ('Prendre en photo quelque chose de beau', false),
  ('Faire 20 pompes', true),
  ('Tenir 1 minute de gainage', true),
  ('Faire 50 squats', true),
  ('Courir 20 minutes', true),
  ('Faire 10 minutes de yoga', true),
  ('Finir la douche par 1 minute d''eau glacée', true),
  ('Passer une heure sans écran avant de dormir', true),
  ('Méditer 15 minutes', true),
  ('Écrire une page dans un carnet', true),
  ('Passer 2 heures sans réseaux sociaux', true),
  ('Apprendre quelque chose avec un tuto de 20 minutes', true),
  ('Écrire à un ami perdu de vue', true),
  ('Appeler quelqu''un qu''on n''a pas eu depuis des mois', true),
  ('Inviter quelqu''un à prendre un café', true),
  ('Goûter un aliment nouveau', true),
  ('Cuisiner un plat jamais fait', true),
  ('Aller dans un lieu jamais visité', true),
  ('Essayer une activité jamais faite', true),
  ('Manger une cuisine jamais goûtée', true);

-- ---------------------------------------------------------------------
-- La liste de chacun, et les quêtes du jour
-- ---------------------------------------------------------------------
create table public.quest_templates (
  id uuid primary key default gen_random_uuid(),
  couple_id uuid not null references public.couples(id) on delete cascade,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  title text not null check (length(title) between 1 and 120),
  hard boolean not null default false,
  archived boolean not null default false,
  created_at timestamptz not null default now()
);

create table public.daily_quests (
  id uuid primary key default gen_random_uuid(),
  couple_id uuid not null references public.couples(id) on delete cascade,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  template_id uuid references public.quest_templates(id) on delete set null,
  title text not null,
  hard boolean not null,
  day date not null,
  slot smallint not null check (slot between 1 and 3),
  streak_base int not null default 0,
  streak int not null default 0,
  done_at timestamptz,
  photo_path text check (length(photo_path) <= 200),
  kept boolean not null default false,
  coins int not null default 0,
  created_at timestamptz not null default now(),
  unique (profile_id, day, slot),
  check ((done_at is null) = (photo_path is null)),
  check (not kept or done_at is not null)
);

create index daily_quests_profile_day on public.daily_quests (profile_id, day desc);

-- ---------------------------------------------------------------------
-- Tirage du jour : les gardées d'hier reviennent à leur place, le reste est tiré au hasard
-- ---------------------------------------------------------------------
create or replace function public.ensure_daily_quests() returns void
language plpgsql security definer set search_path = public as $$
declare
  v_couple uuid := public.require_couple();
  v_me uuid := auth.uid();
  v_day date := public.today_paris();
  r record;
  t record;
  s int;
begin
  if exists (select 1 from public.daily_quests where profile_id = v_me and day = v_day) then return; end if;

  if not exists (select 1 from public.quest_templates where profile_id = v_me) then
    insert into public.quest_templates (couple_id, profile_id, title, hard)
    select v_couple, v_me, title, hard from public.quest_starters;
  end if;

  for r in
    select dq.slot, dq.streak, dq.template_id, qt.title, qt.hard
    from public.daily_quests dq
    join public.quest_templates qt on qt.id = dq.template_id and not qt.archived
    where dq.profile_id = v_me and dq.day = v_day - 1 and dq.done_at is not null and dq.kept
    order by dq.slot limit 2
  loop
    insert into public.daily_quests (couple_id, profile_id, template_id, title, hard, day, slot, streak_base)
    values (v_couple, v_me, r.template_id, r.title, r.hard, v_day, r.slot, r.streak)
    on conflict (profile_id, day, slot) do nothing;
  end loop;

  for s in 1..3 loop
    if exists (select 1 from public.daily_quests where profile_id = v_me and day = v_day and slot = s) then continue; end if;
    select * into t from public.quest_templates
    where profile_id = v_me and not archived
      and id not in (select template_id from public.daily_quests where profile_id = v_me and day = v_day and template_id is not null)
    order by (id in (select template_id from public.daily_quests where profile_id = v_me and day = v_day - 1 and template_id is not null)), random()
    limit 1;
    exit when t.id is null;
    insert into public.daily_quests (couple_id, profile_id, template_id, title, hard, day, slot)
    values (v_couple, v_me, t.id, t.title, t.hard, v_day, s)
    on conflict (profile_id, day, slot) do nothing;
  end loop;
end $$;

-- ---------------------------------------------------------------------
-- Valider une quête avec un snap : 3 pièces (simple) ou 5 (dure)
-- ---------------------------------------------------------------------
create or replace function public.complete_quest(p_quest uuid, p_photo text) returns void
language plpgsql security definer set search_path = public as $$
declare q public.daily_quests;
begin
  select * into q from public.daily_quests where id = p_quest and profile_id = auth.uid() for update;
  if q.id is null then raise exception 'Quête introuvable'; end if;
  if q.day <> public.today_paris() then raise exception 'Cette quête n''est plus d''aujourd''hui'; end if;
  if q.done_at is not null then raise exception 'Cette quête est déjà validée'; end if;
  if p_photo is null or split_part(p_photo, '/', 1) <> q.couple_id::text then raise exception 'Il faut un snap pour valider la quête'; end if;
  update public.daily_quests
  set done_at = now(), photo_path = p_photo, coins = case when q.hard then 5 else 3 end, streak = q.streak_base + 1
  where id = q.id;
end $$;

-- ---------------------------------------------------------------------
-- Garder une quête faite pour demain : 2 au maximum
-- ---------------------------------------------------------------------
create or replace function public.keep_quest(p_quest uuid, p_keep boolean) returns void
language plpgsql security definer set search_path = public as $$
declare q public.daily_quests;
begin
  select * into q from public.daily_quests where id = p_quest and profile_id = auth.uid() for update;
  if q.id is null then raise exception 'Quête introuvable'; end if;
  if q.day <> public.today_paris() then raise exception 'Cette quête n''est plus d''aujourd''hui'; end if;
  if q.done_at is null then raise exception 'Valide d''abord la quête avec un snap'; end if;
  if p_keep and (select count(*) from public.daily_quests where profile_id = auth.uid() and day = q.day and kept and id <> q.id) >= 2 then
    raise exception 'Tu peux garder 2 quêtes au maximum';
  end if;
  update public.daily_quests set kept = p_keep where id = q.id;
end $$;

-- ---------------------------------------------------------------------
-- Les pièces des quêtes s'ajoutent au solde
-- ---------------------------------------------------------------------
create or replace function public.coin_balance(p_profile uuid) returns int
language sql stable security definer set search_path = public as $$
  select public.coins_from_xp(coalesce((select sum(amount) from public.xp_events where profile_id = p_profile), 0)::int)
    + coalesce((select sum(reward) from public.visitor_found where profile_id = p_profile), 0)::int
    + coalesce((select sum(reward) from public.series_found where profile_id = p_profile), 0)::int
    + coalesce((select sum(coins) from public.daily_quests where profile_id = p_profile and done_at is not null), 0)::int
    - coalesce((select sum(price) from public.purchases where profile_id = p_profile), 0)::int
    - coalesce((select sum(price) from public.gifts where from_id = p_profile), 0)::int
    - coalesce((select sum(amount) from public.pot_events where profile_id = p_profile and reason = 'contribution'), 0)::int
$$;

-- ---------------------------------------------------------------------
-- Sécurité : le tirage, la validation et les gardées passent par les fonctions ci-dessus
-- ---------------------------------------------------------------------
alter table public.quest_starters enable row level security;
alter table public.quest_templates enable row level security;
alter table public.daily_quests enable row level security;

create policy quest_starters_read on public.quest_starters for select to authenticated using (true);
create policy quest_templates_read on public.quest_templates for select to authenticated using (couple_id = public.my_couple());
create policy quest_templates_insert on public.quest_templates for insert to authenticated
  with check (couple_id = public.my_couple() and profile_id = auth.uid());
create policy quest_templates_update on public.quest_templates for update to authenticated
  using (profile_id = auth.uid()) with check (profile_id = auth.uid() and couple_id = public.my_couple());
create policy daily_quests_read on public.daily_quests for select to authenticated using (couple_id = public.my_couple());

revoke all on public.quest_starters, public.quest_templates, public.daily_quests from anon, authenticated;
grant select on public.quest_starters, public.daily_quests to authenticated;
grant select, insert on public.quest_templates to authenticated;
grant update (title, hard, archived) on public.quest_templates to authenticated;

revoke all on function public.ensure_daily_quests(), public.complete_quest(uuid, text), public.keep_quest(uuid, boolean)
  from public, anon, authenticated;
grant execute on function public.ensure_daily_quests(), public.complete_quest(uuid, text), public.keep_quest(uuid, boolean)
  to authenticated;

do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    alter publication supabase_realtime add table public.daily_quests;
  end if;
end $$;

insert into public.schema_migrations (name) values ('012_quests');
