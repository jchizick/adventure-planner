# Our Adventures

Mobile-first shared adventure planner prototype for Jordan and Liz.

## Local setup

Install dependencies and copy the environment template:

```bash
npm install
cp .env.example .env.local
```

Set these values in `.env.local` using the project URL and browser-safe
publishable key from the Supabase dashboard:

```dotenv
VITE_SUPABASE_URL=
VITE_SUPABASE_PUBLISHABLE_KEY=
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
- Add the exact future production callback, such as
  `https://your-production-domain.example/today`.
- Add preview deployment patterns only when needed, and prefer an exact HTTPS
  production redirect over a broad wildcard.

The app derives `emailRedirectTo` from `window.location.origin` and sends users
back to `/today`; it does not hard-code a development host. Confirm the Magic
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

The frontend still reads and mutates the seeded mock state in `src/data.ts` and
the existing React context. Supabase now provides authentication, profiles,
shared-space membership, and onboarding. Ideas, adventures, calendar events,
and memories remain mock state and do not perform live CRUD.

## Add the second known member

There is intentionally no public invitation flow yet. After the second person
has signed in once and the `profiles` trigger has created their row, an
administrator can add that known profile to the existing space in the Supabase
SQL Editor. Replace both placeholders with IDs copied from the dashboard; do not
store real UUIDs or emails in this repository.

```sql
insert into public.space_members (space_id, user_id, role)
values ('<EXISTING_SPACE_UUID>', '<SECOND_USER_PROFILE_UUID>', 'member')
on conflict (space_id, user_id) do update set role = excluded.role;
```

Verify the selected profile and space before running the statement. This is an
administrator-only setup step; never expose a secret or service-role key in the
browser.

The next planned migration step is to add an owner-controlled invitation flow
or typed live repositories, then replace each mock-state workflow incrementally.

## Verification

```bash
npm run lint
npm run typecheck
npm run build
```
