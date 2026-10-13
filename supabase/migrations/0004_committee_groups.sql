-- Allow "committee" groups (e.g. core committee, sub-core committee).
alter table public.groups drop constraint if exists groups_kind_check;
alter table public.groups add constraint groups_kind_check check (kind in ('team', 'committee', 'leads', 'event'));
