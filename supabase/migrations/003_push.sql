-- =====================================================================
-- Happy Fish, migration 003 : envoi des notifications.
-- Uniquement sur Supabase (pg_net, pg_cron, Vault). À lancer après 002.
--
-- Les secrets ne sont PAS dans ce fichier. Ils sont rangés dans le Vault
-- de Supabase sous les noms : hf_hook_secret, hf_notify_url,
-- hf_vapid_public, hf_vapid_private (voir GUIDE.md).
-- =====================================================================

do $$
begin
  if exists (select 1 from public.schema_migrations where name = '003_push') then
    raise exception 'La migration 003_push est déjà appliquée, rien à faire';
  end if;
end $$;

create extension if not exists pg_net;
create extension if not exists pg_cron;

create schema if not exists private;
revoke all on schema private from public, anon, authenticated;

-- Appelle la fonction d'envoi, sans jamais bloquer l'action de l'utilisateur
create or replace function private.notify(p_payload jsonb) returns void
language plpgsql security definer set search_path = public, extensions as $$
declare
  v_secret text;
  v_url text;
begin
  select decrypted_secret into v_secret from vault.decrypted_secrets where name = 'hf_hook_secret';
  select decrypted_secret into v_url from vault.decrypted_secrets where name = 'hf_notify_url';
  if v_secret is null or v_url is null then return; end if;
  perform net.http_post(
    url := v_url,
    body := p_payload,
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-hook-secret', v_secret),
    timeout_milliseconds := 8000
  );
exception when others then
  raise warning 'Happy Fish : notification non envoyée (%)', sqlerrm;
end $$;

create or replace function private.on_message() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  perform private.notify(jsonb_build_object('type', 'message', 'id', new.id));
  return new;
end $$;

create or replace function private.on_task_done() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if old.done_at is null and new.done_at is not null then
    perform private.notify(jsonb_build_object('type', 'check', 'id', new.id));
  end if;
  return new;
end $$;

create trigger messages_notify after insert on public.messages
  for each row execute function private.on_message();
create trigger tasks_notify after update of done_at on public.tasks
  for each row execute function private.on_task_done();

-- Toutes les heures : rappel du soir (20 h) et bilan du lundi (8 h), heure de Paris
select cron.schedule('happy-fish-tick', '0 * * * *', $$select private.notify('{"type":"tick"}'::jsonb)$$);

-- Configuration lue par la fonction d'envoi (réservée au serveur)
create or replace function public.push_config() returns jsonb
language sql stable security definer set search_path = public as $$
  select coalesce(jsonb_object_agg(name, decrypted_secret), '{}'::jsonb)
  from vault.decrypted_secrets
  where name in ('hf_hook_secret', 'hf_vapid_public', 'hf_vapid_private')
$$;
revoke all on function public.push_config() from public, anon, authenticated;
grant execute on function public.push_config() to service_role;

insert into public.schema_migrations (name) values ('003_push');
