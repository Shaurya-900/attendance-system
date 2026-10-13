-- Groups: teams, leads and temporary event teams. Each group has its own meetings and its own
-- 3-strike count; full-body meetings (group_id null) keep theirs.

create table public.groups (
  id         uuid primary key default gen_random_uuid(),
  name       text not null,
  kind       text not null default 'team' check (kind in ('team', 'leads', 'event')),
  ends_on    date,
  archived   boolean not null default false,
  created_at timestamptz not null default now()
);

create table public.group_members (
  group_id uuid not null references public.groups (id) on delete cascade,
  user_id  uuid not null references public.profiles (id) on delete cascade,
  role     text not null default 'member' check (role in ('member', 'lead')),
  added_at timestamptz not null default now(),
  primary key (group_id, user_id)
);
create index group_members_user_idx on public.group_members (user_id);

alter table public.meetings add column if not exists group_id uuid references public.groups (id) on delete set null;
alter table public.strike_adjustments add column if not exists group_id uuid references public.groups (id) on delete set null;

alter table public.groups        enable row level security;
alter table public.group_members enable row level security;

create policy "own memberships" on public.group_members for select using (user_id = auth.uid());
create policy "own groups" on public.groups for select using (
  exists (select 1 from public.group_members gm where gm.group_id = id and gm.user_id = auth.uid())
);
