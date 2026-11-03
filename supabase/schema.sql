-- =====================================================================
-- Happy Fish : schéma de la base (Supabase / Postgres)
--
-- ATTENTION : ce fichier recrée toutes les tables et EFFACE les données.
-- À lancer une seule fois, à la mise en route, puis seed.sql.
-- Ensuite, chaque évolution passe par un fichier de supabase/migrations/.
-- =====================================================================

drop view if exists public.fish_status cascade;
drop table if exists public.xp_events cascade;
drop table if exists public.messages cascade;
drop table if exists public.force_messages cascade;
drop table if exists public.wishes cascade;
drop table if exists public.tasks cascade;
drop table if exists public.goals cascade;
drop table if exists public.suggestions cascade;
drop table if exists public.categories cascade;
drop table if exists public.profiles cascade;
drop table if exists public.couples cascade;
drop table if exists public.default_suggestions cascade;
drop table if exists public.default_categories cascade;
drop table if exists public.schema_migrations cascade;

-- ---------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------

create table public.schema_migrations (
  name text primary key,
  applied_at timestamptz not null default now()
);

-- Modèles copiés dans chaque couple à sa création (remplis par seed.sql)
create table public.default_categories (
  name text primary key,
  color text not null,
  position int not null
);

create table public.default_suggestions (
  id serial primary key,
  category_name text not null references public.default_categories(name) on delete cascade,
  title text not null,
  minutes int not null
);

create table public.couples (
  id uuid primary key default gen_random_uuid(),
  invite_code text not null unique default upper(substr(md5(random()::text || clock_timestamp()::text), 1, 6)),
  aquarium_bought boolean not null default false,
  created_at timestamptz not null default now()
);

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  couple_id uuid references public.couples(id) on delete set null,
  display_name text not null default '' check (length(display_name) <= 40),
  partner_nickname text check (length(partner_nickname) <= 40),
  fish_name text not null default 'Bulle' check (length(fish_name) between 1 and 24),
  fish_color text not null default 'corail'
    check (fish_color in ('corail', 'rose', 'lagon', 'ocean', 'soleil')),
  created_at timestamptz not null default now()
);

create table public.categories (
  id uuid primary key default gen_random_uuid(),
  couple_id uuid not null references public.couples(id) on delete cascade,
  name text not null check (length(name) between 1 and 40),
  color text not null default '#3FA7F0',
  position int not null default 0
);

create table public.suggestions (
  id uuid primary key default gen_random_uuid(),
  couple_id uuid not null references public.couples(id) on delete cascade,
  category_id uuid references public.categories(id) on delete cascade,
  title text not null check (length(title) between 1 and 120),
  minutes int not null default 15 check (minutes between 1 and 600)
);

-- Un objectif : une fois dans une semaine, ou récurrent chaque semaine.
-- owner_id null = objectif commun (XP pour les deux).
create table public.goals (
  id uuid primary key default gen_random_uuid(),
  couple_id uuid not null references public.couples(id) on delete cascade,
  owner_id uuid references public.profiles(id) on delete cascade,
  created_by uuid not null references public.profiles(id) on delete cascade,
  title text not null check (length(title) between 1 and 120),
  category_id uuid references public.categories(id) on delete set null,
  minutes int not null default 15 check (minutes between 1 and 600),
  days int[] not null check (days <@ array[1,2,3,4,5,6,7] and cardinality(days) between 1 and 7),
  recurring boolean not null default false,
  week_start date not null,
  created_on date not null,
  note text check (length(note) <= 1000),
  archived boolean not null default false,
  created_at timestamptz not null default now()
);

-- Un sous-objectif daté. planned_date = date d'origine, date = date actuelle (après report).
create table public.tasks (
  id uuid primary key default gen_random_uuid(),
  goal_id uuid not null references public.goals(id) on delete cascade,
  couple_id uuid not null references public.couples(id) on delete cascade,
  owner_id uuid references public.profiles(id) on delete cascade,
  planned_date date not null,
  date date not null,
  note text check (length(note) <= 1000),
  skipped boolean not null default false,
  done_at timestamptz,
  done_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  unique (goal_id, planned_date)
);
create index tasks_couple_date on public.tasks (couple_id, date);

create table public.wishes (
  id uuid primary key default gen_random_uuid(),
  couple_id uuid not null references public.couples(id) on delete cascade,
  created_by uuid not null references public.profiles(id) on delete cascade,
  title text not null check (length(title) between 1 and 120),
  note text check (length(note) <= 1000),
  link text check (length(link) <= 500),
  created_at timestamptz not null default now()
);

