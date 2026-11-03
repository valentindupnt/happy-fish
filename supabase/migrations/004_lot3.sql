-- Happy Fish, lot 3 : pièces sans blocage, séries, défis au dé, idées de surprises, récap du mois
-- À coller une seule fois dans le SQL Editor, après 003_push.sql.

do $$
begin
  if exists (select 1 from public.schema_migrations where name = '004_lot3') then
    raise exception 'La migration 004_lot3 est déjà appliquée, rien à faire';
  end if;
end $$;

-- ---------------------------------------------------------------------
-- Pièces : l'XP en réserve rapporte aussi des pièces
-- ---------------------------------------------------------------------
-- Les pièces suivent le niveau « réel » (sans plafond), même avant le grand
-- aquarium. La cagnotte ne peut donc plus se retrouver bloquée.
create or replace function public.coin_balance(p_profile uuid) returns int
language sql stable security definer set search_path = public as $$
  select public.coins_earned(public.level_from_xp(
      coalesce((select sum(amount) from public.xp_events where profile_id = p_profile), 0)::int, 15))
    - coalesce((select sum(price) from public.purchases where profile_id = p_profile), 0)::int
    - coalesce((select sum(amount) from public.pot_events where profile_id = p_profile and reason = 'contribution'), 0)::int
$$;

alter table public.pot_events drop constraint if exists pot_events_reason_check;
alter table public.pot_events add constraint pot_events_reason_check
  check (reason in ('contribution', 'aquarium', 'decor', 'challenge'));

