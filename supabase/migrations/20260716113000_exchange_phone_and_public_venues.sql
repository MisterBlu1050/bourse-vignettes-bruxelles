alter table public.exchanges add column if not exists proposer_phone text;
alter table public.exchanges add column if not exists recipient_phone text;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'exchanges_proposer_phone_format'
  ) then
    alter table public.exchanges
      add constraint exchanges_proposer_phone_format
      check (proposer_phone is null or proposer_phone ~ '^\+?[0-9][0-9 .()/-]{6,24}$');
  end if;

  if not exists (
    select 1 from pg_constraint where conname = 'exchanges_recipient_phone_format'
  ) then
    alter table public.exchanges
      add constraint exchanges_recipient_phone_format
      check (recipient_phone is null or recipient_phone ~ '^\+?[0-9][0-9 .()/-]{6,24}$');
  end if;
end $$;

with public_places(name, commune, public_note) as (
  values
    ('Bibliothèque Muntpunt', 'Bruxelles-Ville', 'À l’intérieur, pendant les heures d’ouverture'),
    ('Bibliothèque Sans Souci', 'Ixelles', 'Hall d’accueil, pendant les heures d’ouverture'),
    ('Bibliothèque Sésame', 'Schaerbeek', 'Espace d’accueil public'),
    ('Maison communale', 'Etterbeek', 'Hall public, en journée'),
    ('Bibliothèque de Forest', 'Forest', 'À l’intérieur, pendant les heures d’ouverture'),
    ('Bibliothèque francophone', 'Jette', 'Espace public d’accueil'),
    ('Parc du Cinquantenaire', 'Etterbeek', 'Point de rencontre public près de l’entrée principale'),
    ('Bois de la Cambre', 'Bruxelles-Ville', 'Lieu public fréquenté, en journée uniquement'),
    ('Place Flagey', 'Ixelles', 'Lieu public fréquenté, près des arrêts de tram'),
    ('Parc Josaphat', 'Schaerbeek', 'Lieu public fréquenté, en journée uniquement')
)
insert into public.venues (name, commune, public_note, approved)
select name, commune, public_note, true
from public_places p
where not exists (
  select 1 from public.venues v
  where lower(v.name) = lower(p.name)
    and v.commune = p.commune
);

with public_places(name, commune) as (
  values
    ('Bibliothèque Muntpunt', 'Bruxelles-Ville'),
    ('Bibliothèque Sans Souci', 'Ixelles'),
    ('Bibliothèque Sésame', 'Schaerbeek'),
    ('Maison communale', 'Etterbeek'),
    ('Bibliothèque de Forest', 'Forest'),
    ('Bibliothèque francophone', 'Jette'),
    ('Parc du Cinquantenaire', 'Etterbeek'),
    ('Bois de la Cambre', 'Bruxelles-Ville'),
    ('Place Flagey', 'Ixelles'),
    ('Parc Josaphat', 'Schaerbeek')
)
update public.venues v
set approved = true
from public_places p
where lower(v.name) = lower(p.name)
  and v.commune = p.commune;

drop function if exists public.propose_exchange(uuid, uuid, uuid, date, text, text[], text[]);
drop function if exists public.confirm_exchange(uuid);
drop function if exists public.list_my_exchanges();

create or replace function public.confirm_exchange(exchange_to_confirm uuid, recipient_phone_input text)
returns public.exchanges
language plpgsql security definer set search_path = public as $$
declare ex exchanges;
declare sticker text;
begin
  recipient_phone_input := trim(regexp_replace(coalesce(recipient_phone_input, ''), '\s+', ' ', 'g'));
  if recipient_phone_input !~ '^\+?[0-9][0-9 .()/-]{6,24}$' then
    raise exception 'Téléphone invalide';
  end if;

  select * into ex from exchanges where id = exchange_to_confirm for update;
  if ex.recipient_id <> auth.uid() or ex.status <> 'proposed' or ex.expires_at < now() then
    raise exception 'Proposition indisponible';
  end if;
  perform 1 from inventory where user_id in (ex.proposer_id, ex.recipient_id) and collection_id = ex.collection_id for update;
  foreach sticker in array ex.proposer_gives loop
    if not exists (select 1 from inventory where user_id = ex.proposer_id and collection_id = ex.collection_id and kind = 'double' and sticker_id = sticker) then
      raise exception 'Une vignette proposée n’est plus disponible';
    end if;
  end loop;
  foreach sticker in array ex.recipient_gives loop
    if not exists (select 1 from inventory where user_id = ex.recipient_id and collection_id = ex.collection_id and kind = 'double' and sticker_id = sticker) then
      raise exception 'Une vignette proposée n’est plus disponible';
    end if;
  end loop;
  update exchanges
  set status = 'confirmed', recipient_phone = recipient_phone_input, updated_at = now()
  where id = ex.id
  returning * into ex;
  insert into notifications(user_id, exchange_id, kind) values (ex.proposer_id, ex.id, 'confirmed');
  return ex;
