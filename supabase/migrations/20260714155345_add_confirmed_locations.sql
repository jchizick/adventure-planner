alter table public.adventures
  add column location_provider text,
  add column location_provider_id text,
  add column location_address jsonb,
  add column location_source jsonb,
  add column location_confirmed_at timestamptz;

alter table public.adventures
  add constraint adventures_location_address_object_check
    check (
      location_address is null
      or jsonb_typeof(location_address) = 'object'
    ),
  add constraint adventures_location_source_object_check
    check (
      location_source is null
      or jsonb_typeof(location_source) = 'object'
    ),
  add constraint adventures_confirmed_location_complete_check
    check (
      location_confirmed_at is null
      or (
        nullif(btrim(location), '') is not null
        and latitude is not null
        and longitude is not null
        and nullif(btrim(location_provider), '') is not null
        and nullif(btrim(location_provider_id), '') is not null
        and nullif(btrim(geocoded_location), '') is not null
        and location_address is not null
        and jsonb_typeof(location_address) = 'object'
        and location_address <> '{}'::jsonb
        and location_source is not null
        and jsonb_typeof(location_source) = 'object'
        and nullif(btrim(location_source ->> 'name'), '') is not null
        and nullif(btrim(location_source ->> 'attribution'), '') is not null
      )
    );

alter table public.adventure_stops
  add column latitude double precision,
  add column longitude double precision,
  add column timezone text,
  add column geocoded_location text,
  add column location_provider text,
  add column location_provider_id text,
  add column location_address jsonb,
  add column location_source jsonb,
  add column location_confirmed_at timestamptz;

alter table public.adventure_stops
  add constraint adventure_stops_latitude_check
    check (latitude is null or latitude between -90 and 90),
  add constraint adventure_stops_longitude_check
    check (longitude is null or longitude between -180 and 180),
  add constraint adventure_stops_coordinates_pair_check
    check ((latitude is null) = (longitude is null)),
  add constraint adventure_stops_location_address_object_check
    check (
      location_address is null
      or jsonb_typeof(location_address) = 'object'
    ),
  add constraint adventure_stops_location_source_object_check
    check (
      location_source is null
      or jsonb_typeof(location_source) = 'object'
    ),
  add constraint adventure_stops_confirmed_location_complete_check
    check (
      location_confirmed_at is null
      or (
        nullif(btrim(location), '') is not null
        and latitude is not null
        and longitude is not null
        and nullif(btrim(location_provider), '') is not null
        and nullif(btrim(location_provider_id), '') is not null
        and nullif(btrim(geocoded_location), '') is not null
        and location_address is not null
        and jsonb_typeof(location_address) = 'object'
        and location_address <> '{}'::jsonb
        and location_source is not null
        and jsonb_typeof(location_source) = 'object'
        and nullif(btrim(location_source ->> 'name'), '') is not null
        and nullif(btrim(location_source ->> 'attribution'), '') is not null
      )
    );
