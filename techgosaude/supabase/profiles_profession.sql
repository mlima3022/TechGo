-- Add profession to profiles
alter table public.profiles
  add column if not exists profession text;
