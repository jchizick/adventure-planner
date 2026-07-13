alter table public.ideas
  add column if not exists is_date_night boolean not null default false;

update public.ideas
set
  is_date_night = true,
  category = 'culture'
where lower(btrim(category)) in ('dates', 'date night', 'date-night');

update public.ideas
set category = case
  when lower(btrim(category)) in ('food', 'food & drink', 'food and drink') then 'food-drink'
  when lower(btrim(category)) in ('concert', 'concerts', 'festivals', 'music & events', 'music and events') then 'music-events'
  when lower(btrim(category)) = 'outdoors' then 'outdoors'
  when lower(btrim(category)) = 'culture' then 'culture'
  when lower(btrim(category)) in ('at home', 'at-home', 'errands') then 'at-home'
  when lower(btrim(category)) in ('camping & travel', 'camping and travel', 'travel', 'trips', 'trips & getaways', 'trips and getaways') then 'trips-getaways'
  else 'culture'
end
where category not in (
  'food-drink',
  'music-events',
  'outdoors',
  'culture',
  'at-home',
  'trips-getaways'
);

update public.ideas
set category = 'music-events'
where lower(title) like '%ford%concert%'
   or lower(title) like '%the fray%';
