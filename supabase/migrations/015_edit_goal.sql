-- Happy Fish, migration 015 : modifier un objectif en cours, et limiter les reports
-- 1. update_goal : changer les jours et la répétition d'un objectif, à partir d'aujourd'hui seulement.
--    L'historique (jours passés, sous-objectifs faits) ne bouge jamais, la durée ne change que les prochains gains d'XP.
--    Un jour retiré supprime les sous-objectifs pas encore faits de ce jour (sauf ceux bloqués) ; un jour ajouté en crée.
--    Arrêter la répétition garde la semaine en cours et efface les semaines suivantes.
--    Activer la répétition sur un objectif ponctuel le répète à partir de la semaine suivante, avec les mêmes jours.
-- 2. Un sous-objectif ne peut être reporté que 2 fois : au 2e report il est bloqué, il doit être fait
--    (plus de report, plus de retrait, et il reste même si on retire son jour).
--    Le compteur repart de 0 pour tous les sous-objectifs existants.
-- À coller une seule fois dans le SQL Editor, après 014_force_effects.sql.
-- Ne supprime aucune donnée existante.

do $$
begin
  if exists (select 1 from public.schema_migrations where name = '015_edit_goal') then
    raise exception 'La migration 015_edit_goal est déjà appliquée, rien à faire';
  end if;
end $$;

alter table public.tasks add column postponed int not null default 0 check (postponed between 0 and 2);
-- Date à partir de laquelle les jours actuels de l'objectif valent (rien n'est créé avant)
alter table public.goals add column days_from date;

-- Les sous-objectifs ne naissent jamais avant la dernière modification des jours
create or replace function public.generate_goal_tasks(p_goal uuid, p_week date) returns void
language plpgsql security definer set search_path = public as $$
declare g public.goals;
begin
  select * into g from public.goals where id = p_goal;
  insert into public.tasks (goal_id, couple_id, owner_id, planned_date, date)
  select g.id, g.couple_id, g.owner_id, p_week + d - 1, p_week + d - 1
  from unnest(g.days) as d
  where p_week + d - 1 >= greatest(g.created_on, coalesce(g.days_from, g.created_on))
  on conflict (goal_id, planned_date) do nothing;
end $$;

-- Déplace un sous-objectif non fait. Reporter (plus tard, ou rattraper un jour passé) compte : 2 reports au maximum.
create or replace function public.move_task(p_task uuid, p_date date) returns void
language plpgsql security definer set search_path = public as $$
declare
  t public.tasks;
  v_report boolean;
begin
  select * into t from public.tasks where id = p_task and couple_id = public.require_couple() for update;
  if t.id is null then raise exception 'Sous-objectif introuvable'; end if;
  if t.owner_id is not null and t.owner_id <> auth.uid() then
    raise exception 'Tu ne peux déplacer que tes objectifs ou les objectifs communs';
  end if;
  if t.done_at is not null then raise exception 'Il est déjà fait'; end if;
  if t.postponed >= 2 then raise exception 'Bloqué : déjà reporté 2 fois, il doit être fait'; end if;
  if p_date < public.today_paris() then raise exception 'Choisis aujourd''hui ou un jour à venir'; end if;
  if p_date = t.date then return; end if;
  v_report := p_date > t.date or t.date < public.today_paris();
  update public.tasks
    set date = p_date, postponed = postponed + case when v_report then 1 else 0 end
    where id = p_task;
  perform public.recompute_bonuses(m.id, t.date) from public.profiles m
    where m.couple_id = t.couple_id and (t.owner_id is null or m.id = t.owner_id);
  perform public.recompute_bonuses(m.id, p_date) from public.profiles m
    where m.couple_id = t.couple_id and (t.owner_id is null or m.id = t.owner_id);
end $$;

-- Retire une occurrence (impossible si elle est bloquée)
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
  if t.postponed >= 2 then raise exception 'Bloqué : déjà reporté 2 fois, il doit être fait'; end if;
  update public.tasks set skipped = true where id = p_task;
  perform public.recompute_bonuses(m.id, t.date) from public.profiles m
    where m.couple_id = t.couple_id and (t.owner_id is null or m.id = t.owner_id);
end $$;

-- Modifie les jours et la répétition d'un objectif, à partir d'aujourd'hui
create or replace function public.update_goal(p_goal uuid, p_days int[], p_recurring boolean) returns void
language plpgsql security definer set search_path = public as $$
declare
  g public.goals;
  v_couple uuid := public.require_couple();
  v_today date := public.today_paris();
  v_week date := public.week_start(public.today_paris());
  v_next date := public.week_start(public.today_paris()) + 7;
  v_days int[];
  v_rec boolean;
  v_weeks date[];
  w date;
begin
  select * into g from public.goals where id = p_goal and couple_id = v_couple for update;
  if g.id is null then raise exception 'Objectif introuvable'; end if;
  if g.owner_id is not null and g.owner_id <> auth.uid() then
    raise exception 'Seul son propriétaire peut modifier cet objectif';
  end if;
  if g.archived then raise exception 'Cet objectif est arrêté'; end if;

  select coalesce(array_agg(distinct x order by x), '{}') into v_days from unnest(p_days) as x;
  if cardinality(v_days) = 0 or not (v_days <@ array[1,2,3,4,5,6,7]) then
    raise exception 'Choisis au moins un jour';
  end if;
  v_rec := coalesce(p_recurring, g.recurring);

  -- Objectif ponctuel d'une semaine passée : rien à changer, sauf le répéter à partir de la semaine suivante
  if not g.recurring and g.week_start < v_week then
    if not v_rec then raise exception 'Cet objectif est d''une semaine passée, rien à modifier'; end if;
    update public.goals set recurring = true, days = v_days, week_start = v_next, days_from = v_next where id = g.id;
    return;
  end if;

  -- Semaines déjà préparées (avant les suppressions), pour y recréer les jours ajoutés
  select coalesce(array_agg(distinct public.week_start(planned_date)), '{}') into v_weeks
    from public.tasks where goal_id = g.id and planned_date >= v_week;

  update public.goals set days = v_days, recurring = v_rec, days_from = v_today where id = g.id;

  -- Jours retirés : les sous-objectifs pas faits et pas bloqués disparaissent, du jour même à venir
  delete from public.tasks
    where goal_id = g.id and done_at is null and postponed < 2 and planned_date >= v_today
      and not (extract(isodow from planned_date)::int = any (v_days));

  -- Répétition arrêtée : on garde la semaine en cours, les suivantes disparaissent (sauf fait ou bloqué)
  if g.recurring and not v_rec then
    delete from public.tasks
      where goal_id = g.id and done_at is null and postponed < 2 and planned_date >= v_next;
  end if;

  -- Jours ajoutés
  if v_rec then
    foreach w in array v_weeks loop
      perform public.generate_goal_tasks(g.id, w);
    end loop;
    if g.week_start <= v_week then perform public.generate_goal_tasks(g.id, v_week); end if;
  else
    perform public.generate_goal_tasks(g.id, case when g.recurring then v_week else g.week_start end);
  end if;

  -- Les bonus de la journée et de la semaine en cours dépendent des sous-objectifs restants
  perform public.recompute_bonuses(pr.id, v_today) from public.profiles pr
    where pr.couple_id = v_couple and (g.owner_id is null or pr.id = g.owner_id);
end $$;

revoke all on function public.update_goal(uuid, int[], boolean) from public, anon, authenticated;
grant execute on function public.update_goal(uuid, int[], boolean) to authenticated;

insert into public.schema_migrations (name) values ('015_edit_goal');