-- Achat automatique du grand aquarium quand la cagnotte atteint 120
create or replace function public.maybe_buy_aquarium(p_couple uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not (select aquarium_bought from public.couples where id = p_couple)
     and public.pot_balance(p_couple) >= 120 then
    insert into public.pot_events (couple_id, amount, reason) values (p_couple, -120, 'aquarium');
    update public.couples set aquarium_bought = true where id = p_couple;
  end if;
end $$;

-- ---------------------------------------------------------------------
-- Séries : sous-objectifs faits d'affilée sur un objectif récurrent
-- ---------------------------------------------------------------------
-- Un sous-objectif fait (même reporté) prolonge la série, un sous-objectif
-- d'un jour passé non fait la casse, un sous-objectif retiré ne compte pas,
-- ceux d'aujourd'hui et des jours à venir pas encore faits non plus.
create or replace function public.goal_streaks()
returns table (goal_id uuid, current_streak int, best_streak int)
language plpgsql stable security definer set search_path = public as $$
declare
  v_couple uuid := public.my_couple();
  v_today date := public.today_paris();
  g record;
  t record;
  run int;
  best int;
begin
  for g in select id from public.goals where couple_id = v_couple and recurring and not archived loop
    run := 0; best := 0;
    for t in select date, done_at from public.tasks where tasks.goal_id = g.id and not skipped order by date, planned_date loop
      if t.done_at is not null then
        run := run + 1;
        best := greatest(best, run);
      elsif t.date < v_today then
        run := 0;
      end if;
    end loop;
    goal_id := g.id; current_streak := run; best_streak := best;
    return next;
  end loop;
end $$;

-- ---------------------------------------------------------------------
-- Défis : une liste commune, le poisson lance le dé une fois par semaine
-- ---------------------------------------------------------------------
create table public.challenges (
  id uuid primary key default gen_random_uuid(),
  couple_id uuid not null references public.couples(id) on delete cascade,
  created_by uuid not null references public.profiles(id) on delete cascade,
  title text not null check (length(title) between 1 and 120),
  archived boolean not null default false,
  created_at timestamptz not null default now()
);

create table public.challenge_rolls (
  id uuid primary key default gen_random_uuid(),
  couple_id uuid not null references public.couples(id) on delete cascade,
  week_start date not null,
  challenge_id uuid not null references public.challenges(id) on delete cascade,
  title text not null,
  rolled_by uuid references public.profiles(id) on delete set null,
  rolled_at timestamptz not null default now(),
  done_at timestamptz,
  done_by uuid references public.profiles(id) on delete set null,
  unique (couple_id, week_start)
);


-- Lancer le dé : tire un défi au hasard pour la semaine (une seule fois)
create or replace function public.roll_challenge() returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v_couple uuid := public.require_couple();
  v_week date := public.week_start(public.today_paris());
  v_roll uuid;
  c public.challenges;
begin
  perform 1 from public.couples where id = v_couple for update;
  select id into v_roll from public.challenge_rolls where couple_id = v_couple and week_start = v_week;
  if v_roll is not null then return v_roll; end if;
  select * into c from public.challenges where couple_id = v_couple and not archived order by random() limit 1;
  if c.id is null then raise exception 'Ajoutez d''abord au moins un défi'; end if;
  insert into public.challenge_rolls (couple_id, week_start, challenge_id, title, rolled_by)
    values (v_couple, v_week, c.id, c.title, auth.uid()) returning id into v_roll;
  return v_roll;
end $$;

-- Défi réussi : 10 pièces pour la cagnotte commune
create or replace function public.complete_challenge(p_roll uuid) returns int
language plpgsql security definer set search_path = public as $$
declare
  v_couple uuid := public.require_couple();
  r public.challenge_rolls;
begin
  perform 1 from public.couples where id = v_couple for update;
  select * into r from public.challenge_rolls where id = p_roll and couple_id = v_couple;
  if r.id is null then raise exception 'Défi introuvable'; end if;
  if r.done_at is not null then return public.pot_balance(v_couple); end if;
  update public.challenge_rolls set done_at = now(), done_by = auth.uid() where id = p_roll;
  insert into public.pot_events (couple_id, profile_id, amount, reason) values (v_couple, auth.uid(), 10, 'challenge');
  perform public.maybe_buy_aquarium(v_couple);
  return public.pot_balance(v_couple);
end $$;

-- ---------------------------------------------------------------------
-- Idées de surprises (la roue tourne dans l'app, le résultat reste secret)
-- ---------------------------------------------------------------------
create table public.surprise_ideas (
  id uuid primary key default gen_random_uuid(),
  couple_id uuid not null references public.couples(id) on delete cascade,
  created_by uuid not null references public.profiles(id) on delete cascade,
  title text not null check (length(title) between 1 and 120),
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- Récap du mois
-- ---------------------------------------------------------------------
create or replace function public.month_recap(p_month date)
returns table (profile_id uuid, done int, minutes int, xp int, top_category text,
               messages int, treats int, perfect_days int)
language plpgsql stable security definer set search_path = public as $$
declare
  v_couple uuid := public.require_couple();
  v_from date := date_trunc('month', p_month)::date;
  v_to date := least((date_trunc('month', p_month) + interval '1 month - 1 day')::date, public.today_paris());
begin
  return query
  with people as (select p.id from public.profiles p where p.couple_id = v_couple),
  mine as (
    select pe.id as pid, t.id as tid, t.date, t.done_at, t.skipped, g.minutes as gmin, g.category_id
    from people pe
    join public.tasks t on t.couple_id = v_couple and (t.owner_id = pe.id or t.owner_id is null)
    join public.goals g on g.id = t.goal_id
    where t.date between v_from and v_to
  ),
  days as (
    select pid, date from mine where not skipped
    group by pid, date having bool_and(done_at is not null)
  ),
  cats as (
    select distinct on (m.pid) m.pid, c.name
    from mine m join public.categories c on c.id = m.category_id
    where m.done_at is not null
    group by m.pid, c.name
    order by m.pid, sum(m.gmin) desc
  )
  select pe.id,
    coalesce((select count(*) from mine m where m.pid = pe.id and m.done_at is not null), 0)::int,
    coalesce((select sum(m.gmin) from mine m where m.pid = pe.id and m.done_at is not null), 0)::int,
    coalesce((select sum(x.amount) from public.xp_events x where x.profile_id = pe.id
      and (x.created_at at time zone 'Europe/Paris')::date between v_from and v_to), 0)::int,
    (select name from cats where cats.pid = pe.id),
    coalesce((select count(*) from public.messages ms where ms.author_id = pe.id and ms.kind = 'text'
      and (ms.created_at at time zone 'Europe/Paris')::date between v_from and v_to), 0)::int,
    coalesce((select count(*) from public.messages ms where ms.author_id = pe.id and ms.kind in ('treat', 'bubble')
      and (ms.created_at at time zone 'Europe/Paris')::date between v_from and v_to), 0)::int,
    coalesce((select count(*) from days d where d.pid = pe.id), 0)::int
  from people pe;
end $$;

-- ---------------------------------------------------------------------
-- Sécurité et droits
-- ---------------------------------------------------------------------
alter table public.challenges enable row level security;
alter table public.challenge_rolls enable row level security;
alter table public.surprise_ideas enable row level security;

create policy challenges_all on public.challenges for all to authenticated
  using (couple_id = public.my_couple())
  with check (couple_id = public.my_couple() and created_by = auth.uid());
create policy challenge_rolls_read on public.challenge_rolls for select to authenticated
  using (couple_id = public.my_couple());
create policy surprise_ideas_all on public.surprise_ideas for all to authenticated
  using (couple_id = public.my_couple())
  with check (couple_id = public.my_couple() and created_by = auth.uid());

revoke all on function public.maybe_buy_aquarium(uuid), public.goal_streaks(), public.roll_challenge(),
  public.complete_challenge(uuid), public.month_recap(date) from public, anon, authenticated;
revoke all on public.challenges, public.challenge_rolls, public.surprise_ideas from anon, authenticated;

grant select, insert, update, delete on public.challenges, public.surprise_ideas to authenticated;
grant select on public.challenge_rolls to authenticated;
grant execute on function public.goal_streaks(), public.roll_challenge(), public.complete_challenge(uuid),
  public.month_recap(date) to authenticated;

do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    alter publication supabase_realtime add table public.challenges, public.challenge_rolls;
  end if;
end $$;

insert into public.schema_migrations (name) values ('004_lot3');
