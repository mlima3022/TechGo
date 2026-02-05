-- Storage policies for bucket documents
-- Ensure the bucket "documents" exists (private) before running policies.

drop policy if exists "documents_select" on storage.objects;
create policy "documents_select" on storage.objects
  for select using (bucket_id = 'documents' and auth.uid() = owner);

drop policy if exists "documents_insert" on storage.objects;
create policy "documents_insert" on storage.objects
  for insert with check (bucket_id = 'documents' and auth.uid() = owner);

drop policy if exists "documents_update" on storage.objects;
create policy "documents_update" on storage.objects
  for update using (bucket_id = 'documents' and auth.uid() = owner);

drop policy if exists "documents_delete" on storage.objects;
create policy "documents_delete" on storage.objects
  for delete using (bucket_id = 'documents' and auth.uid() = owner);
