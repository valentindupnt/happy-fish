-- Happy Fish, migration 007 : le carnet des visiteurs
-- 23 visiteurs à collectionner, perso ou à deux, trouvés par les sous-objectifs
-- cochés ou par les séries. Chaque visiteur rapporte des pièces une fois trouvé :
-- au poisson qui l'a trouvé (perso) ou dans la cagnotte (à deux).
-- À coller une seule fois dans le SQL Editor, après 006_progression.sql.
-- Ne touche à aucune donnée existante. Les visiteurs déjà mérités arrivent dès la fin du script.

do $$
begin
  if exists (select 1 from public.schema_migrations where name = '007_visitors') then
    raise exception 'La migration 007_visitors est déjà appliquée, rien à faire';
  end if;
end $$;

-- ---------------------------------------------------------------------
-- Le catalogue
-- ---------------------------------------------------------------------
create table public.visitors (
  id text primary key,
  name text not null,
  arrival text not null,
  scope text not null check (scope in ('perso', 'duo')),
  family text not null check (family in ('tasks', 'streak')),
  threshold int not null check (threshold > 0),
  reward int not null check (reward >= 0),
  position int not null
);

insert into public.visitors (id, name, arrival, scope, family, threshold, reward, position) values
  ('bernard', 'Bernard-l’ermite', 'Un bernard-l’ermite est arrivé', 'perso', 'tasks', 10, 5, 1),
  ('gobie', 'Petit gobie', 'Un petit gobie est arrivé', 'perso', 'tasks', 30, 10, 2),
  ('chirurgien', 'Poisson-chirurgien', 'Un poisson-chirurgien est arrivé', 'perso', 'tasks', 75, 15, 3),
  ('papillon', 'Poisson-papillon', 'Un poisson-papillon est arrivé', 'perso', 'tasks', 150, 20, 4),
  ('ange', 'Poisson-ange', 'Un poisson-ange est arrivé', 'perso', 'tasks', 300, 30, 5),
  ('meduse', 'Méduse', 'Une méduse est arrivée', 'perso', 'tasks', 500, 40, 6),
  ('lion', 'Poisson-lion', 'Un poisson-lion est arrivé', 'perso', 'tasks', 800, 50, 7),
  ('calamar', 'Calamar', 'Un calamar est arrivé', 'perso', 'tasks', 1200, 60, 8),
  ('nudibranche', 'Nudibranche', 'Un nudibranche est arrivé', 'perso', 'streak', 3, 5, 9),
  ('globe', 'Poisson-globe', 'Un poisson-globe est arrivé', 'perso', 'streak', 7, 10, 10),
  ('murene', 'Murène', 'Une murène est arrivée', 'perso', 'streak', 14, 20, 11),
  ('seiche', 'Seiche', 'Une seiche est arrivée', 'perso', 'streak', 30, 30, 12),
  ('espadon', 'Espadon', 'Un espadon est arrivé', 'perso', 'streak', 60, 50, 13),
  ('lune', 'Poisson-lune', 'Un poisson-lune est arrivé', 'perso', 'streak', 100, 80, 14),
  ('sardines', 'Banc de sardines', 'Un banc de sardines est arrivé', 'duo', 'tasks', 50, 15, 15),
  ('clowns', 'Poissons-clowns', 'Des poissons-clowns sont arrivés', 'duo', 'tasks', 200, 30, 16),
  ('hippocampes', 'Hippocampes', 'Des hippocampes sont arrivés', 'duo', 'tasks', 500, 50, 17),
  ('tortue', 'Tortue', 'Une tortue est arrivée', 'duo', 'tasks', 1000, 80, 18),
  ('dauphin', 'Dauphin', 'Un dauphin est arrivé', 'duo', 'tasks', 2000, 120, 19),
  ('perroquets', 'Poissons-perroquets', 'Des poissons-perroquets sont arrivés', 'duo', 'streak', 5, 20, 20),
  ('manta', 'Raie manta', 'Une raie manta est arrivée', 'duo', 'streak', 21, 50, 21),
  ('requin', 'Requin-léopard', 'Un requin-léopard est arrivé', 'duo', 'streak', 50, 100, 22),
  ('baleine', 'Baleine', 'Une baleine est arrivée', 'duo', 'streak', 100, 150, 23);

