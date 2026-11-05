create table public.game_reviews (
 user_id uuid not null references auth.users(id) on delete cascade,
 igdb_id bigint not null check (igdb_id > 0),
 name text not null check (length(name) between 1 and 200),
 cover_url text,
 score numeric not null check (score between 0 and 10),
 analysis text not null check (length(trim(analysis)) between 1 and 10000),
 updated_at timestamptz not null default now(),
 primary key (user_id, igdb_id)
);
create index game_reviews_game_idx on public.game_reviews (igdb_id);
alter table public.game_reviews enable row level security;
revoke all on public.game_reviews from anon, authenticated;
grant select, insert, update, delete on public.game_reviews to authenticated;
create policy reviews_read on public.game_reviews for select to authenticated using (true);
create policy reviews_insert on public.game_reviews for insert to authenticated with check ((select auth.uid()) = user_id);
create policy reviews_update on public.game_reviews for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy reviews_delete on public.game_reviews for delete to authenticated using ((select auth.uid()) = user_id);
