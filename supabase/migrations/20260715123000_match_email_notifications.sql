alter table public.profiles
  add column if not exists email_match_notifications boolean not null default true;

alter table public.notifications
  drop constraint if exists notifications_kind_check;

alter table public.notifications
  add constraint notifications_kind_check
  check (kind = any (array['proposal','confirmed','cancelled','reminder','moderation','match']));

alter table public.notifications
  add column if not exists match_user_id uuid references public.profiles(id) on delete cascade,
  add column if not exists match_gives text[],
  add column if not exists match_receives text[],
  add column if not exists emailed_at timestamptz,
  add column if not exists email_error text;

create unique index if not exists notifications_unique_match_email
  on public.notifications (user_id, match_user_id, kind)
  where kind = 'match';

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

grant execute on function public.queue_match_notifications(uuid) to authenticated;
