-- Existing reviews become private by default so this change does not expose old content.
alter table public.game_reviews
  add column is_public boolean not null default false;

drop policy if exists reviews_read on public.game_reviews;

-- Anonymous and signed-in readers may see only reviews their authors published.
revoke all on table public.game_reviews from anon;
grant select on table public.game_reviews to anon;
create policy reviews_read_public
  on public.game_reviews
  for select
  to anon, authenticated
  using (is_public);

-- Authors may still read their own private reviews.
create policy reviews_read_owner
  on public.game_reviews
  for select
  to authenticated
  using ((select auth.uid()) = user_id);

create index game_reviews_public_updated_idx
  on public.game_reviews (updated_at desc)
  where is_public = true;
