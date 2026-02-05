-- TechFisio - RLS policies

alter table public.profiles enable row level security;
alter table public.patients enable row level security;
alter table public.anamnesis enable row level security;
alter table public.evolutions enable row level security;
alter table public.exams enable row level security;
alter table public.schedule enable row level security;
alter table public.financial enable row level security;

-- profiles
Drop policy if exists profiles_select on public.profiles;
create policy profiles_select on public.profiles
  for select using (auth.uid() = user_id);
Drop policy if exists profiles_insert on public.profiles;
create policy profiles_insert on public.profiles
  for insert with check (auth.uid() = user_id);
Drop policy if exists profiles_update on public.profiles;
create policy profiles_update on public.profiles
  for update using (auth.uid() = user_id);

-- patients
Drop policy if exists patients_select on public.patients;
create policy patients_select on public.patients
  for select using (auth.uid() = user_id);
Drop policy if exists patients_insert on public.patients;
create policy patients_insert on public.patients
  for insert with check (auth.uid() = user_id);
Drop policy if exists patients_update on public.patients;
create policy patients_update on public.patients
  for update using (auth.uid() = user_id);
Drop policy if exists patients_delete on public.patients;
create policy patients_delete on public.patients
  for delete using (auth.uid() = user_id);

-- anamnesis
Drop policy if exists anamnesis_select on public.anamnesis;
create policy anamnesis_select on public.anamnesis
  for select using (auth.uid() = user_id);
Drop policy if exists anamnesis_insert on public.anamnesis;
create policy anamnesis_insert on public.anamnesis
  for insert with check (auth.uid() = user_id);
Drop policy if exists anamnesis_update on public.anamnesis;
create policy anamnesis_update on public.anamnesis
  for update using (auth.uid() = user_id);
Drop policy if exists anamnesis_delete on public.anamnesis;
create policy anamnesis_delete on public.anamnesis
  for delete using (auth.uid() = user_id);

-- evolutions
Drop policy if exists evolutions_select on public.evolutions;
create policy evolutions_select on public.evolutions
  for select using (auth.uid() = user_id);
Drop policy if exists evolutions_insert on public.evolutions;
create policy evolutions_insert on public.evolutions
  for insert with check (auth.uid() = user_id);
Drop policy if exists evolutions_update on public.evolutions;
create policy evolutions_update on public.evolutions
  for update using (auth.uid() = user_id);
Drop policy if exists evolutions_delete on public.evolutions;
create policy evolutions_delete on public.evolutions
  for delete using (auth.uid() = user_id);

-- exams
Drop policy if exists exams_select on public.exams;
create policy exams_select on public.exams
  for select using (auth.uid() = user_id);
Drop policy if exists exams_insert on public.exams;
create policy exams_insert on public.exams
  for insert with check (auth.uid() = user_id);
Drop policy if exists exams_update on public.exams;
create policy exams_update on public.exams
  for update using (auth.uid() = user_id);
Drop policy if exists exams_delete on public.exams;
create policy exams_delete on public.exams
  for delete using (auth.uid() = user_id);

-- schedule
Drop policy if exists schedule_select on public.schedule;
create policy schedule_select on public.schedule
  for select using (auth.uid() = user_id);
Drop policy if exists schedule_insert on public.schedule;
create policy schedule_insert on public.schedule
  for insert with check (auth.uid() = user_id);
Drop policy if exists schedule_update on public.schedule;
create policy schedule_update on public.schedule
  for update using (auth.uid() = user_id);
Drop policy if exists schedule_delete on public.schedule;
create policy schedule_delete on public.schedule
  for delete using (auth.uid() = user_id);

-- financial
Drop policy if exists financial_select on public.financial;
create policy financial_select on public.financial
  for select using (auth.uid() = user_id);
Drop policy if exists financial_insert on public.financial;
create policy financial_insert on public.financial
  for insert with check (auth.uid() = user_id);
Drop policy if exists financial_update on public.financial;
create policy financial_update on public.financial
  for update using (auth.uid() = user_id);
Drop policy if exists financial_delete on public.financial;
create policy financial_delete on public.financial
  for delete using (auth.uid() = user_id);
