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

grant execute on function public.list_my_match_notifications() to authenticated;
