-- Group types: team, core, leads (sub-core) and event teams.
alter table public.groups drop constraint if exists groups_kind_check;
update public.groups set kind = 'core' where kind = 'committee';
alter table public.groups add constraint groups_kind_check check (kind in ('team', 'core', 'leads', 'event'));
