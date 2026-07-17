create function private.clear_promoted_idea_schedule()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if new.linked_adventure_id is not null then
    new.proposed_start_date := null;
    new.proposed_start_time := null;
    new.proposed_end_date := null;
    new.proposed_end_time := null;
  end if;
  return new;
end;
$$;

revoke execute on function private.clear_promoted_idea_schedule()
  from public, anon, authenticated;

create trigger clear_promoted_idea_schedule_before_link
before update of linked_adventure_id on public.ideas
for each row
when (new.linked_adventure_id is not null)
execute function private.clear_promoted_idea_schedule();
