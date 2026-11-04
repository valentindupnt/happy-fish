-- Happy Fish, widget iPhone (via l'app Scriptable)
-- Chaque personne a un jeton secret. La fonction « widget » le reçoit et renvoie
-- de quoi dessiner les bocaux : poissons, niveaux, avancement du jour.
-- À coller une seule fois dans le SQL Editor, après 004_lot3.sql.

do $$
begin
  if exists (select 1 from public.schema_migrations where name = '005_widget') then
    raise exception 'La migration 005_widget est déjà appliquée, rien à faire';
  end if;
end $$;

create table public.widget_tokens (
  profile_id uuid primary key references public.profiles(id) on delete cascade,
  token text not null unique,
  created_at timestamptz not null default now()
);
alter table public.widget_tokens enable row level security;
revoke all on public.widget_tokens from anon, authenticated;

create or replace function public.new_widget_secret() returns text
language sql volatile set search_path = public as $$
  select md5(random()::text || clock_timestamp()::text) || md5(random()::text || clock_timestamp()::text)
$$;

-- Mon jeton (créé au premier appel)
create or replace function public.my_widget_token() returns text
language plpgsql security definer set search_path = public as $$
declare v text;
begin
  perform public.require_couple();
  select token into v from public.widget_tokens where profile_id = auth.uid();
  if v is null then
    insert into public.widget_tokens (profile_id, token) values (auth.uid(), public.new_widget_secret())
      returning token into v;
  end if;
  return v;
end $$;

-- Nouveau jeton : l'ancien widget cesse de marcher
create or replace function public.reset_widget_token() returns text
language plpgsql security definer set search_path = public as $$
declare v text := public.new_widget_secret();
begin
  perform public.require_couple();
  insert into public.widget_tokens (profile_id, token) values (auth.uid(), v)
    on conflict (profile_id) do update set token = excluded.token, created_at = now();
  return v;
end $$;

-- Données du widget, pour la fonction serveur seulement
create or replace function public.widget_data(p_token text) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare
  v_me uuid;
  v_couple uuid;
  v_today date := public.today_paris();
  v_bought boolean;
  v_result jsonb;
begin
  select profile_id into v_me from public.widget_tokens where token = p_token;
  if v_me is null then return null; end if;
  select couple_id into v_couple from public.profiles where id = v_me;
  select aquarium_bought into v_bought from public.couples where id = v_couple;

  select jsonb_build_object(
    'date', v_today,
    'aquarium', coalesce(v_bought, false),
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
      'stade', case (fs.level - 1) / 3 when 0 then 'Alevin' when 1 then 'Petit' when 2 then 'Moyen' when 3 then 'Grand' else 'Majestueux' end,
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

revoke all on function public.new_widget_secret(), public.my_widget_token(), public.reset_widget_token(), public.widget_data(text)
  from public, anon, authenticated;
grant execute on function public.my_widget_token(), public.reset_widget_token() to authenticated;
grant execute on function public.widget_data(text) to service_role;

insert into public.schema_migrations (name) values ('005_widget');
