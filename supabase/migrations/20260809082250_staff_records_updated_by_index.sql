begin;

create index if not exists staff_records_updated_by_idx
  on public.staff_records (updated_by);

commit;
