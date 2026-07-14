-- Normalize legacy Adventure categories without changing or deleting records.
update public.adventures
set category = case
  when lower(btrim(category)) in ('food', 'food & drink', 'food and drink', 'food-drink') then 'food-drink'
  when lower(btrim(category)) in ('concert', 'concerts', 'festivals', 'music & events', 'music and events', 'music-events') then 'music-events'
  when lower(btrim(category)) = 'outdoors' then 'outdoors'
  when lower(btrim(category)) in ('culture', 'dates', 'date night', 'date-night') then 'culture'
  when lower(btrim(category)) in ('at home', 'at-home', 'errands') then 'at-home'
  when lower(btrim(category)) in ('camping & travel', 'camping and travel', 'camping-travel', 'travel', 'trips', 'trips & getaways', 'trips and getaways', 'trips-getaways') then 'trips-getaways'
  else null
end
where category is not null;

-- A source Idea is authoritative for Adventures promoted from that Idea.
update public.adventures as adventure
set category = idea.category
from public.ideas as idea
where adventure.source_idea_id = idea.id
  and idea.category in (
    'food-drink',
    'music-events',
    'outdoors',
    'culture',
    'at-home',
    'trips-getaways'
  )
  and adventure.category is distinct from idea.category;

alter table public.adventures
  add constraint adventures_category_check
  check (
    category is null or category in (
      'food-drink',
      'music-events',
      'outdoors',
      'culture',
      'at-home',
      'trips-getaways'
    )
  ) not valid;

alter table public.adventures
  validate constraint adventures_category_check;