-- Les visiteurs trouvés : profile_id pour un visiteur perso, vide pour un visiteur à deux.
-- Un visiteur trouvé le reste, même si on décoche ensuite.
create table public.visitor_found (
  id uuid primary key default gen_random_uuid(),
  couple_id uuid not null references public.couples(id) on delete cascade,
  profile_id uuid references public.profiles(id) on delete cascade,
  visitor_id text not null references public.visitors(id),
  reward int not null,
  found_at timestamptz not null default now()
);
create unique index visitor_found_perso on public.visitor_found (profile_id, visitor_id) where profile_id is not null;
create unique index visitor_found_duo on public.visitor_found (couple_id, visitor_id) where profile_id is null;

-- ---------------------------------------------------------------------
-- Les jauges
-- ---------------------------------------------------------------------
-- Sous-objectifs cochés par une personne : les siens et les communs
create or replace function public.tasks_done_by(p_profile uuid) returns int
language sql stable security definer set search_path = public as $$
  select count(*)::int from public.tasks t
  join public.profiles p on p.id = p_profile and p.couple_id = t.couple_id
  where t.done_at is not null and not t.skipped and (t.owner_id = p_profile or t.owner_id is null)
$$;

-- Sous-objectifs cochés par le duo (chacun une fois)
create or replace function public.tasks_done_duo(p_couple uuid) returns int
language sql stable security definer set search_path = public as $$
  select count(*)::int from public.tasks
  where couple_id = p_couple and done_at is not null and not skipped
$$;

-- Séries d'une personne sur ses objectifs récurrents (et les communs), mêmes règles que goal_streaks.
-- On garde aussi les objectifs archivés : un record ne disparaît pas.
create or replace function public.person_streaks(p_profile uuid, out best int, out now_run int)
language plpgsql stable security definer set search_path = public as $$
declare
  v_couple uuid := (select couple_id from public.profiles where id = p_profile);
  v_today date := public.today_paris();
  g record;
  t record;
  run int;
begin
  best := 0; now_run := 0;
  for g in select id from public.goals where couple_id = v_couple and recurring and (owner_id = p_profile or owner_id is null) loop
    run := 0;
    for t in select date, done_at from public.tasks where goal_id = g.id and not skipped order by date, planned_date loop
      if t.done_at is not null then
        run := run + 1;
        best := greatest(best, run);
      elsif t.date < v_today then
        run := 0;
      end if;
    end loop;
    now_run := greatest(now_run, run);
  end loop;
end $$;

-- Série à deux : jours d'affilée où chacun a coché au moins un sous-objectif (les siens ou un commun).
-- Aujourd'hui pas encore fait ne casse pas la série en cours.
create or replace function public.duo_streaks(p_couple uuid, out best int, out now_run int)
language plpgsql stable security definer set search_path = public as $$
declare
  v_today date := public.today_paris();
  d record;
  prev date;
  run int := 0;
begin
  best := 0; now_run := 0;
  if (select count(*) from public.profiles where couple_id = p_couple) < 2 then return; end if;
  for d in
    select t.date from public.tasks t
    join public.profiles p on p.couple_id = t.couple_id and (t.owner_id = p.id or t.owner_id is null)
    where t.couple_id = p_couple and t.done_at is not null and not t.skipped and t.date <= v_today
    group by t.date having count(distinct p.id) = 2
    order by t.date
  loop
    if prev is not null and d.date = prev + 1 then run := run + 1; else run := 1; end if;
    best := greatest(best, run);
    prev := d.date;
  end loop;
  if prev is not null and prev >= v_today - 1 then now_run := run; end if;
end $$;

-- Les jauges du duo, lues par l'app
create or replace function public.visitor_progress(p_couple uuid) returns jsonb
language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'duo', (select jsonb_build_object('tasks', public.tasks_done_duo(p_couple), 'streak_best', s.best, 'streak_now', s.now_run)
            from public.duo_streaks(p_couple) s),
    'profiles', coalesce((
      select jsonb_object_agg(p.id, jsonb_build_object('tasks', public.tasks_done_by(p.id), 'streak_best', s.best, 'streak_now', s.now_run))
      from public.profiles p cross join lateral public.person_streaks(p.id) s
      where p.couple_id = p_couple), '{}'::jsonb)
  )
$$;

create or replace function public.visitor_book() returns jsonb
language sql stable security definer set search_path = public as $$
  select public.visitor_progress(public.require_couple())
$$;

-- ---------------------------------------------------------------------
-- L'arrivée des visiteurs, vérifiée après chaque coche
-- ---------------------------------------------------------------------
create or replace function public.check_visitors(p_couple uuid) returns int
language plpgsql security definer set search_path = public as $$
declare
  prog jsonb := public.visitor_progress(p_couple);
  v record;
  p record;
  val int;
  new_id uuid;
  n int := 0;
  v_duo boolean := (select count(*) from public.profiles where couple_id = p_couple) = 2;