create table public.messages (
  id uuid primary key default gen_random_uuid(),
  couple_id uuid not null references public.couples(id) on delete cascade,
  author_id uuid not null references public.profiles(id) on delete cascade,
  kind text not null default 'text' check (kind in ('text', 'bubble', 'treat')),
  body text check (length(body) <= 1000),
  task_id uuid references public.tasks(id) on delete set null,
  created_at timestamptz not null default now()
);
create index messages_couple_created on public.messages (couple_id, created_at desc);

-- Messages de force proposés en un tap (propres à chacun)
create table public.force_messages (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  body text not null check (length(body) between 1 and 80),
  position int not null default 0
);

-- Journal de l'XP : la seule source de vérité pour la croissance du poisson
create table public.xp_events (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  amount int not null,
  reason text not null check (reason in ('task', 'day', 'week', 'treat')),
  task_id uuid references public.tasks(id) on delete cascade,
  ref_date date,
  created_at timestamptz not null default now()
);
create unique index xp_task_once on public.xp_events (profile_id, task_id) where reason = 'task';
create unique index xp_bonus_once on public.xp_events (profile_id, reason, ref_date) where reason in ('day', 'week');

-- ---------------------------------------------------------------------
-- Fonctions utilitaires
-- ---------------------------------------------------------------------

create or replace function public.today_paris() returns date
language sql stable as $$ select (now() at time zone 'Europe/Paris')::date $$;

create or replace function public.week_start(d date) returns date
language sql immutable as $$ select d - (extract(isodow from d)::int - 1) $$;

-- 1 XP par tranche de 5 minutes, minimum 1, plafond 24 (2 h)
create or replace function public.xp_for_minutes(m int) returns int
language sql immutable as $$ select least(24, greatest(1, m / 5)) $$;

-- XP cumulée pour atteindre le niveau n : 60 au niveau 1, puis 30 de plus par niveau
create or replace function public.xp_to_reach(n int) returns int
language sql immutable as $$ select 60 * (n - 1) + 15 * (n - 1) * (n - 2) $$;

create or replace function public.level_from_xp(xp int, cap int) returns int
language plpgsql immutable as $$
declare n int := 1;
begin
  while n < least(cap, 15) and xp >= public.xp_to_reach(n + 1) loop
    n := n + 1;
  end loop;
  return n;
end $$;

create or replace function public.my_couple() returns uuid
language sql stable security definer set search_path = public as $$
  select couple_id from public.profiles where id = auth.uid()
$$;

create or replace function public.require_couple() returns uuid
language plpgsql stable security definer set search_path = public as $$
declare c uuid;
begin
  select couple_id into c from public.profiles where id = auth.uid();
  if c is null then
    raise exception 'Tu dois d''abord créer ou rejoindre ton duo';
  end if;
  return c;
end $$;

-- Recalcule les bonus journée et semaine d'une personne pour une date
create or replace function public.recompute_bonuses(p_profile uuid, p_date date) returns void
language plpgsql security definer set search_path = public as $$
declare
  v_couple uuid;
  v_total int;
  v_done int;
  v_week date := public.week_start(p_date);
begin
  select couple_id into v_couple from public.profiles where id = p_profile;

  select count(*), count(done_at) into v_total, v_done
  from public.tasks
  where couple_id = v_couple and date = p_date and not skipped
    and (owner_id = p_profile or owner_id is null);
  if v_total > 0 and v_done = v_total then
    insert into public.xp_events (profile_id, amount, reason, ref_date)
    values (p_profile, 5, 'day', p_date) on conflict do nothing;
  else
    delete from public.xp_events where profile_id = p_profile and reason = 'day' and ref_date = p_date;
  end if;

  select count(*), count(done_at) into v_total, v_done
  from public.tasks
  where couple_id = v_couple and date between v_week and v_week + 6 and not skipped
    and (owner_id = p_profile or owner_id is null);
  if v_total > 0 and v_done = v_total then
    insert into public.xp_events (profile_id, amount, reason, ref_date)
    values (p_profile, 20, 'week', v_week) on conflict do nothing;
  else
    delete from public.xp_events where profile_id = p_profile and reason = 'week' and ref_date = v_week;
  end if;
end $$;

-- Crée les sous-objectifs d'un objectif pour une semaine donnée
create or replace function public.generate_goal_tasks(p_goal uuid, p_week date) returns void
language plpgsql security definer set search_path = public as $$
declare g public.goals;
begin
  select * into g from public.goals where id = p_goal;
  insert into public.tasks (goal_id, couple_id, owner_id, planned_date, date)
  select g.id, g.couple_id, g.owner_id, p_week + d - 1, p_week + d - 1
  from unnest(g.days) as d
  where p_week + d - 1 >= g.created_on
  on conflict (goal_id, planned_date) do nothing;
