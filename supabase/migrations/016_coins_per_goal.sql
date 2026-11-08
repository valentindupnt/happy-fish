-- Happy Fish, migration 016 : les pièces se gagnent par sous-objectif réussi, plus avec l'XP
-- Barème selon le temps du sous-objectif : 5 à 14 min = 0 pièce, 15 à 29 = 1, 30 à 45 = 2, plus de 45 = 3.
-- (Les durées proposées dans l'app : 5, 10 → 0 ; 15, 20 → 1 ; 30, 45 → 2 ; 60, 90, 120 → 3.)
-- 1. Chaque événement d'XP porte maintenant ses pièces. Cocher les donne, décocher les retire.
--    Les bonus de journée et de semaine et les friandises ne rapportent plus de pièces.
--    Changer la durée d'un sous-objectif déjà fait ne change pas ses pièces (comme l'XP).
-- 2. Les pièces déjà gagnées ne bougent pas : chaque profil reçoit une ligne « legacy »
--    qui garde son total d'avant (1 pièce pour 5 XP), donc aucun solde ne change au passage.
--    Conséquence : décocher un sous-objectif fait avant cette migration ne rend aucune pièce.
-- 3. L'XP en réserve (au-dessus du plafond d'habitat) ne rapporte plus de pièces.
-- À coller une seule fois dans le SQL Editor, après 015_edit_goal.sql.
-- Ne supprime aucune donnée existante.

alter table public.xp_events add column if not exists coins int not null default 0 check (coins >= 0);

alter table public.xp_events drop constraint if exists xp_events_reason_check;
alter table public.xp_events add constraint xp_events_reason_check
  check (reason in ('task', 'day', 'week', 'treat', 'legacy'));
create unique index if not exists xp_legacy_once on public.xp_events (profile_id) where reason = 'legacy';

-- Pièces d'un sous-objectif selon son temps
create or replace function public.coins_for_minutes(m int) returns int
language sql immutable set search_path = public as $$
  select case when m > 45 then 3 when m >= 30 then 2 when m >= 15 then 1 else 0 end
$$;

-- On fige les pièces déjà gagnées (ancien barème : 1 pièce pour 5 XP, réserve comprise)
insert into public.xp_events (profile_id, amount, reason, coins)
select profile_id, 0, 'legacy', sum(amount)::int / 5
from public.xp_events
where reason <> 'legacy'
group by profile_id
having sum(amount)::int / 5 > 0
on conflict do nothing;

-- Le solde compte les pièces des événements, plus le reste inchangé (visiteurs, séries, quêtes, achats, cadeaux, cagnotte)
create or replace function public.coin_balance(p_profile uuid) returns int
language sql stable security definer set search_path = public as $$
  select coalesce((select sum(coins) from public.xp_events where profile_id = p_profile), 0)::int
    + coalesce((select sum(reward) from public.visitor_found where profile_id = p_profile), 0)::int
    + coalesce((select sum(reward) from public.series_found where profile_id = p_profile), 0)::int
    + coalesce((select sum(coins) from public.daily_quests where profile_id = p_profile and done_at is not null), 0)::int
    - coalesce((select sum(price) from public.purchases where profile_id = p_profile), 0)::int
    - coalesce((select sum(price) from public.gifts where from_id = p_profile), 0)::int
    - coalesce((select sum(amount) from public.pot_events where profile_id = p_profile and reason = 'contribution'), 0)::int
$$;

-- Cocher un sous-objectif donne l'XP et les pièces de son temps ; décocher retire les deux
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
      insert into public.xp_events (profile_id, amount, coins, reason, task_id, ref_date)
      values (m.id, public.xp_for_minutes(v_minutes), public.coins_for_minutes(v_minutes), 'task', p_task, t.date)
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

revoke all on function public.coins_for_minutes(int) from public, anon, authenticated;
grant execute on function public.coins_for_minutes(int) to authenticated;

insert into public.schema_migrations (name) values ('016_coins_per_goal');
