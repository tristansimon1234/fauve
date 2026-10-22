-- No more automatic review by default (Tristan: « vaut mieux faire relire par l'humain directement »):
-- montages go out as soon as they are rendered; Soigné and Max stay to pick in Réglages.
alter table public.studios alter column montage_effort set default 'rapide';
update public.studios set montage_effort = 'rapide' where montage_effort = 'soigne';
