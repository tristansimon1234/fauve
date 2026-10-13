-- Level of care of a montage (Rapide / Soigné / Max): the studio's default, and per quote with the step the chain is at.
alter table public.studios
  add column montage_effort text not null default 'soigne' check (montage_effort in ('rapide', 'soigne', 'max'));

alter table public.credit_quotes
  add column effort text check (effort in ('rapide', 'soigne', 'max')),
  add column stage text check (stage in ('design', 'alternative', 'render', 'review', 'fix', 'delivered')),
  add column stage_at timestamptz;

comment on column public.studios.montage_effort is 'Default level of care for montages: rapide (one version), soigne (reviewed, corrected once), max (two versions, best kept, corrected up to twice).';
comment on column public.credit_quotes.effort is 'Level of care of the quoted montage; null for older quotes and variants (one version, no review).';
comment on column public.credit_quotes.stage is 'Where the launched montage is in the chain: design, alternative, render, review, fix, delivered.';
