-- What the business is (« studio de Pilates », « salon de coiffure », « restaurant »…):
-- Fauve adapts her vocabulary, ideas and montages to it.
alter table public.studios add column business_type text check (char_length(business_type) <= 80);
update public.studios set business_type = 'studio de Pilates' where name = 'Indar' and business_type is null;
