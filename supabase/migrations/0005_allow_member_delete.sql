-- Let an admin who made strike adjustments be deleted later (the adjustment stays, unattributed).
alter table public.strike_adjustments alter column created_by drop not null;
alter table public.strike_adjustments drop constraint if exists strike_adjustments_created_by_fkey;
alter table public.strike_adjustments add constraint strike_adjustments_created_by_fkey
  foreign key (created_by) references public.profiles (id) on delete set null;
