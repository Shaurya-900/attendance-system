-- E-Cell attendance schema.
-- The app talks to these tables only from the server with the service-role key.
-- RLS is still enabled so the anon/authenticated keys can never read or write other members' data.

create extension if not exists pgcrypto;

create table public.roster (
  email   text primary key check (email = lower(email)),
  name    text not null,
  roll_no text,
  role    text not null default 'member' check (role in ('member', 'admin'))
);

create table public.profiles (
  id         uuid primary key references auth.users (id) on delete cascade,
  email      text not null unique,
  name       text not null,
  roll_no    text,
  role       text not null default 'member' check (role in ('member', 'admin')),
  active     boolean not null default true,
  created_at timestamptz not null default now()
);

-- One passkey per member. Re-registration requires an admin reset (row delete).
create table public.passkeys (
  user_id       uuid primary key references public.profiles (id) on delete cascade,
  credential_id text not null unique,
  public_key    text not null,
  counter       bigint not null default 0,
  transports    text[] not null default '{}',
  device_id     text not null,
  created_at    timestamptz not null default now()
);
create index passkeys_device_idx on public.passkeys (device_id);

create table public.semesters (
  id        uuid primary key default gen_random_uuid(),
  name      text not null,
  starts_on date not null,
  ends_on   date not null check (ends_on >= starts_on)
);

create table public.meetings (
  id            uuid primary key default gen_random_uuid(),
  title         text not null,
  starts_at     timestamptz not null,
  grace_minutes int not null default 10 check (grace_minutes >= 0),
  status        text not null default 'scheduled' check (status in ('scheduled', 'live', 'closed')),
  qr_secret     text not null default encode(gen_random_bytes(32), 'hex'),
  created_by    uuid references public.profiles (id) on delete set null,
  created_at    timestamptz not null default now()
);

create table public.attendance (
  meeting_id    uuid not null references public.meetings (id) on delete cascade,
  user_id       uuid not null references public.profiles (id) on delete cascade,
  status        text not null check (status in ('present', 'late', 'absent', 'excused')),
  checked_in_at timestamptz,
  credential_id text,
  device_id     text,
  source        text not null check (source in ('qr', 'manual')),
  flags         text[] not null default '{}',
  primary key (meeting_id, user_id)
);
-- One phone can check in only one member per meeting.
create unique index attendance_meeting_device_uniq on public.attendance (meeting_id, device_id) where source = 'qr';

create table public.excuses (
  id          uuid primary key default gen_random_uuid(),
  meeting_id  uuid not null references public.meetings (id) on delete cascade,
  user_id     uuid not null references public.profiles (id) on delete cascade,
  reason      text not null,
  status      text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  reviewed_by uuid references public.profiles (id) on delete set null,
  created_at  timestamptz not null default now(),
  unique (meeting_id, user_id)
);

create table public.strike_adjustments (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references public.profiles (id) on delete cascade,
  semester_id uuid references public.semesters (id) on delete set null,
  points      numeric(4, 1) not null,
  reason      text not null,
  created_by  uuid not null references public.profiles (id),
  created_at  timestamptz not null default now()
);

create table public.audit_log (
  id         uuid primary key default gen_random_uuid(),
  actor_id   uuid references public.profiles (id) on delete set null,
  action     text not null,
  target     text,
  details    jsonb not null default '{}',
  created_at timestamptz not null default now()
);

-- Row level security: members may read their own rows; nothing else through the public keys.
alter table public.roster             enable row level security;
alter table public.profiles           enable row level security;
alter table public.passkeys           enable row level security;
alter table public.semesters          enable row level security;
alter table public.meetings           enable row level security;
alter table public.attendance         enable row level security;
alter table public.excuses            enable row level security;
alter table public.strike_adjustments enable row level security;
alter table public.audit_log          enable row level security;

create policy "own profile"     on public.profiles   for select using (id = auth.uid());
create policy "own attendance"  on public.attendance for select using (user_id = auth.uid());
create policy "own excuses"     on public.excuses    for select using (user_id = auth.uid());
create policy "read semesters"  on public.semesters  for select to authenticated using (true);
