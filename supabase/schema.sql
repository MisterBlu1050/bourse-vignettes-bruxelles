-- Bourse aux vignettes Bruxelles — schéma initial
-- À exécuter dans l'éditeur SQL d'un projet Supabase situé en Europe.

create extension if not exists pgcrypto;

create type public.inventory_kind as enum ('double', 'wanted');
create type public.exchange_status as enum ('proposed', 'confirmed', 'completed', 'cancelled', 'expired');
create type public.report_status as enum ('open', 'reviewing', 'resolved', 'dismissed');

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  adult_alias text not null check (adult_alias ~ '^[[:alpha:]][[:alpha:] ''-]{0,30}[.]?$'),
  commune text not null check (commune = any (array[
    'Anderlecht','Auderghem','Berchem-Sainte-Agathe','Bruxelles-Ville','Etterbeek',
    'Evere','Forest','Ganshoren','Ixelles','Jette','Koekelberg','Molenbeek-Saint-Jean',
    'Saint-Gilles','Saint-Josse-ten-Noode','Schaerbeek','Uccle','Watermael-Boitsfort',
    'Woluwe-Saint-Lambert','Woluwe-Saint-Pierre'
  ])),
  is_adult_confirmed boolean not null default false,
  email_match_notifications boolean not null default true,
  suspended_at timestamptz,
  successful_exchanges integer not null default 0 check (successful_exchanges >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.collections (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug ~ '^[a-z0-9-]+$'),
  title text not null check (length(title) between 2 and 80),
  edition text not null check (length(edition) between 2 and 80),
  sticker_count integer not null check (sticker_count between 1 and 2000),
  active boolean not null default false,
  created_at timestamptz not null default now()
);

create unique index one_active_collection on public.collections (active) where active;

create table public.sticker_catalog (
  collection_id uuid not null references public.collections(id) on delete cascade,
  code text not null check (length(code) between 2 and 6),
  group_code text not null check (length(group_code) between 2 and 3),
  country_label text not null check (length(country_label) between 2 and 80),
  primary key (collection_id, code)
);

create table public.inventory (
  user_id uuid not null references public.profiles(id) on delete cascade,
  collection_id uuid not null references public.collections(id) on delete cascade,
  sticker_id text not null,
  kind public.inventory_kind not null,
  quantity smallint not null default 1 check (quantity between 1 and 20),
  updated_at timestamptz not null default now(),
  primary key (user_id, collection_id, sticker_id, kind),
  foreign key (collection_id, sticker_id) references public.sticker_catalog(collection_id, code),
  check (quantity = 1 or kind = 'double')
);

create index inventory_match_index on public.inventory (collection_id, kind, sticker_id, user_id);

create table public.venues (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(name) between 2 and 100),
  commune text not null,
  public_note text not null check (length(public_note) between 2 and 180),
  opening_hours_url text,
  approved boolean not null default false,
  created_at timestamptz not null default now()
);

create table public.exchanges (
  id uuid primary key default gen_random_uuid(),
  collection_id uuid not null references public.collections(id),
  proposer_id uuid not null references public.profiles(id),
  recipient_id uuid not null references public.profiles(id),
  venue_id uuid not null references public.venues(id),
  meeting_date date not null,
  meeting_slot text not null check (meeting_slot = any (array['10:00–11:00','11:00–12:00','14:00–15:00','15:00–16:00','16:00–17:00'])),
  proposer_gives text[] not null check (cardinality(proposer_gives) between 1 and 50),
  recipient_gives text[] not null check (cardinality(recipient_gives) between 1 and 50),
  proposer_phone text check (proposer_phone is null or proposer_phone ~ '^\+?[0-9][0-9 .()/-]{6,24}$'),
  recipient_phone text check (recipient_phone is null or recipient_phone ~ '^\+?[0-9][0-9 .()/-]{6,24}$'),
  status public.exchange_status not null default 'proposed',
  meeting_code text not null default upper(substr(md5(random()::text || clock_timestamp()::text), 1, 6)),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  expires_at timestamptz not null default now() + interval '48 hours',
  check (proposer_id <> recipient_id),
  check (meeting_date >= current_date)
);

create index exchanges_participants on public.exchanges (proposer_id, recipient_id, status);

create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  exchange_id uuid references public.exchanges(id) on delete cascade,
  match_user_id uuid references public.profiles(id) on delete cascade,
  match_gives text[],
  match_receives text[],
  kind text not null check (kind = any (array['proposal','confirmed','cancelled','reminder','moderation','match'])),
  emailed_at timestamptz,
  email_error text,
  read_at timestamptz,
  created_at timestamptz not null default now()
);

