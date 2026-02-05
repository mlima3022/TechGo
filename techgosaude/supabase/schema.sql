-- TechFisio - Supabase schema
-- Execute this in Supabase SQL Editor

create extension if not exists "pgcrypto";

create table if not exists public.profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  clinic_name text,
  phone text,
  city text,
  plan text default 'free',
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists public.patients (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  full_name text not null,
  birth_date date not null,
  gender text,
  cpf text,
  phone text,
  phone_secondary text,
  email text,
  address text,
  neighborhood text,
  city text,
  state text,
  zip_code text,
  reference_point text,
  allergies text,
  medications text,
  general_notes text,
  is_active boolean default true,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists public.anamnesis (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  patient_id uuid not null references public.patients(id) on delete cascade,
  content text,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique (patient_id)
);

create table if not exists public.evolutions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  patient_id uuid not null references public.patients(id) on delete cascade,
  date date not null,
  procedures text not null,
  results text not null,
  created_at timestamptz default now()
);

create table if not exists public.exams (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  patient_id uuid not null references public.patients(id) on delete cascade,
  file_name text not null,
  file_path text not null,
  file_type text,
  file_size bigint,
  uploaded_at timestamptz default now()
);

create table if not exists public.schedule (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  patient_id uuid references public.patients(id) on delete set null,
  patient_name text,
  title text not null,
  start_datetime timestamptz not null,
  end_datetime timestamptz not null,
  status text not null,
  description text,
  color text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists public.financial (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  description text not null,
  category text not null,
  transaction_type text not null,
  amount numeric(12,2) not null,
  transaction_date date not null,
  payment_status text not null,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index if not exists patients_user_id_idx on public.patients(user_id);
create index if not exists schedule_user_id_idx on public.schedule(user_id);
create index if not exists financial_user_id_idx on public.financial(user_id);
create index if not exists evolutions_user_id_idx on public.evolutions(user_id);
create index if not exists exams_user_id_idx on public.exams(user_id);
create index if not exists anamnesis_user_id_idx on public.anamnesis(user_id);