end $$;

-- ---------------------------------------------------------------------
-- Fonctions appelées par l'app
-- ---------------------------------------------------------------------

create or replace function public.create_couple(p_display_name text) returns text
language plpgsql security definer set search_path = public as $$
declare
  v_couple uuid;
  v_code text;
begin
  if auth.uid() is null then raise exception 'Non connecté'; end if;
  if exists (select 1 from public.profiles where id = auth.uid() and couple_id is not null) then
    raise exception 'Tu fais déjà partie d''un duo';
  end if;

  insert into public.couples default values returning id, invite_code into v_couple, v_code;
  update public.profiles set couple_id = v_couple, display_name = coalesce(nullif(trim(p_display_name), ''), display_name)
  where id = auth.uid();

  insert into public.categories (couple_id, name, color, position)
  select v_couple, name, color, position from public.default_categories;

  insert into public.suggestions (couple_id, category_id, title, minutes)
  select v_couple, c.id, s.title, s.minutes
  from public.default_suggestions s
  join public.categories c on c.couple_id = v_couple and c.name = s.category_name;

  insert into public.force_messages (profile_id, body, position)
  values (auth.uid(), 'Tu gères', 1), (auth.uid(), 'Courage', 2), (auth.uid(), 'Fier de toi', 3);

  return v_code;
end $$;

create or replace function public.join_couple(p_code text, p_display_name text) returns uuid
language plpgsql security definer set search_path = public as $$
declare v_couple uuid;
begin
  if auth.uid() is null then raise exception 'Non connecté'; end if;
  if exists (select 1 from public.profiles where id = auth.uid() and couple_id is not null) then
    raise exception 'Tu fais déjà partie d''un duo';
  end if;
  select id into v_couple from public.couples where invite_code = upper(trim(p_code));
  if v_couple is null then raise exception 'Code inconnu'; end if;
  if (select count(*) from public.profiles where couple_id = v_couple) >= 2 then
    raise exception 'Ce duo est déjà complet';
  end if;

  update public.profiles
  set couple_id = v_couple,
      display_name = coalesce(nullif(trim(p_display_name), ''), display_name),
      fish_color = 'rose'
  where id = auth.uid();

  insert into public.force_messages (profile_id, body, position)
  values (auth.uid(), 'Tu gères', 1), (auth.uid(), 'Courage', 2), (auth.uid(), 'Fier de toi', 3);
  return v_couple;
end $$;

create or replace function public.create_goal(
  p_title text,
  p_minutes int,
  p_days int[],
  p_recurring boolean,
  p_week date,
  p_category uuid default null,
  p_note text default null,
  p_common boolean default false
) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v_couple uuid := public.require_couple();
  v_week date := public.week_start(p_week);
  v_goal uuid;
begin
  if v_week < public.week_start(public.today_paris()) then
    raise exception 'Impossible d''ajouter un objectif à une semaine passée';
  end if;
  if p_category is not null and not exists (
    select 1 from public.categories where id = p_category and couple_id = v_couple
  ) then
    raise exception 'Catégorie inconnue';
  end if;

  insert into public.goals (couple_id, owner_id, created_by, title, category_id, minutes, days, recurring, week_start, created_on, note)
  values (v_couple, case when p_common then null else auth.uid() end, auth.uid(), trim(p_title),
          p_category, p_minutes, p_days, p_recurring, v_week, public.today_paris(), nullif(trim(p_note), ''))
  returning id into v_goal;

  perform public.generate_goal_tasks(v_goal, v_week);
  return v_goal;
end $$;

-- Crée les occurrences des objectifs récurrents pour une semaine
create or replace function public.ensure_week(p_week date) returns void
language plpgsql security definer set search_path = public as $$
declare
  v_couple uuid := public.require_couple();
  v_week date := public.week_start(p_week);
  g record;
begin
  if v_week > public.week_start(public.today_paris()) + 56 then
    return; -- pas plus de 8 semaines à l'avance
  end if;
  for g in
    select id from public.goals
    where couple_id = v_couple and recurring and not archived and week_start <= v_week
  loop
    perform public.generate_goal_tasks(g.id, v_week);
  end loop;
end $$;

