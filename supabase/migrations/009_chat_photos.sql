-- Happy Fish, migration 009 : photos dans les petits mots
-- Un petit mot peut maintenant être une photo (avec une légende facultative).
-- Les photos sont rangées dans un espace de stockage privé « chat-images », un dossier par duo :
-- seuls les deux membres du duo peuvent les voir ou en ajouter.
-- À coller une seule fois dans le SQL Editor, après 008_deco.sql.
-- Ne touche à aucune donnée existante.

do $$
begin
  if exists (select 1 from public.schema_migrations where name = '009_chat_photos') then
    raise exception 'La migration 009_chat_photos est déjà appliquée, rien à faire';
  end if;
end $$;

-- ---------------------------------------------------------------------
-- Messages : un nouveau genre « image »
-- ---------------------------------------------------------------------
alter table public.messages add column image_path text check (length(image_path) <= 200);
alter table public.messages drop constraint if exists messages_kind_check;
alter table public.messages add constraint messages_kind_check check (kind in ('text', 'bubble', 'treat', 'image'));
alter table public.messages add constraint messages_image_path check ((kind = 'image') = (image_path is not null));

-- On n'écrit que dans le dossier de son duo
drop policy if exists messages_insert on public.messages;
create policy messages_insert on public.messages for insert to authenticated
  with check (
    couple_id = public.my_couple() and author_id = auth.uid() and kind in ('text', 'bubble', 'image')
    and (image_path is null or split_part(image_path, '/', 1) = couple_id::text)
  );

-- ---------------------------------------------------------------------
-- Stockage des photos (seulement sur Supabase, pas dans les tests locaux)
-- ---------------------------------------------------------------------
do $do$
begin
  if exists (select 1 from pg_namespace where nspname = 'storage')
     and exists (select 1 from pg_tables where schemaname = 'storage' and tablename = 'buckets') then
    insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
    values ('chat-images', 'chat-images', false, 5242880, array['image/jpeg', 'image/png', 'image/webp'])
    on conflict (id) do nothing;

    execute $p$
      create policy chat_images_read on storage.objects for select to authenticated
        using (bucket_id = 'chat-images' and (storage.foldername(name))[1] = public.my_couple()::text)
    $p$;
    execute $p$
      create policy chat_images_insert on storage.objects for insert to authenticated
        with check (bucket_id = 'chat-images' and (storage.foldername(name))[1] = public.my_couple()::text)
    $p$;
  end if;
end $do$;

insert into public.schema_migrations (name) values ('009_chat_photos');
