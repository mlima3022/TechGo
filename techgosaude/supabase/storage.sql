-- TechFisio - Storage policies for bucket exams
-- Ensure the bucket "exams" exists (private) before running policies.

Drop policy if exists "exams_select" on storage.objects;
create policy "exams_select" on storage.objects
  for select using (bucket_id = 'exams' and auth.uid() = owner);

Drop policy if exists "exams_insert" on storage.objects;
create policy "exams_insert" on storage.objects
  for insert with check (bucket_id = 'exams' and auth.uid() = owner);

Drop policy if exists "exams_update" on storage.objects;
create policy "exams_update" on storage.objects
  for update using (bucket_id = 'exams' and auth.uid() = owner);

Drop policy if exists "exams_delete" on storage.objects;
create policy "exams_delete" on storage.objects
  for delete using (bucket_id = 'exams' and auth.uid() = owner);