-- Arrête un objectif : les occurrences à venir non faites disparaissent, l'XP gagnée reste
create or replace function public.archive_goal(p_goal uuid) returns void
language plpgsql security definer set search_path = public as $$
declare g public.goals;
begin
  select * into g from public.goals where id = p_goal and couple_id = public.require_couple();
  if g.id is null then raise exception 'Objectif introuvable'; end if;
  if g.owner_id is not null and g.owner_id <> auth.uid() then
    raise exception 'Seul son propriétaire peut arrêter cet objectif';
  end if;
  update public.goals set archived = true where id = p_goal;
  delete from public.tasks where goal_id = p_goal and done_at is null and date >= public.today_paris();
end $$;

-- Coche ou décoche un sous-objectif, et met l'XP à jour
create or replace function public.toggle_task(p_task uuid) returns boolean
language plpgsql security definer set search_path = public as $$
declare
  t public.tasks;
  m record;
  v_minutes int;
begin
  select * into t from public.tasks where id = p_task and couple_id = public.require_couple() for update;
  if t.id is null then raise exception 'Sous-objectif introuvable'; end if;
  if t.owner_id is not null and t.owner_id <> auth.uid() then
    raise exception 'Tu ne peux cocher que tes objectifs ou les objectifs communs';
  end if;
  if t.skipped then raise exception 'Ce sous-objectif est retiré'; end if;

  if t.done_at is null then
    if t.date > public.today_paris() then
      raise exception 'Pas encore : déplace-le à aujourd''hui pour le cocher';
    end if;
    select minutes into v_minutes from public.goals where id = t.goal_id;
    update public.tasks set done_at = now(), done_by = auth.uid() where id = p_task;
    for m in
      select id from public.profiles
      where couple_id = t.couple_id and (t.owner_id is null or id = t.owner_id)
    loop
      insert into public.xp_events (profile_id, amount, reason, task_id, ref_date)
      values (m.id, public.xp_for_minutes(v_minutes), 'task', p_task, t.date)
      on conflict do nothing;
      perform public.recompute_bonuses(m.id, t.date);
    end loop;
    return true;
  else
    update public.tasks set done_at = null, done_by = null where id = p_task;
    delete from public.xp_events where task_id = p_task and reason = 'task';
    for m in
      select id from public.profiles
      where couple_id = t.couple_id and (t.owner_id is null or id = t.owner_id)
    loop
      perform public.recompute_bonuses(m.id, t.date);
    end loop;
    return false;
  end if;
end $$;