begin
  for v in select * from public.visitors order by position loop
    if v.scope = 'perso' then
      for p in select id from public.profiles where couple_id = p_couple loop
        val := (prog -> 'profiles' -> p.id::text ->> case when v.family = 'tasks' then 'tasks' else 'streak_best' end)::int;
        if coalesce(val, 0) >= v.threshold then
          insert into public.visitor_found (couple_id, profile_id, visitor_id, reward)
          values (p_couple, p.id, v.id, v.reward)
          on conflict do nothing returning id into new_id;
          if new_id is not null then n := n + 1; new_id := null; end if;
        end if;
      end loop;
    elsif v_duo then
      val := (prog -> 'duo' ->> case when v.family = 'tasks' then 'tasks' else 'streak_best' end)::int;
      if coalesce(val, 0) >= v.threshold then
        insert into public.visitor_found (couple_id, profile_id, visitor_id, reward)
        values (p_couple, null, v.id, v.reward)
        on conflict do nothing returning id into new_id;
        if new_id is not null then
          insert into public.pot_events (couple_id, profile_id, amount, reason) values (p_couple, null, v.reward, 'visitor');
          n := n + 1; new_id := null;
        end if;
      end if;
    end if;
  end loop;
  return n;
end $$;

create or replace function public.on_task_done_visitors() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if old.done_at is null and new.done_at is not null then
    perform public.check_visitors(new.couple_id);
  end if;
  return new;
end $$;

create trigger tasks_visitors after update of done_at on public.tasks
  for each row execute function public.on_task_done_visitors();

-- ---------------------------------------------------------------------
-- Pièces : les visiteurs perso s'ajoutent au solde, ceux à deux à la cagnotte
-- ---------------------------------------------------------------------
alter table public.pot_events drop constraint if exists pot_events_reason_check;
alter table public.pot_events add constraint pot_events_reason_check
  check (reason in ('contribution', 'aquarium', 'decor', 'challenge', 'habitat', 'visitor'));

create or replace function public.coin_balance(p_profile uuid) returns int
language sql stable security definer set search_path = public as $$
  select public.coins_from_xp(coalesce((select sum(amount) from public.xp_events where profile_id = p_profile), 0)::int)
    + coalesce((select sum(reward) from public.visitor_found where profile_id = p_profile), 0)::int
    - coalesce((select sum(price) from public.purchases where profile_id = p_profile), 0)::int
    - coalesce((select sum(amount) from public.pot_events where profile_id = p_profile and reason = 'contribution'), 0)::int
$$;

-- Chacun peut couper cette notification dans les Paramètres
alter table public.profiles add column notify_visitors boolean not null default true;
grant update (notify_visitors) on public.profiles to authenticated;

-- ---------------------------------------------------------------------
-- Notification « Un hippocampe est arrivé » (uniquement sur Supabase, là où private.notify existe)
-- ---------------------------------------------------------------------
do $do$
begin
  if exists (select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'private' and p.proname = 'notify') then
    execute $f$
      create or replace function private.on_visitor() returns trigger
      language plpgsql security definer set search_path = public as $b$
      begin
        perform private.notify(jsonb_build_object('type', 'visitor', 'id', new.id));
        return new;
      end $b$;
    $f$;
    execute 'create trigger visitor_found_notify after insert on public.visitor_found for each row execute function private.on_visitor()';
  end if;
end $do$;

-- ---------------------------------------------------------------------
-- Sécurité
-- ---------------------------------------------------------------------
alter table public.visitors enable row level security;
alter table public.visitor_found enable row level security;
revoke all on public.visitors, public.visitor_found from anon, authenticated;
create policy visitors_read on public.visitors for select to authenticated using (true);
create policy visitor_found_read on public.visitor_found for select to authenticated using (couple_id = public.my_couple());
grant select on public.visitors, public.visitor_found to authenticated;

revoke all on function public.tasks_done_by(uuid), public.tasks_done_duo(uuid), public.person_streaks(uuid), public.duo_streaks(uuid),
  public.visitor_progress(uuid), public.visitor_book(), public.check_visitors(uuid), public.on_task_done_visitors(), public.coin_balance(uuid)
  from public, anon, authenticated;
grant execute on function public.visitor_book() to authenticated;

-- Realtime : l'arrivée d'un visiteur s'affiche tout de suite chez l'autre
do $do$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    execute 'alter publication supabase_realtime add table public.visitor_found';
  end if;
end $do$;

-- Les visiteurs déjà mérités arrivent maintenant
select public.check_visitors(id) from public.couples;

insert into public.schema_migrations (name) values ('007_visitors');