end;
$$;

create or replace function public.propose_exchange(
  target_collection uuid,
  target_recipient uuid,
  target_venue uuid,
  target_date date,
  target_slot text,
  my_stickers text[],
  their_stickers text[],
  proposer_phone_input text
)
returns public.exchanges
language plpgsql security definer set search_path = public as $$
declare ex exchanges;
declare sticker text;
begin
  proposer_phone_input := trim(regexp_replace(coalesce(proposer_phone_input, ''), '\s+', ' ', 'g'));
  if proposer_phone_input !~ '^\+?[0-9][0-9 .()/-]{6,24}$' then
    raise exception 'Téléphone invalide';
  end if;
  if target_recipient = auth.uid() or target_date <= current_date or cardinality(my_stickers) not between 1 and 50 or cardinality(their_stickers) not between 1 and 50 then
    raise exception 'Proposition invalide';
  end if;
  if target_slot <> all (array['10:00–11:00','11:00–12:00','14:00–15:00','15:00–16:00','16:00–17:00']) then
    raise exception 'Créneau invalide';
  end if;
  if not exists (select 1 from profiles where id = auth.uid() and is_adult_confirmed and suspended_at is null)
     or not exists (select 1 from profiles where id = target_recipient and is_adult_confirmed and suspended_at is null)
     or not exists (select 1 from venues where id = target_venue and approved)
     or exists (select 1 from blocks where (blocker_id = auth.uid() and blocked_id = target_recipient) or (blocker_id = target_recipient and blocked_id = auth.uid())) then
    raise exception 'Proposition non autorisée';
  end if;
  foreach sticker in array my_stickers loop
    if not exists (select 1 from sticker_catalog where collection_id = target_collection and code = sticker)
       or not exists (select 1 from inventory where user_id = auth.uid() and collection_id = target_collection and kind = 'double' and sticker_id = sticker)
       or not exists (select 1 from inventory where user_id = target_recipient and collection_id = target_collection and kind = 'wanted' and sticker_id = sticker) then
      raise exception 'Correspondance invalide';
    end if;
  end loop;
  foreach sticker in array their_stickers loop
    if not exists (select 1 from sticker_catalog where collection_id = target_collection and code = sticker)
       or not exists (select 1 from inventory where user_id = target_recipient and collection_id = target_collection and kind = 'double' and sticker_id = sticker)
       or not exists (select 1 from inventory where user_id = auth.uid() and collection_id = target_collection and kind = 'wanted' and sticker_id = sticker) then
      raise exception 'Correspondance invalide';
    end if;
  end loop;
  insert into exchanges(collection_id, proposer_id, recipient_id, venue_id, meeting_date, meeting_slot, proposer_gives, recipient_gives, proposer_phone)
  values (target_collection, auth.uid(), target_recipient, target_venue, target_date, target_slot, my_stickers, their_stickers, proposer_phone_input)
  returning * into ex;
  insert into notifications(user_id, exchange_id, kind) values (target_recipient, ex.id, 'proposal');
  return ex;
end;
$$;

create or replace function public.list_my_exchanges()
returns table (
  id uuid, other_user_id uuid, other_alias text, other_commune text, other_exchanges integer,
  venue_id uuid, venue_name text, venue_commune text, venue_note text,
  meeting_date date, meeting_slot text, status public.exchange_status, meeting_code text,
  i_give text[], i_receive text[], can_confirm boolean,
  my_phone text, other_phone text, phones_visible boolean
)
language sql security definer stable set search_path = public as $$
  select e.id,
    case when e.proposer_id = auth.uid() then e.recipient_id else e.proposer_id end,
    p.adult_alias, p.commune, p.successful_exchanges,
    v.id, v.name, v.commune, v.public_note,
    e.meeting_date, e.meeting_slot, e.status, e.meeting_code,
    case when e.proposer_id = auth.uid() then e.proposer_gives else e.recipient_gives end,
    case when e.proposer_id = auth.uid() then e.recipient_gives else e.proposer_gives end,
    e.recipient_id = auth.uid(),
    case when e.proposer_id = auth.uid() then e.proposer_phone else e.recipient_phone end,
    case
      when e.status in ('confirmed','completed') and e.proposer_id = auth.uid() then e.recipient_phone
      when e.status in ('confirmed','completed') then e.proposer_phone
      else null
    end,
    e.status in ('confirmed','completed') and e.proposer_phone is not null and e.recipient_phone is not null
  from exchanges e
  join profiles p on p.id = case when e.proposer_id = auth.uid() then e.recipient_id else e.proposer_id end
  join venues v on v.id = e.venue_id
  where auth.uid() in (e.proposer_id, e.recipient_id)
  order by e.created_at desc;
$$;

grant execute on function public.propose_exchange(uuid, uuid, uuid, date, text, text[], text[], text) to authenticated;
grant execute on function public.confirm_exchange(uuid, text) to authenticated;
