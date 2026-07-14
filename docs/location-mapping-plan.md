# Real Geographic Location Mapping

## Summary

Implement explicit location selection for Adventures and itinerary stops using Geoapify candidate search and a lazily loaded MapLibre map.

Raw text remains valid, but only a user-selected candidate becomes confirmed and mappable. The map renders confirmed stops in itinerary order, fits all markers, and never infers routes or locations.

Key approved decisions:

- The purple map flag belongs only to the actual final itinerary stop.
- If that stop is unresolved, it remains purple in the list and is explicitly reported as not mapped; no earlier marker is promoted.
- MapLibre and its CSS must be loaded through a dynamic module boundary and excluded from the initial application bundle.
- Search is global unless an authorized Adventure already has saved coordinates suitable for proximity bias.
- Candidate deduplication is stable and preserves provider ranking.
- Existing automatic Adventure coordinates remain legacy weather data.
- The legacy geocoder remains available until the new frontend is deployed and verified.

## Current data flow

- Adventure and stop forms in `src/pages.tsx` accept unrestricted text.
- `AdventureProvider` in `src/context.tsx` sends drafts to repositories.
- `src/repositories/adventures.ts` automatically invokes `geocode-adventure-location` for raw Adventure text.
- That Edge Function broadens comma-separated queries and silently chooses its highest-scored candidate—the unsafe behavior that previously confused Toronto, Ontario with Ontario, California.
- Adventures already store latitude, longitude, timezone, and `geocoded_location` for weather.
- Stops store only text locations.
- Idea promotion creates an Adventure through an RPC and then performs a separate coordinate update.
- Adventure detail loads ordered stops and draws a decorative `.map-card`, dashed pseudo-route, and synthetic markers.
- Stop colors are based on itinerary position. Only the true final itinerary stop currently receives `FINAL_STOP_COLOR` and the flag in the list.
- RLS scopes Adventures through `private.is_space_member` and stops through `private.is_adventure_member`.
- Database row types are local to repositories; no generated Supabase types or test harness exists.

## Provider decision

Use:

- Geoapify Address Autocomplete for candidate search.
- Geoapify map tiles with the restrained `osm-bright-grey` style.
- MapLibre GL JS for rendering.
- Separate keys for server-side search and public browser map tiles.

