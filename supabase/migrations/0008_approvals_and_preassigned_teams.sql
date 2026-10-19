-- Approvers, member edit requests, and team places for people who haven't signed in yet.

-- Approvers can approve other admins' member edits and appoint other approvers.
-- Nobody is an approver at first. Make yourself one by running, with your SNU mail ID:
--   update public.profiles set approver = true where email = 'you@snu.edu.in';
alter table public.profiles add column if not exists approver boolean not null default false;

-- Team places for roster entries that haven't signed in yet; moved into group_members on first sign-in.
-- `on update cascade` keeps them when a member's SNU mail ID is changed.
create table if not exists public.roster_groups (
  email    text not null references public.roster (email) on delete cascade on update cascade,
  group_id uuid not null references public.groups (id) on delete cascade,
  primary key (email, group_id)
);
create index if not exists roster_groups_group_idx on public.roster_groups (group_id);

create table if not exists public.member_edits (
  id           uuid primary key default gen_random_uuid(),
  target_email text not null,
  changes      jsonb not null,
  requested_by uuid references public.profiles (id) on delete set null,
  status       text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  reviewed_by  uuid references public.profiles (id) on delete set null,
  created_at   timestamptz not null default now()
);
create index if not exists member_edits_status_idx on public.member_edits (status, created_at desc);

-- Server-only, like every other table: RLS on with no policies.
alter table public.roster_groups enable row level security;
alter table public.member_edits  enable row level security;
