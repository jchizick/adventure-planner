# Our Adventures

Mobile-first shared adventure planner prototype for Jordan and Liz.

## Local setup

Install dependencies and copy the environment template:

```bash
npm install
cp .env.example .env.local
```

Set these values in `.env.local`. The project URL and browser-safe publishable
key come from the Supabase dashboard; the map key comes from Geoapify:

```dotenv
VITE_SUPABASE_URL=
VITE_SUPABASE_PUBLISHABLE_KEY=
VITE_GEOAPIFY_MAP_KEY=
```

Never put a Supabase secret key, service-role key, database password, or real
credential in a `VITE_` variable, source file, README, or committed environment
file. Vite environment variables are included in the browser bundle.

Start the app with:

```bash
npm run dev
```

The shared client in `src/lib/supabase.ts` validates the required environment
variables and initializes one browser client. `AuthProvider` loads the initial
session, observes auth changes, and supports passwordless email magic links.

## Supabase Auth URL configuration

In **Authentication → URL Configuration** in the Supabase dashboard:

- Set **Site URL** to the canonical deployed application origin when production
  hosting is available. During local-only development, use the exact origin you
  normally run, such as `http://localhost:5173`.
- Add local redirect patterns for each origin you use, for example
  `http://localhost:5173/**` and `http://127.0.0.1:5173/**`.
- Add future production callbacks such as
  `https://your-production-domain.example/today` and
  `https://your-production-domain.example/invite/**`.
- Add preview deployment patterns only when needed, and prefer an exact HTTPS
  production redirect over a broad wildcard.

The app derives `emailRedirectTo` from `window.location.origin` and sends users
back to `/today` or the current invitation; it does not hard-code a development host. Confirm the Magic
Link email template uses `{{ .ConfirmationURL }}`, or correctly incorporates
`{{ .RedirectTo }}` when using a custom template.

## Database foundation

Versioned SQL lives in `supabase/migrations/`. The initial migration creates the
profiles, shared spaces, membership, ideas, adventures, itinerary stops,
checklist items, and links schema with membership-based Row Level Security.
`supabase/seed.sql` is intentionally empty until real authentication users exist.

Apply migrations to a linked Supabase project with the current Supabase CLI:

```bash
npx supabase login
npx supabase link --project-ref YOUR_PROJECT_REF
npx supabase db push
```

Review the generated plan and confirm you are targeting the intended project
before applying it. The dashboard SQL editor can also run the migration, but the
CLI keeps migration history aligned with this repository.

## Current architecture

Authentication, profiles, spaces, memberships, invitations, Ideas, Adventures,
Calendar events, itinerary stops, notes, checklists, links, completion, and
Memories use live Supabase data. `src/data.ts` retains only the explicitly
seeded Today content that has not yet been migrated. Invitation and membership
mutations use owner-checked RPCs; the browser has no direct mutation grants on
`space_invitations` or `space_members`.

## Invitation email delivery

The deployed `send-space-invitation` Edge Function validates the signed-in
owner and invitation before sending. Production delivery uses Resend and needs
these Edge Function secrets in the Supabase dashboard:

```text
RESEND_API_KEY
INVITATION_FROM_EMAIL
```

`INVITATION_FROM_EMAIL` must use a sender/domain verified by the configured
Resend account. Until both secrets are configured, invitation creation remains
functional and the development build presents a copyable invitation URL. A
production build reports that delivery is not configured and never exposes the
raw token.

## Location candidate search

The authenticated `search-locations` Edge Function uses Geoapify Address
Autocomplete to return provider-ranked location candidates. Configure its
server-only key as a Supabase Edge Function secret:

```bash
npx supabase secrets set GEOAPIFY_GEOCODING_KEY=YOUR_SERVER_SIDE_KEY
```

`GEOAPIFY_GEOCODING_KEY` must not be added to `.env.example`, prefixed with
`VITE_`, or otherwise exposed to the browser. Deploying the function is a
separate manual step after its secret is configured.

## Browser map configuration

The itinerary stop map uses a separate public Geoapify key through
`VITE_GEOAPIFY_MAP_KEY`. Create or select a Geoapify project, enable map-tile
access, and place its browser key in the ignored `.env.local` file. This key is
embedded in the Vite browser bundle and must never be reused as the server-only
`GEOAPIFY_GEOCODING_KEY`.

Before hosting the app, restrict the browser key to every exact application
origin that should load tiles, including the chosen local origin and each
production or preview origin. Review the Geoapify project quota and billing
limits, configure usage alerts where available, and verify the
`osm-bright-grey` MapLibre style manually after changing restrictions. The map
keeps Geoapify, OpenMapTiles, and OpenStreetMap attribution visible. See the
[Geoapify map-tile documentation](https://apidocs.geoapify.com/docs/maps/) for
provider setup and current style URLs.

If the public key is absent, invalid, over quota, or rejected by its origin
rules, the Adventure detail page keeps the itinerary list usable and shows a
recoverable map fallback instead of crashing.

### Location persistence rollout compatibility

Adventure, stop, and Idea-promotion forms now send explicit `LocationDraft`
intent. Untouched saved locations preserve metadata, selected candidates become
confirmed, edited labels become text-only and clear stale metadata, and removed
locations clear every geographic field. The Phase 3 label-compatibility adapter
remains only as a safe boundary for older call sites during rollout; the updated
forms do not rely on final-label equality.

## Verification

```bash
npm test
npm run lint
npm run typecheck
npm run build
```

`npm test` runs the committed Vitest suite. The initial coverage targets pure
location normalization and persistence-payload behavior; browser/E2E tooling
is still not configured in this repository.