Geoapify supports multiple ranked candidates, structured addresses, coordinates, timezone information, and persistent results. Map styles are compatible with MapLibre. See the [Autocomplete API](https://apidocs.geoapify.com/docs/geocoding/address-autocomplete/) and [map tile documentation](https://apidocs.geoapify.com/docs/maps/).

Alternatives:

- MapTiler with MapLibre is technically suitable, but default proxy restrictions require account-specific confirmation for the proposed Edge Function boundary. See [MapTiler terms](https://www.maptiler.com/terms/cloud/).
- Mapbox permits permanent Geocoding API storage under permanent-mode billing, but POI-capable Search Box results are not generally eligible for permanent storage. See [Mapbox search products](https://docs.mapbox.com/help/getting-started/search/).
- Google Places has tighter storage rules and requires Places results displayed on maps to use Google Maps. See [Google Places policies](https://developers.google.com/maps/documentation/places/web-service/policies).
- Public Nominatim explicitly forbids autocomplete and is unsuitable. See the [Nominatim policy](https://operations.osmfoundation.org/policies/nominatim/).

Reconfirm provider terms, quota, pricing, and attribution immediately before implementation.

## Database changes

Create an additive migration with:

```bash
npx supabase migration new add_confirmed_locations
```

### Adventure columns

Retain:

- `location`
- `latitude`
- `longitude`
- `timezone`
- `geocoded_location`

Add:

- `location_provider text`
- `location_provider_id text`
- `location_address jsonb`
- `location_source jsonb`
- `location_confirmed_at timestamptz`

`location_source` stores the selected result’s compact source information:

```json
{
  "name": "openstreetmap",
  "attribution": "© OpenStreetMap contributors",
  "license": "Open Database License",
  "url": "https://www.openstreetmap.org/copyright"
}
```

This is required because Geoapify states that persisted address results must retain their included data-source attribution, and the source can differ by result. Provider-level map attribution remains rendered separately.

### Stop columns

Add the same normalized metadata plus:

- `latitude double precision`
- `longitude double precision`
- `timezone text`
- `geocoded_location text`
- `location_provider text`
- `location_provider_id text`
- `location_address jsonb`
- `location_source jsonb`
- `location_confirmed_at timestamptz`

### Constraints

Keep constraints narrow and durable:

- Latitude must be between -90 and 90.
- Longitude must be between -180 and 180.
- Latitude and longitude must be present or absent together.
- `location_address` and `location_source`, when present, must be JSON objects.
- A row with `location_confirmed_at` must have a non-empty text location, coordinate pair, non-empty provider and provider ID, non-empty normalized formatted address, structured address object, and source-attribution object.

Do not add brittle constraints requiring every metadata column to be null whenever a row is unconfirmed. Repository payload builders are responsible for clearing stale provider fields when converting a location to text-only.

Existing Adventure coordinates remain legal without confirmation metadata so production-like legacy rows are preserved.

### RPCs

- Add `promote_idea_to_adventure_v2` with explicit normalized-location parameters so creation and Idea linkage remain atomic.
- Keep the original promotion RPC during rollout compatibility.
- Replace the existing `duplicate_adventure(uuid)` body without changing its signature; copy all new Adventure and stop location fields.
- Preserve current authentication, membership checks, empty `search_path`, RLS behavior, and revoked `PUBLIC`/`anon` execution.
- Review authenticated grants after adding columns; do not weaken row policies.

The RPC work is part of the later persistence phase, not Phase 1.

## TypeScript model

Add provider-independent shared types in `src/types.ts`:

```ts
type NormalizedAddress = {
  name?: string;
  addressLine1?: string;
  addressLine2?: string;
  city?: string;
  county?: string;
  region?: string;
  regionCode?: string;
  postcode?: string;
  country?: string;
  countryCode?: string;
};

type LocationSource = {
  name: string;
  attribution: string;
  license?: string;
  url?: string;
};

type LocationCandidate = {
  provider: "geoapify";
  providerPlaceId: string;
  label: string;
  formattedAddress: string;
  address: NormalizedAddress;
  source: LocationSource;
  latitude: number;
  longitude: number;
  timezone?: string;
};

type SavedLocation =
  | { kind: "none"; label: "" }
  | { kind: "text"; label: string }
  | {
      kind: "legacy";
      label: string;
      latitude: number;
      longitude: number;
      timezone?: string;
      formattedAddress?: string;
    }
  | {
      kind: "confirmed";
      label: string;
      candidate: LocationCandidate;
      confirmedAt: string;
    };

type LocationDraft = {
  label: string;
  intent: "preserve" | "selected" | "text-only" | "clear";
  candidate?: LocationCandidate;
};
```

Use `SavedLocation` on Adventure and stop domain models and `LocationDraft` in form payloads during the later persistence/form phases.

Repository mapping rules:

- Complete provider metadata plus confirmation timestamp → `confirmed`.
- Adventure coordinate pair without confirmation → `legacy`.
- Non-empty label without confirmed metadata → `text`.
- Empty label → `none`.

Do not introduce generated Supabase types in this feature. Update repository-local row types and select-column constants together when persistence integration begins.

## Candidate search

Add an authenticated `search-locations` Edge Function in Phase 2.

Request:

```ts
{
  spaceId: string;
  query: string;
  adventureId?: string;
}
```

Response:

```ts
{
  candidates: LocationCandidate[];
}
```

Behavior:

- Require POST and validate the JWT with `auth.getUser()`.
- Verify space or Adventure membership through a caller-scoped Supabase client and existing RLS.
- Require a trimmed query of 3–200 characters.
- Make one Geoapify autocomplete request with a maximum of six candidates.
- Never split, shorten, retry broader fragments, fabricate coordinates, or choose a candidate.
- Search globally when no authorized Adventure coordinates are available.
- Do not hard-code Toronto, Ontario, Canada, or another geographic restriction.
- When `adventureId` is supplied, load coordinates from that authorized database row and use them only as a proximity bias.
- Never accept client-supplied bias coordinates when the Adventure can be loaded by ID.
- Normalize candidates in provider order.
- Deduplicate stably by `providerPlaceId`, keeping the first occurrence and rejecting results without a usable ID.
- Do not sort by client-computed score, label, distance, or coordinates.
- Return an empty array for no results.
- Never auto-select or write a candidate.
- Reject invalid coordinates and malformed normalized/source data.
- Keep provider failures recoverable and avoid logging raw location queries or secrets.

## Form behavior

Create a shared accessible `LocationSearchField` in a later phase.

- Debounce by approximately 300 ms after three characters.
- Cancel or ignore stale requests.
- Implement keyboard-operable combobox/listbox semantics.
- Display provider-ranked candidates without local reordering.
- Only an explicit result click or keyboard selection sets `intent: "selected"`.
- Editing text after selection clears the candidate and changes the intent to text-only.
- Permit text-only submission with a visible warning that it will not appear on the map or enable new weather coordinates.
- Preserve existing confirmed or legacy metadata during unrelated edits using `intent: "preserve"`.
- Changing the label without selecting a replacement clears coordinates, timezone, formatted address, provider fields, structured address, source data, and confirmation timestamp in the repository payload.
- Clearing the input clears all geographic metadata.
- Idea-provided location text begins unresolved and is never auto-selected.
- A candidate without timezone remains selectable; weather reports its existing missing-timezone state.

## Map implementation

Add `AdventureStopsMap` in a dedicated module with no static imports from the initial application graph.

### Mandatory lazy-loading boundary

- Install a pinned `maplibre-gl` version using npm and commit the lockfile.
- Load the map module with `React.lazy(() => import(...))` and render it through `Suspense`.
- Import `maplibre-gl` and `maplibre-gl.css` only inside the lazy map module.
- Do not import MapLibre types or runtime exports from eagerly loaded modules.
- Keep bounds and marker preparation in provider-neutral helpers where appropriate.
- Verify the Vite manifest/build output shows MapLibre and its CSS in a separate async chunk, absent from the initial entry chunk.
- Load the chunk only when the Itinerary tab is active and at least one confirmed stop can be mapped.

### Marker semantics

- Sort all stops by persisted itinerary order.
- A stop is mappable only with confirmed metadata and valid coordinates.
- Keep marker numbers and positional colors tied to the full-itinerary index.
- The purple flag is reserved exclusively for `orderedStops[orderedStops.length - 1]`.
- Render the purple flag on the map only if that actual final stop is confirmed.
- Never promote an earlier resolved marker to the purple final treatment.
- If the actual final stop is unresolved, keep its purple flag in the list, show “Final stop not mapped—select a location,” and render preceding markers normally.
- Refactor the marker primitive to accept explicit `displayIndex` and `isActualFinalStop` inputs.

### Map behavior

- Fit all confirmed-marker coordinates after load and whenever confirmed stops or order changes.
- For one marker, center with a capped neighborhood zoom.
- For multiple markers, use padded bounds and a maximum zoom.
- Handle duplicate coordinates through MapLibre bounds primitives.
- Disable camera animation under `prefers-reduced-motion`.
- Draw no route line, GeoJSON path, directions result, or inferred ordering.
- Keep provider and source-map attribution visible.
- Reserve map height during lazy loading and keep failures non-blocking.

## Security and privacy

- Search requires Supabase authentication and membership.
- Use the caller’s JWT for authorization; do not use service-role credentials for membership checks.
- Keep `GEOAPIFY_GEOCODING_KEY` server-only.
- Use a separate public `VITE_GEOAPIFY_MAP_KEY` for tiles and restrict it to known origins when hosting exists.
- Validate coordinate ranges in Edge Function normalization and database constraints.
- Weather continues loading coordinates from the authorized Adventure row.
- Do not persist query caches or log raw queries.
- Persist only selected result data, including required source attribution.
- Keep external provider failures isolated from unrelated planning features.

## Backward compatibility and rollout

- The migration is additive and does not backfill or mutate existing rows.
- Existing stop locations remain text-only.
- Existing Adventure coordinates remain legacy data and continue powering weather.
- Selecting a result replaces legacy metadata with confirmed metadata.
- Unrelated edits preserve legacy data.
- Editing a location without selecting a replacement converts it to text-only and clears stale geographic metadata.
- Duplicated Adventures eventually copy confirmed or legacy location state exactly.
- No production rows or storage objects are manually altered.

Deployment order:

1. Apply the reviewed additive migration.
2. Configure Geoapify secrets and deploy `search-locations`.
3. Deploy the new frontend with explicit-selection behavior.
4. Verify Adventure/stop saving, weather compatibility, and the lazy map.
5. Only after verification, deprecate `geocode-adventure-location`.
6. If stale clients must be blocked, return a non-2xx explicit `deprecated_client` error rather than a silent null/no-match response.

Do not disable or remove the legacy function before the replacement frontend is deployed and verified.

## Environment and documentation

Later phases update `.env.example`, `src/vite-env.d.ts`, `README.md`, `package.json`, and the npm lockfile for provider/map configuration. No server key may appear in a `VITE_` variable.

## Test plan

Add a minimal Vitest harness and documented `npm test` script in Phase 1.

Unit coverage:

- Provider-response validation and normalization.
- Stable candidate deduplication preserving provider order.
- Ambiguous results are never auto-selected.
- Location draft transitions: preserve, selected, edited-to-text, and clear.
- Text-only payloads clear all stale provider metadata.
- Row mapping distinguishes none, text, legacy, and confirmed states.
- Stop filtering preserves full itinerary positions.
- Only the actual final itinerary stop can receive the purple map flag.
- Single, multiple, repeated, and widely separated coordinates produce valid bounds.

Database verification in a local or isolated environment:

- Coordinate-pair and range constraints.
- Confirmed-record completeness.
- Valid legacy Adventure coordinates without confirmation.
- Text-only records with cleared provider metadata.
- Atomic Idea promotion and duplicate copying after their later-phase implementation.
- Member, non-member, and unauthenticated permission paths.

Required checks:

```bash
npm test
npm run typecheck
npm run lint
npm run build
git diff --check
```

Before any linked database action:

```bash
npx supabase migration list --linked
npx supabase db push --linked --dry-run
```

Do not push or deploy until the project identity, migration plan, preserved rows, provider configuration, and rollout sequence are reviewed.

## Implementation phases

1. Add the migration, domain types, pure repository mapping/payload helpers, and Vitest harness.
2. Implement authenticated global candidate search with stable deduplication.
3. Update Adventure, stop, promotion, duplication, and weather-compatible persistence.
4. Add the accessible shared location selector.
5. Add the mandatory lazy MapLibre module and corrected final-stop semantics.
6. Complete automated, RLS, responsive, accessibility, attribution, and bundle-splitting verification.
7. Deploy in the documented order and deprecate the legacy geocoder only after the new frontend is verified.

## Risks and deferred scope

- Preserved legacy Adventure coordinates may already be incorrect; explicit reselection is required to confirm them.
- Provider coverage, timezone data, quotas, and terms can change.
- Per-result source attribution increases stored metadata but is required for persisted results.
- Final origin restrictions cannot be configured until hosting origins are known.
- MapLibre adds a sizeable WebGL dependency; the lazy boundary and build-manifest check are mandatory.
- Location queries are third-party-processed personal data and require privacy acceptance.
- Routing, directions, route optimization, pin placement, reverse geocoding, automatic backfill, and an Adventure-level marker are deferred.