create unique index notifications_unique_match_email on public.notifications (user_id, match_user_id, kind) where kind = 'match';

create table public.blocks (
  blocker_id uuid not null references public.profiles(id) on delete cascade,
  blocked_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (blocker_id, blocked_id),
  check (blocker_id <> blocked_id)
);

create table public.reports (
  id uuid primary key default gen_random_uuid(),
  reporter_id uuid not null references public.profiles(id) on delete cascade,
  reported_user_id uuid references public.profiles(id) on delete set null,
  exchange_id uuid references public.exchanges(id) on delete set null,
  reason text not null check (reason = any (array['unsafe_meeting','sale_attempt','child_data','harassment','fraud','other'])),
  details text check (details is null or length(details) <= 500),
  status public.report_status not null default 'open',
  decision_reason text,
  created_at timestamptz not null default now(),
  resolved_at timestamptz
);

create table public.moderation_log (
  id uuid primary key default gen_random_uuid(),
  report_id uuid references public.reports(id) on delete set null,
  moderator_id uuid references auth.users(id),
  action text not null,
  reason text not null,
  created_at timestamptz not null default now()
);

create table public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  endpoint text not null unique,
  p256dh text not null,
  auth_secret text not null,
  created_at timestamptz not null default now()
);

-- Correspondances : ne révèle que l'alias, la commune et les identifiants utiles.
create or replace function public.find_matches(target_collection uuid)
returns table (
  user_id uuid, adult_alias text, commune text, gives text[], receives text[], successful_exchanges integer
)
language sql security definer stable set search_path = public as $$
  with my_doubles as (
    select sticker_id from inventory where user_id = auth.uid() and collection_id = target_collection and kind = 'double'
  ), my_wanted as (
    select sticker_id from inventory where user_id = auth.uid() and collection_id = target_collection and kind = 'wanted'
  ), candidates as (
    select p.id, p.adult_alias, p.commune, p.successful_exchanges,
      array_agg(distinct theirs.sticker_id order by theirs.sticker_id) filter (where mine_w.sticker_id is not null) as gives,
      array_agg(distinct theirs.sticker_id order by theirs.sticker_id) filter (where mine_d.sticker_id is not null) as receives
    from profiles p
    join inventory theirs on theirs.user_id = p.id and theirs.collection_id = target_collection
    left join my_wanted mine_w on mine_w.sticker_id = theirs.sticker_id and theirs.kind = 'double'
    left join my_doubles mine_d on mine_d.sticker_id = theirs.sticker_id and theirs.kind = 'wanted'
    where p.id <> auth.uid() and p.suspended_at is null
      and not exists (select 1 from blocks b where (b.blocker_id = auth.uid() and b.blocked_id = p.id) or (b.blocker_id = p.id and b.blocked_id = auth.uid()))
    group by p.id
  )
  select id, adult_alias, commune, gives, receives, successful_exchanges
  from candidates where cardinality(gives) > 0 and cardinality(receives) > 0
  order by least(cardinality(gives), cardinality(receives)) desc;
$$;

create or replace function public.queue_match_notifications(target_collection uuid)
returns integer
language plpgsql security definer set search_path = public as $$
declare inserted_count integer;
begin
  if auth.uid() is null then
    raise exception 'Session requise';
  end if;

  if not exists (
    select 1 from profiles
    where id = auth.uid()
      and is_adult_confirmed
      and suspended_at is null
  ) then
    raise exception 'Profil parent requis';
  end if;

  with my_profile as (
    select id, email_match_notifications
    from profiles
    where id = auth.uid()
  ), my_doubles as (
    select sticker_id
    from inventory
    where user_id = auth.uid()
      and collection_id = target_collection
      and kind = 'double'
  ), my_wanted as (
    select sticker_id
    from inventory
    where user_id = auth.uid()
      and collection_id = target_collection
      and kind = 'wanted'
  ), candidates as (
    select
      p.id,
      p.email_match_notifications,
      coalesce(array_agg(distinct theirs.sticker_id order by theirs.sticker_id) filter (where mine_w.sticker_id is not null), '{}'::text[]) as gives,
      coalesce(array_agg(distinct theirs.sticker_id order by theirs.sticker_id) filter (where mine_d.sticker_id is not null), '{}'::text[]) as receives
    from profiles p
    join inventory theirs
      on theirs.user_id = p.id
     and theirs.collection_id = target_collection
    left join my_wanted mine_w
      on mine_w.sticker_id = theirs.sticker_id
     and theirs.kind = 'double'
    left join my_doubles mine_d
      on mine_d.sticker_id = theirs.sticker_id
     and theirs.kind = 'wanted'
    where p.id <> auth.uid()
      and p.suspended_at is null
      and not exists (
        select 1 from blocks b
        where (b.blocker_id = auth.uid() and b.blocked_id = p.id)
           or (b.blocker_id = p.id and b.blocked_id = auth.uid())
      )
    group by p.id
  ), matches as (
    select id, email_match_notifications, gives, receives
    from candidates
    where cardinality(gives) > 0
      and cardinality(receives) > 0
  ), inserted as (
    insert into notifications(user_id, kind, match_user_id, match_gives, match_receives)
    select auth.uid(), 'match', m.id, m.gives, m.receives
    from matches m
    cross join my_profile me
    where me.email_match_notifications
    union all
    select m.id, 'match', auth.uid(), m.receives, m.gives
    from matches m
    where m.email_match_notifications
    on conflict do nothing
    returning 1
  )
  select count(*) into inserted_count from inserted;

  return inserted_count;
