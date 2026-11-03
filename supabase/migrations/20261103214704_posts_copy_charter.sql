-- A Reel she copies is faithful to it by default (its font, its colours, its texts, its length, its pace, its ending);
-- her charter dresses it only when she asks for it (« avec mes couleurs », « à ma charte »), read when the montage starts.
alter table public.posts add column if not exists copy_charter boolean not null default false;
comment on column public.posts.copy_charter is 'She asked for her charter (her fonts and colours) on the Reel she copies: the copy is dressed in it instead of the model''s look.';
