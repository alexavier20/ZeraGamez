begin;

alter table public.user_hypes
  alter column release_date drop not null;

commit;