end;
$$;

create or replace function public.list_my_match_notifications()
returns table (
  id uuid,
  other_user_id uuid,
  other_alias text,
  other_commune text,
  i_receive text[],
  i_give text[],
  created_at timestamptz
)
language sql security definer stable set search_path = public as $$
  select
    n.id,
    n.match_user_id as other_user_id,
    p.adult_alias as other_alias,
    p.commune as other_commune,
    coalesce(n.match_gives, '{}'::text[]) as i_receive,
    coalesce(n.match_receives, '{}'::text[]) as i_give,
    n.created_at
  from notifications n
  join profiles p on p.id = n.match_user_id
  where n.user_id = auth.uid()
    and n.kind = 'match'
    and n.read_at is null
  order by n.created_at desc
  limit 10;
$$;

-- Acceptation atomique : verrouille les inventaires avant confirmation.
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

create or replace function public.set_exchange_status(target_exchange uuid, target_status public.exchange_status)
returns public.exchanges
language plpgsql security definer set search_path = public as $$
declare ex exchanges;
begin
  select * into ex from exchanges where id = target_exchange for update;
  if auth.uid() not in (ex.proposer_id, ex.recipient_id) then raise exception 'Accès refusé'; end if;
  if target_status = 'cancelled' and ex.status in ('proposed','confirmed') then
    update exchanges set status = 'cancelled', updated_at = now() where id = ex.id returning * into ex;
  elsif target_status = 'completed' and ex.status = 'confirmed' and ex.meeting_date <= current_date then
    update exchanges set status = 'completed', updated_at = now() where id = ex.id returning * into ex;
    update profiles set successful_exchanges = successful_exchanges + 1 where id in (ex.proposer_id, ex.recipient_id);
  else
    raise exception 'Transition d’état invalide';
  end if;
  insert into notifications(user_id, exchange_id, kind)
  values (case when auth.uid() = ex.proposer_id then ex.recipient_id else ex.proposer_id end, ex.id,
    case when ex.status = 'cancelled' then 'cancelled' else 'reminder' end);
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

create or replace function public.delete_my_account()
returns void language plpgsql security definer set search_path = public as $$
begin
  delete from auth.users where id = auth.uid();
end;
$$;

alter table public.profiles enable row level security;
alter table public.collections enable row level security;
alter table public.sticker_catalog enable row level security;
alter table public.inventory enable row level security;
alter table public.venues enable row level security;
alter table public.exchanges enable row level security;
alter table public.notifications enable row level security;
alter table public.blocks enable row level security;
alter table public.reports enable row level security;
alter table public.moderation_log enable row level security;
alter table public.push_subscriptions enable row level security;

create policy profiles_self_select on public.profiles for select using (id = auth.uid());
create policy profiles_self_insert on public.profiles for insert with check (id = auth.uid() and is_adult_confirmed);
create policy profiles_self_update on public.profiles for update using (id = auth.uid()) with check (id = auth.uid());
create policy collections_authenticated_read on public.collections for select to authenticated using (true);
create policy sticker_catalog_authenticated_read on public.sticker_catalog for select to authenticated using (true);
create policy inventory_own_all on public.inventory for all using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy venues_approved_read on public.venues for select to authenticated using (approved);
create policy exchanges_participant_read on public.exchanges for select using (auth.uid() in (proposer_id, recipient_id));
create policy notifications_own_read on public.notifications for select using (user_id = auth.uid());
create policy notifications_own_update on public.notifications for update using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy blocks_own_all on public.blocks for all using (blocker_id = auth.uid()) with check (blocker_id = auth.uid());
create policy reports_own_create on public.reports for insert with check (reporter_id = auth.uid());
create policy reports_own_read on public.reports for select using (reporter_id = auth.uid());
create policy push_own_all on public.push_subscriptions for all using (user_id = auth.uid()) with check (user_id = auth.uid());

