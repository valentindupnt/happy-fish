-- Happy Fish, migration 010 : GIFs dans les petits mots
-- Un petit mot peut maintenant être un GIF de la banque de l'app (fichiers dans public/gifs/).
-- Le message garde seulement le nom du GIF dans « body » (lettres minuscules, chiffres, tirets).
-- À coller une seule fois dans le SQL Editor, après 009_chat_photos.sql.
-- Ne touche à aucune donnée existante.

do $$
begin
  if exists (select 1 from public.schema_migrations where name = '010_gifs') then
    raise exception 'La migration 010_gifs est déjà appliquée, rien à faire';
  end if;
end $$;

alter table public.messages drop constraint if exists messages_kind_check;
alter table public.messages add constraint messages_kind_check check (kind in ('text', 'bubble', 'treat', 'image', 'gif'));
alter table public.messages add constraint messages_gif_body
  check (kind <> 'gif' or (body is not null and body ~ '^[a-z0-9-]{1,40}$' and task_id is null));

drop policy if exists messages_insert on public.messages;
create policy messages_insert on public.messages for insert to authenticated
  with check (
    couple_id = public.my_couple() and author_id = auth.uid() and kind in ('text', 'bubble', 'image', 'gif')
    and (image_path is null or split_part(image_path, '/', 1) = couple_id::text)
  );

insert into public.schema_migrations (name) values ('010_gifs');
