-- When each person was added to the roster. Used to backfill absences for members who
-- sign in late, so not signing in can't be used to dodge strikes.
alter table public.roster add column if not exists added_at timestamptz not null default now();
