alter table public.ideas
  add column cover_preset_id text;

alter table public.ideas
  add constraint ideas_cover_preset_id_nonempty
  check (
    cover_preset_id is null
    or nullif(btrim(cover_preset_id), '') is not null
  );
