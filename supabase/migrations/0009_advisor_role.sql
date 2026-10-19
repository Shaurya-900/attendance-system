-- Advisors sign in but have no attendance requirement: never expected at meetings, no strikes.
-- The role is only set here in the database, never from the app. To make someone an advisor:
--   update public.roster   set role = 'advisor' where email = 'advisor@snu.edu.in';
--   update public.profiles set role = 'advisor' where email = 'advisor@snu.edu.in';
-- (Add them to the roster first, e.g. with the Members page import.)
alter table public.roster   drop constraint if exists roster_role_check;
alter table public.roster   add constraint roster_role_check check (role in ('member', 'admin', 'advisor'));
alter table public.profiles drop constraint if exists profiles_role_check;
alter table public.profiles add constraint profiles_role_check check (role in ('member', 'admin', 'advisor'));
