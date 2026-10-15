-- Delete a group or a member in a single transaction, so a failure part-way can't leave
-- half-deleted data behind. Only the server (service role) may call these.

create or replace function public.delete_group(gid uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  -- Meetings would otherwise fall back to "full body"; their attendance and excuses cascade.
  delete from public.meetings where group_id = gid;
  delete from public.strike_adjustments where group_id = gid;
  delete from public.groups where id = gid;
end $$;

create or replace function public.delete_member(uid uuid) returns void
language plpgsql security definer set search_path = public as $$
declare
  member_email text;
begin
  select email into member_email from public.profiles where id = uid;
  -- Removing the login cascades to the profile and everything that references it.
  delete from auth.users where id = uid;
  delete from public.profiles where id = uid;
  if member_email is not null then
    delete from public.roster where email = member_email;
  end if;
end $$;

revoke all on function public.delete_group(uuid) from public, anon, authenticated;
revoke all on function public.delete_member(uuid) from public, anon, authenticated;
grant execute on function public.delete_group(uuid) to service_role;
grant execute on function public.delete_member(uuid) to service_role;
