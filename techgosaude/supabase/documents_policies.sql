-- Documents policies
alter table public.documents enable row level security;

drop policy if exists documents_select on public.documents;
create policy documents_select on public.documents
  for select using (auth.uid() = user_id);

drop policy if exists documents_insert on public.documents;
create policy documents_insert on public.documents
  for insert with check (auth.uid() = user_id);

drop policy if exists documents_delete on public.documents;
create policy documents_delete on public.documents
  for delete using (auth.uid() = user_id);
