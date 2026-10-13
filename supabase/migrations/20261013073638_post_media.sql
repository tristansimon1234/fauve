-- Photos and videos of a post that is not a montage: the image of a photo post,
-- the 2 to 10 items of a carousel (in order), the image or video of a story.
alter table public.posts
  add column media_ids uuid[] not null default '{}';
