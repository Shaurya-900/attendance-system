-- Indexes for the lookups the app makes on every page and check-in.
-- Safe to run more than once.
create index if not exists attendance_user_idx         on public.attendance (user_id);
create index if not exists attendance_status_idx       on public.attendance (status, meeting_id);
create index if not exists excuses_user_idx            on public.excuses (user_id);
create index if not exists excuses_status_idx          on public.excuses (status);
create index if not exists meetings_starts_at_idx      on public.meetings (starts_at desc);
create index if not exists meetings_group_idx          on public.meetings (group_id);
create index if not exists strike_adjustments_user_idx on public.strike_adjustments (user_id);
create index if not exists strike_adjustments_group_idx on public.strike_adjustments (group_id);
create index if not exists audit_log_created_at_idx    on public.audit_log (created_at desc);
