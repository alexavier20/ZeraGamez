alter table public.game_reviews
  drop constraint if exists game_reviews_analysis_check;

alter table public.game_reviews
  alter column analysis drop not null;

alter table public.game_reviews
  add constraint game_reviews_analysis_check
  check (analysis is null or length(trim(analysis)) <= 10000);