-- Déplace un sous-objectif non fait à une autre date (aujourd'hui ou plus tard)
create or replace function public.move_task(p_task uuid, p_date date) returns void
language plpgsql security definer set search_path = public as $$
declare t public.tasks;
begin
  select * into t from public.tasks where id = p_task and couple_id = public.require_couple();
  if t.id is null then raise exception 'Sous-objectif introuvable'; end if;
  if t.owner_id is not null and t.owner_id <> auth.uid() then
    raise exception 'Tu ne peux déplacer que tes objectifs ou les objectifs communs';
  end if;
  if t.done_at is not null then raise exception 'Il est déjà fait'; end if;
  if p_date < public.today_paris() then raise exception 'Choisis aujourd''hui ou un jour à venir'; end if;
  update public.tasks set date = p_date where id = p_task;
  perform public.recompute_bonuses(m.id, t.date) from public.profiles m
    where m.couple_id = t.couple_id and (t.owner_id is null or m.id = t.owner_id);
  perform public.recompute_bonuses(m.id, p_date) from public.profiles m
    where m.couple_id = t.couple_id and (t.owner_id is null or m.id = t.owner_id);
end $$;

-- Retire une occurrence (sans toucher aux autres semaines d'un objectif récurrent)
create or replace function public.skip_task(p_task uuid) returns void
language plpgsql security definer set search_path = public as $$
declare t public.tasks;
begin
  select * into t from public.tasks where id = p_task and couple_id = public.require_couple();
  if t.id is null then raise exception 'Sous-objectif introuvable'; end if;
  if t.owner_id is not null and t.owner_id <> auth.uid() then
    raise exception 'Tu ne peux retirer que tes objectifs ou les objectifs communs';
  end if;
  if t.done_at is not null then raise exception 'Décoche-le d''abord'; end if;
  update public.tasks set skipped = true where id = p_task;
  perform public.recompute_bonuses(m.id, t.date) from public.profiles m
    where m.couple_id = t.couple_id and (t.owner_id is null or m.id = t.owner_id);
end $$;

-- Friandise : +2 XP pour le poisson de l'autre, 3 par jour maximum
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
  insert into public.xp_events (profile_id, amount, reason, ref_date) values (v_partner, 2, 'treat', v_today);
end $$;

-- Création du profil à l'inscription
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, email) values (new.id, new.email) on conflict (id) do nothing;
  return new;
end $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

-- Comptes créés avant ce script
insert into public.profiles (id, email) select id, email from auth.users on conflict (id) do nothing;

-- ---------------------------------------------------------------------
-- Vue : état des poissons
-- ---------------------------------------------------------------------

create view public.fish_status with (security_invoker = true) as
select
  p.id as profile_id,
  p.couple_id,
  coalesce(x.xp, 0)::int as xp,
  public.level_from_xp(coalesce(x.xp, 0)::int, case when c.aquarium_bought then 15 else 6 end) as level,
  public.level_from_xp(coalesce(x.xp, 0)::int, 15) as level_uncapped
from public.profiles p
left join public.couples c on c.id = p.couple_id
left join (select profile_id, sum(amount) as xp from public.xp_events group by profile_id) x
  on x.profile_id = p.id;

-- ---------------------------------------------------------------------
-- Sécurité (RLS) et droits
-- ---------------------------------------------------------------------

alter table public.couples enable row level security;
alter table public.profiles enable row level security;
alter table public.categories enable row level security;
alter table public.suggestions enable row level security;
alter table public.goals enable row level security;
alter table public.tasks enable row level security;
alter table public.wishes enable row level security;
alter table public.messages enable row level security;
alter table public.force_messages enable row level security;
alter table public.xp_events enable row level security;
alter table public.default_categories enable row level security;
alter table public.default_suggestions enable row level security;
alter table public.schema_migrations enable row level security;

revoke all on all tables in schema public from anon, authenticated;
revoke all on all functions in schema public from public, anon;

create policy couples_read on public.couples for select to authenticated using (id = public.my_couple());

create policy profiles_read on public.profiles for select to authenticated
  using (id = auth.uid() or couple_id = public.my_couple());
create policy profiles_update on public.profiles for update to authenticated
  using (id = auth.uid()) with check (id = auth.uid());

create policy categories_all on public.categories for all to authenticated
  using (couple_id = public.my_couple()) with check (couple_id = public.my_couple());
create policy suggestions_all on public.suggestions for all to authenticated
  using (couple_id = public.my_couple()) with check (couple_id = public.my_couple());

create policy goals_read on public.goals for select to authenticated using (couple_id = public.my_couple());
create policy goals_update on public.goals for update to authenticated
  using (couple_id = public.my_couple() and (owner_id = auth.uid() or owner_id is null))
  with check (couple_id = public.my_couple());

create policy tasks_read on public.tasks for select to authenticated using (couple_id = public.my_couple());
create policy tasks_note on public.tasks for update to authenticated
  using (couple_id = public.my_couple() and (owner_id = auth.uid() or owner_id is null))
  with check (couple_id = public.my_couple());

create policy wishes_all on public.wishes for all to authenticated
  using (couple_id = public.my_couple())
  with check (couple_id = public.my_couple() and created_by = auth.uid());

create policy messages_read on public.messages for select to authenticated using (couple_id = public.my_couple());
create policy messages_insert on public.messages for insert to authenticated
  with check (couple_id = public.my_couple() and author_id = auth.uid() and kind in ('text', 'bubble'));

create policy force_all on public.force_messages for all to authenticated
  using (profile_id = auth.uid()) with check (profile_id = auth.uid());

create policy xp_read on public.xp_events for select to authenticated
  using (profile_id in (select id from public.profiles where couple_id = public.my_couple()));

grant select on public.couples, public.profiles, public.categories, public.suggestions, public.goals,
  public.tasks, public.wishes, public.messages, public.force_messages, public.xp_events, public.fish_status
  to authenticated;
grant update (display_name, partner_nickname, fish_name, fish_color) on public.profiles to authenticated;
grant insert, update, delete on public.categories, public.suggestions, public.wishes, public.force_messages to authenticated;
grant update (title, minutes, category_id, note) on public.goals to authenticated;
grant update (note) on public.tasks to authenticated;
grant insert on public.messages to authenticated;

grant execute on function
  public.today_paris(), public.week_start(date), public.xp_for_minutes(int), public.xp_to_reach(int),
  public.level_from_xp(int, int), public.my_couple(),
  public.create_couple(text), public.join_couple(text, text),
  public.create_goal(text, int, int[], boolean, date, uuid, text, boolean),
  public.ensure_week(date), public.archive_goal(uuid), public.toggle_task(uuid),
  public.move_task(uuid, date), public.skip_task(uuid), public.send_treat()
  to authenticated;

-- Mises à jour en direct (chat, coches de l'autre)
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    alter publication supabase_realtime add table public.messages, public.tasks, public.xp_events, public.profiles;
  end if;
end $$;

insert into public.schema_migrations (name) values ('001_init');
