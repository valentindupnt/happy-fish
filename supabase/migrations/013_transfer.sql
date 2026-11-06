-- Happy Fish, migration 013 : offrir un objet de son inventaire
-- Un habit, un familier ou une décoration déjà possédé peut être offert à l'autre : il quitte l'inventaire de celui qui offre
-- (retiré de son poisson ou de son aquarium s'il y était) et arrive chez l'autre, avec un petit mot facultatif.
-- Aucune pièce n'est échangée : le prix payé reste enregistré dans le cadeau, donc celui qui offre n'est pas remboursé
-- (et l'autre ne paie rien). Si le niveau de l'autre est trop bas, l'objet l'attend en réserve.
-- À coller une seule fois dans le SQL Editor, après 012_quests.sql.
-- Ne touche à aucune donnée existante.

do $$
begin
  if exists (select 1 from public.schema_migrations where name = '013_transfer') then
    raise exception 'La migration 013_transfer est déjà appliquée, rien à faire';
  end if;
end $$;

create or replace function public.transfer_item(p_item text, p_message text default null) returns void
language plpgsql security definer set search_path = public as $$
declare
  it public.shop_items;
  v_couple uuid := public.require_couple();
  v_to uuid;
  v_msg text := nullif(left(btrim(coalesce(p_message, '')), 140), '');
  v_price int;
begin
  perform 1 from public.profiles where couple_id = v_couple order by id for update;
  select id into v_to from public.profiles where couple_id = v_couple and id <> auth.uid();
  if v_to is null then raise exception 'Ton duo n''est pas encore complet'; end if;
  select * into it from public.shop_items where id = p_item;
  if it.id is null or it.scope <> 'perso' or it.kind not in ('hat', 'pet', 'deco') then
    raise exception 'Cet objet ne peut pas être offert';
  end if;
  if not exists (select 1 from public.purchases where profile_id = auth.uid() and item_id = p_item) then
    raise exception 'Tu ne l''as pas';
  end if;
  if exists (select 1 from public.purchases where profile_id = v_to and item_id = p_item) then
    raise exception 'Ton duo l''a déjà';
  end if;

  -- Il quitte son poisson et son aquarium
  update public.profiles set fish_hat = null where id = auth.uid() and fish_hat = p_item;
  update public.profiles set fish_pet = null where id = auth.uid() and fish_pet = p_item;
  delete from public.deco_slots where profile_id = auth.uid() and item_id = p_item;
  delete from public.purchases where profile_id = auth.uid() and item_id = p_item returning price into v_price;

  -- Il arrive chez l'autre, sans pièce échangée : le prix payé passe dans le cadeau, qui compense la suppression de l'achat
  insert into public.purchases (profile_id, item_id, price) values (v_to, p_item, 0);
  insert into public.gifts (couple_id, from_id, to_id, item_id, price, message) values (v_couple, auth.uid(), v_to, p_item, v_price, v_msg);
end $$;

revoke all on function public.transfer_item(text, text) from public, anon, authenticated;
grant execute on function public.transfer_item(text, text) to authenticated;

insert into public.schema_migrations (name) values ('013_transfer');
