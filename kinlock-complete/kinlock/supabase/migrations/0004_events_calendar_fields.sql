-- Kinlock: Phase 2 schema additions
-- Rounds out the events table for actual calendar use, and keeps
-- updated_at accurate automatically instead of relying on the app to set it.

alter table public.events
  add column is_all_day boolean not null default false,
  add column location text,
  add column notes text;

create function public.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger events_touch_updated_at
  before update on public.events
  for each row execute procedure public.touch_updated_at();
