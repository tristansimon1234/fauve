-- The team is recognised by its phone numbers (app_settings « team_phones », a JSON list of E.164
-- numbers, read by the server only, never in the code): a member with one of them makes its studio
-- the team's, so a team account deleted then made again is the team's again (Tristan: « utilise mon
-- numéro pour vérif »). The numbers: those of the team's studio today.
insert into public.app_settings (key, value)
select 'team_phones', coalesce(jsonb_agg(distinct m.phone_e164), '[]'::jsonb)
from public.members m join public.studios s on s.id = m.studio_id
where s.team and m.phone_e164 is not null
on conflict (key) do nothing;

create or replace function public.team_by_phone() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if exists (select 1 from public.app_settings where key = 'team_phones' and value ? new.phone_e164) then
    -- Never at the cost of the member: written by the server (service role), the studio's
    -- protected columns accept it; from anywhere else it is only a warning.
    begin
      update public.studios set team = true where id = new.studio_id and not team;
    exception when others then
      raise warning 'team_by_phone: %', sqlerrm;
    end;
  end if;
  return new;
end;
$$;
revoke execute on function public.team_by_phone() from public, anon, authenticated;

create trigger members_team_by_phone
after insert or update of phone_e164, studio_id on public.members
for each row execute function public.team_by_phone();
