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
session, observes auth changes, and exposes session state without requiring a
login screen yet.

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
the existing React context. Supabase is currently the client, authentication,
and schema foundation only; routes and prototype workflows do not require a
session or perform live CRUD.

The next planned migration step is to add the authentication UI and typed live
repositories, then replace each mock-state workflow incrementally.

## Verification

```bash
npm run lint
npm run typecheck
npm run build
```
