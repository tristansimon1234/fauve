-- A montage replaced by a newer request on the same Reel stops where it is (api/jobs/montage, quoteSuperseded): never delivered nor charged.
alter table public.credit_quotes drop constraint credit_quotes_stage_check;
alter table public.credit_quotes add constraint credit_quotes_stage_check
  check (stage in ('design', 'effects', 'alternative', 'render', 'review', 'fix', 'delivered', 'superseded'));