grant execute on function public.find_matches(uuid) to authenticated;
grant execute on function public.queue_match_notifications(uuid) to authenticated;
grant execute on function public.list_my_match_notifications() to authenticated;
grant execute on function public.propose_exchange(uuid, uuid, uuid, date, text, text[], text[], text) to authenticated;
grant execute on function public.confirm_exchange(uuid, text) to authenticated;
grant execute on function public.set_exchange_status(uuid, public.exchange_status) to authenticated;
grant execute on function public.list_my_exchanges() to authenticated;
grant execute on function public.delete_my_account() to authenticated;

insert into public.collections (slug, title, edition, sticker_count, active)
values ('mondial-2026', 'Mondial 2026', 'Édition internationale', 992, true)
on conflict (slug) do nothing;

with active_collection as (
  select id from public.collections where slug = 'mondial-2026'
), official_codes as (
  select '00'::text as code, 'Collection'::text as label
  union all
  select 'FWC ' || n, 'Collection' from generate_series(1, 19) n
), country_groups(prefix, label, total) as (
  values
    ('MEX', 'Mexique', 20), ('RSA', 'Afrique du Sud', 20), ('KOR', 'Corée du Sud', 20),
    ('CZE', 'Tchéquie', 20), ('CAN', 'Canada', 20), ('BIH', 'Bosnie-Herzégovine', 20),
    ('QAT', 'Qatar', 20), ('SUI', 'Suisse', 20), ('BRA', 'Brésil', 20),
    ('MAR', 'Maroc', 20), ('HAI', 'Haïti', 20), ('SCO', 'Écosse', 20),
    ('USA', 'États-Unis', 20), ('PAR', 'Paraguay', 20), ('AUS', 'Australie', 20),
    ('TUR', 'Turquie', 20), ('GER', 'Allemagne', 20), ('CUW', 'Curaçao', 20),
    ('CIV', 'Côte d’Ivoire', 20), ('ECU', 'Équateur', 20), ('NED', 'Pays-Bas', 20),
    ('JPN', 'Japon', 20), ('SWE', 'Suède', 20), ('TUN', 'Tunisie', 20),
    ('BEL', 'Belgique', 20), ('EGY', 'Égypte', 20), ('IRN', 'Iran', 20),
    ('NZL', 'Nouvelle-Zélande', 20), ('ESP', 'Espagne', 20), ('CPV', 'Cap-Vert', 20),
    ('KSA', 'Arabie saoudite', 20), ('URU', 'Uruguay', 20), ('FRA', 'France', 20),
    ('SEN', 'Sénégal', 20), ('IRQ', 'Irak', 20), ('NOR', 'Norvège', 20),
    ('ARG', 'Argentine', 20), ('ALG', 'Algérie', 20), ('AUT', 'Autriche', 20),
    ('JOR', 'Jordanie', 20), ('POR', 'Portugal', 20), ('COD', 'RD Congo', 20),
    ('UZB', 'Ouzbékistan', 20), ('COL', 'Colombie', 20), ('ENG', 'Angleterre', 20),
    ('CRO', 'Croatie', 20), ('GHA', 'Ghana', 20), ('PAN', 'Panama', 20)
), country_codes as (
  select prefix || ' ' || n as code, prefix, label
  from country_groups cross join lateral generate_series(1, total) n
), special_codes as (
  select 'CC' || lpad(n::text, 2, '0') as code from generate_series(1, 12) n
)
insert into public.sticker_catalog(collection_id, code, group_code, country_label)
select active_collection.id, official_codes.code, 'FWC', official_codes.label from active_collection cross join official_codes
union all
select active_collection.id, country_codes.code, country_codes.prefix, country_codes.label from active_collection cross join country_codes
union all
select active_collection.id, special_codes.code, 'CC', 'Collection spéciale' from active_collection cross join special_codes
on conflict (collection_id, code) do nothing;

insert into public.venues (name, commune, public_note, approved) values
('Bibliothèque Muntpunt', 'Bruxelles-Ville', 'À l’intérieur, pendant les heures d’ouverture', false),
('Bibliothèque Sans Souci', 'Ixelles', 'Hall d’accueil, pendant les heures d’ouverture', false),
('Bibliothèque Sésame', 'Schaerbeek', 'Espace d’accueil public', false),
('Maison communale', 'Etterbeek', 'Hall public, en journée', false),
('Bibliothèque de Forest', 'Forest', 'À l’intérieur, pendant les heures d’ouverture', false),
('Bibliothèque francophone', 'Jette', 'Espace public d’accueil', false);

-- Les lieux restent invisibles tant qu'un administrateur n'a pas obtenu leur accord
-- et passé approved à true.
