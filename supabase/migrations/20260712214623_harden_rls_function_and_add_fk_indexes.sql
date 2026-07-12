revoke execute on function public.rls_auto_enable()
from public, anon, authenticated;

create index if not exists adventures_created_by_idx
  on public.adventures(created_by);

create index if not exists adventures_updated_by_idx
  on public.adventures(updated_by);

create index if not exists checklist_items_created_by_idx
  on public.checklist_items(created_by);

create index if not exists ideas_linked_adventure_id_idx
  on public.ideas(linked_adventure_id);

create index if not exists spaces_created_by_idx
  on public.spaces(created_by);
